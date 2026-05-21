import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import ExpiryAlertBanner from '../components/ExpiryAlertBanner';

const CC = {
  cardiac:         {bg:'rgba(59,130,246,0.06)', border:'rgba(59,130,246,0.15)',  badge:'badge-blue',   label:'🫀 Cardiac'},
  general_surgery: {bg:'rgba(16,185,129,0.06)',border:'rgba(16,185,129,0.15)',  badge:'badge-green',  label:'🟢 General Surgery'},
  neurosurgery:    {bg:'rgba(139,92,246,0.06)',border:'rgba(139,92,246,0.15)',  badge:'badge-purple', label:'🧠 Neurosurgery'},
  orthopedic:      {bg:'rgba(245,158,11,0.06)',border:'rgba(245,158,11,0.15)',  badge:'badge-amber',  label:'🦴 Orthopedic'},
};

export default function SupplyChainPage() {
  const { user } = useAuth();

  const [tab,          setTab]          = useState('inventory');
  const [consignments, setConsignments] = useState([]);
  const [lots,         setLots]         = useState([]);
  const [implants,     setImplants]     = useState([]);

  const [loading,          setLoading]          = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [hospitalFilter,  setHospitalFilter]  = useState('');
  const [categoryFilter,  setCategoryFilter]  = useState('');
  const [surgeonFilter,   setSurgeonFilter]   = useState('');

  // NL Query state
  const [nlQuery,   setNlQuery]   = useState('');
  const [nlBusy,    setNlBusy]    = useState(false);
  const [nlResult,  setNlResult]  = useState(null);
  const [nlError,   setNlError]   = useState('');

  const today = new Date().toISOString().split('T')[0];

  // ── Available quantity ─────────────────────────────────────────
  const getAvailable = (c) =>
    c.quantity - (c.usedQuantity||0) - (c.openedNotUsed||0) - (c.returnedQuantity||0);

  // ── Data loading ───────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [c, l] = await Promise.allSettled([
        api.getConsignments({}),
        api.getLots(),
      ]);
      if (c.status==='fulfilled') setConsignments(c.value || []);
      if (l.status==='fulfilled') setLots(l.value || []);
    } catch {}
    setLoading(false);
  }, []);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const data = await api.getImplantsByHospital(user?.hospitalId || '');
      setImplants(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    finally { setAnalyticsLoading(false); }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── NL Query ───────────────────────────────────────────────────

  const runNLQuery = async () => {
    if (!nlQuery.trim()) return;
    setNlBusy(true); setNlError(''); setNlResult(null);

    let data = implants;
    if (data.length === 0) {
      setAnalyticsLoading(true);
      try {
        data = await api.getImplantsByHospital(user?.hospitalId || '');
        setImplants(data);
      } catch {}
      setAnalyticsLoading(false);
    }

    const categories = [...new Set(data.map(i => i.deviceCategory))].join(', ');
    const surgeons   = [...new Set(data.map(i => i.surgeonId).filter(Boolean))].slice(0,20).join(', ');
    const dateRange  = data.length > 0
      ? `${data.map(i=>i.procedureDate).sort()[0]} to ${data.map(i=>i.procedureDate).sort().slice(-1)[0]}`
      : 'no dates';

    const prompt = `You are a hospital supply chain analyst. Convert this natural language query into JSON filter criteria for surgical implant records at ${user?.hospitalId || 'this hospital'}.

Available data context:
- Hospital: ${user?.hospitalId || 'All hospitals in scope'}
- Device categories: ${categories}
- Surgeons (sample): ${surgeons}
- Procedure date range: ${dateRange}
- Total records: ${data.length}
- Status values: implanted, explanted, recalled_in_situ

User query: "${nlQuery}"

IMPORTANT: If the user mentions a specific device category (cardiac, orthopedic, etc.), you MUST include it in the JSON even if that category has no records in the data. Never omit a filter the user explicitly asked for.

Return ONLY valid JSON with these filter fields (set to null only if the user did NOT mention that filter):
{
  "deviceCategory": "cardiac|orthopedic|neurosurgery|general_surgery or null",
  "deviceType": "specific type or null",
  "status": "implanted|explanted|recalled_in_situ or null",
  "surgeonId": "surgeon ID or null",
  "dateFrom": "YYYY-MM-DD or null",
  "dateTo": "YYYY-MM-DD or null",
  "deviceName": "partial device name to match or null",
  "explanation": "one sentence describing what this query returns"
}

Respond ONLY with the JSON object. No markdown, no explanation outside the JSON.`;

    try {
      const resp = await fetch('/api/ai/complete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, maxTokens: 300 }),
      });
      const respData = await resp.json();
      if (!resp.ok) throw new Error(respData.error || 'AI request failed');

      const text = respData.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Could not parse AI response');
      const filters = JSON.parse(jsonMatch[0]);

      const filtered = data.filter(i => {
        if (filters.deviceCategory && i.deviceCategory !== filters.deviceCategory) return false;
        if (filters.deviceType     && i.deviceType !== filters.deviceType) return false;
        if (filters.status         && i.status !== filters.status) return false;
        if (filters.surgeonId      && i.surgeonId !== filters.surgeonId) return false;
        if (filters.dateFrom       && i.procedureDate < filters.dateFrom) return false;
        if (filters.dateTo         && i.procedureDate > filters.dateTo) return false;
        if (filters.deviceName     && !i.deviceName?.toLowerCase().includes(filters.deviceName.toLowerCase())) return false;
        return true;
      });

      setNlResult({ filters, explanation: filters.explanation || 'Query applied', count: filtered.length, records: filtered });
    } catch (err) {
      setNlError('Could not process query: ' + err.message);
    } finally {
      setNlBusy(false);
    }
  };

  // ── Derived data ───────────────────────────────────────────────

  const active     = consignments.filter(c => c.status==='active');
  const recalled   = consignments.filter(c => c.status==='recalled');
  const depleted   = consignments.filter(c => c.status==='depleted');
  const backorders = lots.filter(l => l.backorder);

  const lowStock = active.filter(c => {
    const avail = getAvailable(c);
    return avail > 0 && c.quantity > 0 && (avail / c.quantity) < 0.2;
  });

  const hospitalOptions = [...new Set(active.map(c=>c.hospitalId))].sort();
  const categories      = [...new Set(active.map(c=>c.deviceCategory))].sort();

  const filtered = active.filter(c =>
    (!hospitalFilter || c.hospitalId === hospitalFilter) &&
    (!categoryFilter || c.deviceCategory === categoryFilter)
  );

  const byHospital = filtered.reduce((acc, c) => {
    if (!acc[c.hospitalId]) acc[c.hospitalId] = [];
    acc[c.hospitalId].push(c);
    return acc;
  }, {});

  // ── Helpers ────────────────────────────────────────────────────

  const tabStyle = (t) => ({
    padding:'8px 16px', borderRadius:'var(--radius-sm)', cursor:'pointer',
    fontSize:13, fontWeight:600, border:'none',
    background: tab===t ? 'var(--accent-purple)' : 'transparent',
    color: tab===t ? '#fff' : 'var(--text-secondary)',
  });

  const catHeader = (category, colSpan) => {
    const cat = CC[category]||{border:'var(--border)',label:category};
    return (
      <tr>
        <td colSpan={colSpan} style={{padding:'8px 12px',background:cat.border,
          borderTop:'2px solid '+cat.border,fontSize:11,fontWeight:700,
          color:'var(--text-secondary)',textTransform:'uppercase',
          letterSpacing:'0.08em',fontFamily:'var(--font-mono)'}}>
          {cat.label || category}
        </td>
      </tr>
    );
  };

  // ── Render ─────────────────────────────────────────────────────

  return (
    <>
      <div className="page-header">
        <h2>📦 Supply Chain Portal</h2>
        <p>Hospital inventory visibility, low stock alerts and backorder tracking</p>
      </div>

      <ExpiryAlertBanner />

      {recalled.length > 0 && (
        <div className="alert alert-error" style={{marginBottom:12}}>
          ⚠ <strong>{recalled.length} recalled consignment{recalled.length>1?'s':''}</strong> — quarantine devices and contact reps immediately.
        </div>
      )}
      {lowStock.length > 0 && (
        <div className="alert alert-amber" style={{marginBottom:12}}>
          ⚠ <strong>Low Stock ({lowStock.length}):</strong>{' '}
          {lowStock.map(c=>`${c.deviceName} (${getAvailable(c)} remaining)`).join(' · ')}
        </div>
      )}
      {backorders.length > 0 && (
        <div className="alert alert-amber" style={{marginBottom:12}}>
          ⚠ <strong>Backordered ({backorders.length}):</strong>{' '}
          {backorders.map(l=>`${l.deviceName} — ${l.backorderReason}`).join(' · ')}
        </div>
      )}

      <div className="kpi-grid" style={{gridTemplateColumns:'repeat(5,1fr)', marginBottom:16}}>
        {[
          {label:'Active Consignments', value:active.length,    color:'green'},
          {label:'Available Units',     value:active.reduce((s,c)=>s+getAvailable(c),0), color:'blue'},
          {label:'Low Stock',           value:lowStock.length,  color:'amber'},
          {label:'Recalled',            value:recalled.length,  color:'red'},
          {label:'Backordered Lots',    value:backorders.length,color:'purple'},
        ].map(({label,value,color})=>(
          <div key={label} className={`kpi-card ${color}`}>
            <div className="kpi-label">{label}</div>
            <div className="kpi-value" style={{color:`var(--accent-${color})`}}>
              {loading ? '—' : value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',gap:4,marginBottom:20,background:'var(--bg-card)',
        padding:4,borderRadius:'var(--radius-md)',width:'fit-content',
        border:'1px solid var(--border)'}}>
        <button style={tabStyle('inventory')} onClick={()=>setTab('inventory')}>📦 By Hospital</button>
        <button style={tabStyle('category')}  onClick={()=>setTab('category')}>🦾 By Device</button>
        <button style={tabStyle('recalled')}  onClick={()=>setTab('recalled')}>
          ⚠ Recalled
          {recalled.length > 0 && <span className="badge badge-red" style={{marginLeft:6}}>{recalled.length}</span>}
        </button>
        <button style={tabStyle('backorder')} onClick={()=>setTab('backorder')}>
          🔴 Backorders
          {backorders.length > 0 && <span className="badge badge-amber" style={{marginLeft:6}}>{backorders.length}</span>}
        </button>
        <button style={tabStyle('analytics')}
          onClick={()=>{ setTab('analytics'); if(implants.length===0) loadAnalytics(); }}>
          📊 Analytics
        </button>
      </div>

      {/* ══════════════════════════════════════════════════
          BY HOSPITAL
      ══════════════════════════════════════════════════ */}
      {tab==='inventory' && (
        <>
          <div style={{display:'flex',gap:12,marginBottom:16,alignItems:'flex-end'}}>
            <div className="form-group" style={{marginBottom:0,minWidth:220}}>
              <select value={hospitalFilter} onChange={e=>setHospitalFilter(e.target.value)}>
                <option value="">All Hospitals</option>
                {hospitalOptions.map(h=><option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="form-group" style={{marginBottom:0,minWidth:180}}>
              <select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}>
                <option value="">All Categories</option>
                {categories.map(c=><option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={refresh}>↻ Refresh</button>
          </div>

          {loading
            ? <div className="loading-overlay"><span className="spinner"/></div>
            : Object.keys(byHospital).length===0
              ? <div className="empty-state"><div className="icon">🏥</div>
                  <p>No active inventory{hospitalFilter?` at ${hospitalFilter}`:''}</p>
                </div>
              : Object.entries(byHospital).map(([hospital, items]) => {
                  const totalAvail = items.reduce((s,c)=>s+getAvailable(c),0);
                  const hasLow     = items.some(c=>c.quantity>0&&(getAvailable(c)/c.quantity)<0.2);
                  return (
                    <div key={hospital} className="card" style={{marginBottom:16,
                      borderColor:hasLow?'rgba(245,158,11,0.4)':'var(--border)'}}>
                      <div className="card-header">
                        <span className="card-title">
                          🏥 {hospital}
                          <span className="badge badge-blue" style={{marginLeft:8}}>{items.length} devices</span>
                          <span style={{fontSize:12,color:'var(--accent-green)',marginLeft:8}}>
                            {totalAvail} units available
                          </span>
                          {hasLow && <span className="badge badge-amber" style={{marginLeft:8}}>⚠ Low Stock</span>}
                        </span>
                      </div>
                      <div className="table-wrap"><table>
                        <thead><tr>
                          <th>Device</th><th>Category</th><th>Lot #</th><th>Location</th>
                          <th>Total</th><th>Used</th><th>Available</th><th>Stock %</th>
                          <th>Expiry</th><th>Sterile Exp</th><th>Rep</th>
                        </tr></thead>
                        <tbody>{(()=>{
                          const sorted = [...items].sort((a,b)=>
                            (a.deviceCategory||'').localeCompare(b.deviceCategory||'')||
                            (a.deviceName||'').localeCompare(b.deviceName||'')
                          );
                          let lastCat = null;
                          return sorted.map(c=>{
                            const avail = getAvailable(c);
                            const pct   = c.quantity > 0 ? Math.round((avail/c.quantity)*100) : 0;
                            const stockColor = pct>20?'var(--accent-green)':pct>0?'var(--accent-amber)':'var(--accent-red)';
                            const cat   = CC[c.deviceCategory]||{bg:'transparent',border:'transparent',badge:'badge-blue'};
                            const newCat = c.deviceCategory !== lastCat;
                            lastCat = c.deviceCategory;
                            return (
                              <>
                                {newCat && catHeader(c.deviceCategory, 11)}
                                <tr key={c.consignmentId} style={{background:cat.bg}}>
                                  <td>
                                    <div style={{fontWeight:600,fontSize:12}}>{c.deviceName}</div>
                                    <div style={{fontSize:10,color:'var(--text-muted)'}}>{c.deviceType}</div>
                                  </td>
                                  <td><span className={`badge ${cat.badge}`}>{(c.deviceCategory||'').replace(/_/g,' ')}</span></td>
                                  <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{c.lotNumber}</td>
                                  <td style={{fontSize:11}}>{c.location}</td>
                                  <td style={{textAlign:'center'}}>{c.quantity}</td>
                                  <td style={{textAlign:'center',color:'var(--accent-amber)'}}>{c.usedQuantity||0}</td>
                                  <td style={{textAlign:'center',fontWeight:600,color:stockColor}}>{avail}</td>
                                  <td>
                                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                                      <div style={{width:50,height:5,background:'var(--border)',borderRadius:3,overflow:'hidden'}}>
                                        <div style={{width:`${pct}%`,height:'100%',background:stockColor,borderRadius:3}}/>
                                      </div>
                                      <span style={{fontSize:10,color:stockColor}}>{pct}%</span>
                                    </div>
                                  </td>
                                  <td style={{fontSize:11,color:c.expiryDate<today?'var(--accent-red)':'inherit'}}>{c.expiryDate}</td>
                                  <td style={{fontSize:11,color:c.sterileExpiryDate<today?'var(--accent-red)':'inherit'}}>{c.sterileExpiryDate}</td>
                                  <td style={{fontSize:11}}>{c.repId}</td>
                                </tr>
                              </>
                            );
                          });
                        })()}</tbody>
                      </table></div>
                    </div>
                  );
                })
          }
        </>
      )}

      {/* ══════════════════════════════════════════════════
          BY DEVICE
      ══════════════════════════════════════════════════ */}
      {tab==='category' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Device Inventory Summary</span>
            <button className="btn btn-ghost btn-sm" onClick={refresh}>↻ Refresh</button>
          </div>
          {loading
            ? <div className="loading-overlay"><span className="spinner"/></div>
            : <div className="table-wrap"><table>
                <thead><tr>
                  <th>Device</th><th>Category</th><th>Consignments</th>
                  <th>Hospitals</th><th>Total Units</th><th>Used</th><th>Available</th>
                </tr></thead>
                <tbody>{(()=>{
                  const grouped = Object.entries(
                    active.reduce((acc, c) => {
                      const key = c.udiDI || c.deviceName;
                      if (!acc[key]) acc[key] = {
                        deviceName:c.deviceName, deviceCategory:c.deviceCategory,
                        consignments:0, hospitals:new Set(), total:0, used:0, avail:0,
                      };
                      acc[key].consignments++;
                      acc[key].hospitals.add(c.hospitalId);
                      acc[key].total += c.quantity;
                      acc[key].used  += c.usedQuantity||0;
                      acc[key].avail += getAvailable(c);
                      return acc;
                    }, {})
                  ).sort((a,b)=>
                    (a[1].deviceCategory||'').localeCompare(b[1].deviceCategory||'')||
                    (a[1].deviceName||'').localeCompare(b[1].deviceName||'')
                  );
                  let lastCat = null;
                  return grouped.map(([key, d]) => {
                    const cat    = CC[d.deviceCategory]||{bg:'transparent',border:'transparent',badge:'badge-blue'};
                    const newCat = d.deviceCategory !== lastCat;
                    lastCat = d.deviceCategory;
                    return (
                      <>
                        {newCat && catHeader(d.deviceCategory, 7)}
                        <tr key={key} style={{background:cat.bg}}>
                          <td style={{fontWeight:600}}>{d.deviceName}</td>
                          <td><span className={`badge ${cat.badge}`}>{(d.deviceCategory||'').replace(/_/g,' ')}</span></td>
                          <td style={{textAlign:'center'}}>{d.consignments}</td>
                          <td style={{textAlign:'center'}}>{d.hospitals.size}</td>
                          <td style={{textAlign:'center'}}>{d.total}</td>
                          <td style={{textAlign:'center',color:'var(--accent-amber)'}}>{d.used}</td>
                          <td style={{textAlign:'center',fontWeight:600,
                            color:d.avail>0?'var(--accent-green)':'var(--text-muted)'}}>{d.avail}</td>
                        </tr>
                      </>
                    );
                  });
                })()}</tbody>
              </table></div>
          }
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          RECALLED
      ══════════════════════════════════════════════════ */}
      {tab==='recalled' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">⚠ Recalled Consignments <span className="badge badge-red">{recalled.length}</span></span>
          </div>
          {recalled.length===0
            ? <div className="empty-state"><div className="icon">✅</div><p>No recalled consignments</p></div>
            : <div className="table-wrap"><table>
                <thead><tr>
                  <th>Consignment ID</th><th>Device</th><th>Hospital</th>
                  <th>Location</th><th>Total Qty</th><th>Implanted</th>
                  <th>Unimplanted</th><th>Recall Reason</th>
                </tr></thead>
                <tbody>{recalled.map(c=>(
                  <tr key={c.consignmentId} style={{background:'rgba(239,68,68,0.05)'}}>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{c.consignmentId}</td>
                    <td style={{fontWeight:600}}>{c.deviceName}</td>
                    <td>🏥 {c.hospitalId}</td>
                    <td style={{fontSize:11}}>{c.location}</td>
                    <td>{c.quantity}</td>
                    <td style={{color:'var(--accent-amber)'}}>{c.usedQuantity||0}</td>
                    <td style={{fontWeight:600,color:'var(--accent-red)'}}>
                      {c.quantity-(c.usedQuantity||0)} — quarantine immediately
                    </td>
                    <td style={{fontSize:11,color:'var(--accent-red)'}}>{c.recallReason}</td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          BACKORDERS
      ══════════════════════════════════════════════════ */}
      {tab==='backorder' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">🔴 Backordered Lots <span className="badge badge-amber">{backorders.length}</span></span>
          </div>
          {backorders.length===0
            ? <div className="empty-state"><div className="icon">✅</div><p>No backordered lots</p></div>
            : <div className="table-wrap"><table>
                <thead><tr>
                  <th>Lot ID</th><th>Device</th><th>Manufacturer</th><th>Lot #</th>
                  <th>Remaining</th><th>Reason</th><th>Est. Resupply</th>
                </tr></thead>
                <tbody>{backorders.map(l=>(
                  <tr key={l.lotId} style={{background:'rgba(245,158,11,0.05)'}}>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{l.lotId}</td>
                    <td style={{fontWeight:600}}>{l.deviceName}</td>
                    <td style={{fontSize:12}}>{l.manufacturerId}</td>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{l.lotNumber}</td>
                    <td style={{color:'var(--accent-amber)',fontWeight:600}}>{l.remainingQuantity}</td>
                    <td style={{fontSize:11}}>{l.backorderReason}</td>
                    <td style={{fontSize:11}}>{l.estimatedResupplyDate||'Not specified'}</td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          ANALYTICS — with NL Query
          Patient MRNs NOT shown — HIPAA compliance.
      ══════════════════════════════════════════════════ */}
      {tab==='analytics' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              📊 Surgical Analytics
              <span className="badge badge-purple" style={{marginLeft:8}}>{implants.length} records</span>
            </span>
            <button className="btn btn-ghost btn-sm" onClick={loadAnalytics}>↻ Refresh</button>
          </div>

          {/* NL Query bar */}
          <div style={{background:'rgba(139,92,246,0.06)',border:'1px solid rgba(139,92,246,0.2)',
            borderRadius:'var(--radius-md)',padding:'14px 16px',marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:600,color:'var(--accent-purple)',marginBottom:8}}>
              🤖 Natural Language Query
            </div>
            <div style={{display:'flex',gap:8}}>
              <input
                value={nlQuery}
                onChange={e=>setNlQuery(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&runNLQuery()}
                placeholder="e.g. all orthopedic procedures by Dr. Johnson this year"
                style={{flex:1,background:'var(--bg-secondary)',border:'1px solid var(--border)',
                  borderRadius:'var(--radius-sm)',padding:'8px 12px',fontSize:13,
                  color:'var(--text-primary)',outline:'none'}}/>
              <button className="btn btn-ghost btn-sm"
                style={{color:'var(--accent-purple)',borderColor:'var(--accent-purple)',whiteSpace:'nowrap'}}
                disabled={nlBusy||!nlQuery.trim()} onClick={runNLQuery}>
                {nlBusy
                  ? <><span className="spinner" style={{width:12,height:12}}/> Querying…</>
                  : '🔍 Run Query'}
              </button>
              {nlResult && (
                <button className="btn btn-ghost btn-sm"
                  onClick={()=>{setNlResult(null);setNlQuery('');}}>
                  ✕ Clear
                </button>
              )}
            </div>
            <div style={{fontSize:11,color:'var(--text-muted)',marginTop:6}}>
              Examples: "cardiac implants this month" · "explanted devices" ·
              "stryker devices still implanted" · "procedures after March 2026"
            </div>
            {nlError && <div style={{marginTop:8,fontSize:12,color:'var(--accent-red)'}}>⚠ {nlError}</div>}
            {nlResult && (
              <div style={{marginTop:10,padding:'10px 12px',background:'rgba(139,92,246,0.06)',
                borderRadius:'var(--radius-sm)',border:'1px solid rgba(139,92,246,0.15)'}}>
                <div style={{fontSize:12,color:'var(--accent-purple)',fontWeight:600,marginBottom:4}}>
                  ✓ {nlResult.explanation}
                </div>
                <div style={{fontSize:12,color:'var(--text-secondary)'}}>
                  Found <strong style={{color:'var(--text-primary)'}}>{nlResult.count}</strong> records
                  {Object.entries(nlResult.filters).filter(([k,v])=>v&&k!=='explanation').map(([k,v])=>(
                    <span key={k} style={{marginLeft:8,padding:'1px 8px',borderRadius:99,
                      background:'rgba(139,92,246,0.1)',color:'var(--accent-purple)',fontSize:11}}>
                      {k}: {v}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Surgeon dropdown filter */}
          <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap'}}>
            <div className="form-group" style={{marginBottom:0,minWidth:180}}>
              <select value={surgeonFilter} onChange={e=>setSurgeonFilter(e.target.value)}>
                <option value="">All Surgeons</option>
                {[...new Set(implants.map(i=>i.surgeonId).filter(Boolean))].sort().map(s=>(
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div style={{fontSize:12,color:'var(--text-muted)',alignSelf:'center'}}>
              {(nlResult ? nlResult.records : implants)
                .filter(i=>!surgeonFilter||i.surgeonId===surgeonFilter).length
              } {nlResult ? 'query results' : 'records'} shown
            </div>
          </div>

          {analyticsLoading
            ? <div className="loading-overlay"><span className="spinner"/></div>
            : implants.length===0
              ? <div className="empty-state">
                  <div className="icon">📊</div>
                  <p>No implant records — click Refresh</p>
                </div>
              : (() => {
                  const display = (nlResult ? nlResult.records : implants)
                    .filter(i=>!surgeonFilter||i.surgeonId===surgeonFilter)
                    .sort((a,b)=>
                      (a.deviceCategory||'').localeCompare(b.deviceCategory||'')||
                      (a.procedureDate||'').localeCompare(b.procedureDate||'')
                    );
                  let lastCat = null;
                  return (
                    <div className="table-wrap"><table>
                      <thead><tr>
                        <th>Implant ID</th><th>Device</th><th>Category</th>
                        <th>Procedure</th><th>Body Location</th><th>Surgeon</th>
                        <th>Date</th><th>Status</th>
                      </tr></thead>
                      <tbody>{display.map(i=>{
                        const cat    = CC[i.deviceCategory]||{bg:'transparent',border:'transparent',badge:'badge-blue'};
                        const newCat = i.deviceCategory !== lastCat;
                        lastCat = i.deviceCategory;
                        return (
                          <>
                            {newCat && catHeader(i.deviceCategory, 8)}
                            <tr key={i.implantId} style={{background:cat.bg}}>
                              <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{i.implantId}</td>
                              <td>
                                <div style={{fontWeight:600,fontSize:12}}>{i.deviceName}</div>
                                <div style={{fontSize:10,color:'var(--text-muted)'}}>{i.lotNumber}</div>
                              </td>
                              <td><span className={`badge ${cat.badge}`}>{(i.deviceCategory||'').replace(/_/g,' ')}</span></td>
                              <td style={{fontSize:11}}>{i.procedureType}</td>
                              <td style={{fontSize:11}}>{i.bodyLocation}</td>
                              <td style={{fontSize:12,fontWeight:500}}>{i.surgeonId||'—'}</td>
                              <td style={{fontSize:11}}>{i.procedureDate}</td>
                              <td>
                                <span className={`badge ${i.status==='implanted'?'badge-green':i.status==='explanted'?'badge-amber':'badge-red'}`}>
                                  {i.status}
                                </span>
                              </td>
                            </tr>
                          </>
                        );
                      })}</tbody>
                    </table></div>
                  );
                })()
          }
        </div>
      )}
    </>
  );
}
