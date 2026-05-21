import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const CHECK_META = {
  hasUdiDI:           { label:'UDI-DI Present',         desc:'Device Identifier captured at implant',       critical:true  },
  hasUdiPI:           { label:'UDI-PI Captured',         desc:'Production Identifier (lot/serial/expiry)',   critical:false },
  hasLotNumber:       { label:'Lot Number Recorded',     desc:'Lot number linked to implant record',         critical:true  },
  hasSerialNumber:    { label:'Serial Number Recorded',  desc:'Serial number captured (if applicable)',      critical:false },
  hasSurgeon:         { label:'Surgeon Documented',      desc:'Implanting surgeon ID recorded',              critical:true  },
  hasProcedureDate:   { label:'Procedure Date Present',  desc:'Date of implantation recorded',               critical:true  },
  hasBodyLocation:    { label:'Body Location Present',   desc:'Anatomical location documented',              critical:true  },
  hasActiveClearance: { label:'Active Clearance Exists', desc:'FDA clearance active for this device',        critical:true  },
  notRecalled:        { label:'Not Recalled',            desc:'Device lot has not been recalled',            critical:true  },
};

const SCORE_COLOR = (score) =>
  score === 100 ? 'var(--accent-green)'
  : score >= 80 ? 'var(--accent-amber)'
  : 'var(--accent-red)';

const SCORE_BADGE = (score) =>
  score === 100 ? 'badge-green' : score >= 80 ? 'badge-amber' : 'badge-red';

export default function CompliancePage() {
  const { user } = useAuth();
  const [tab,        setTab]        = useState('summary');
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [hospFilter, setHospFilter] = useState('');
  const [search,     setSearch]     = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await api.getUDICompliance();
      setData(result);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const exportCSV = (rows, filename) => {
    if (!rows.length) return;
    const headers = ['implantId','deviceName','udiDI','hospitalId','procedureDate','status','score','compliant',
                     ...Object.keys(CHECK_META)];
    const csv = [
      headers.join(','),
      ...rows.map(r => [
        r.implantId, r.deviceName, r.udiDI, r.hospitalId, r.procedureDate, r.status, r.score, r.compliant,
        ...Object.keys(CHECK_META).map(k => r.checks[k] === null ? 'N/A' : r.checks[k] ? 'PASS' : 'FAIL'),
      ].map(v => `"${v}"`).join(','))
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
    a.download = filename; a.click();
  };

  const tabStyle = t => ({
    padding:'8px 16px', borderRadius:'var(--radius-sm)', cursor:'pointer',
    fontSize:13, fontWeight:600, border:'none',
    background: tab===t ? 'var(--accent-blue)' : 'transparent',
    color: tab===t ? '#fff' : 'var(--text-secondary)',
  });

  const summary   = data?.summary;
  const allRows   = data?.report || [];
  const hospitals = [...new Set(allRows.map(r=>r.hospitalId))].sort();

  const filtered = allRows.filter(r => {
    if (hospFilter && r.hospitalId !== hospFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (r.implantId||'').toLowerCase().includes(q) ||
             (r.deviceName||'').toLowerCase().includes(q) ||
             (r.udiDI||'').toLowerCase().includes(q);
    }
    return true;
  });

  const issues = filtered.filter(r => !r.compliant);
  const rate   = summary?.complianceRate ?? 0;
  const rateColor = SCORE_COLOR(rate);

  return (
    <>
      <div className="page-header">
        <h2>📊 UDI Compliance Report</h2>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <p>FDA UDI Rule compliance check across all implant records</p>
          {user?.hospitalId && (
            <span className="badge badge-purple" style={{fontSize:11}}>🏥 {user.hospitalId}</span>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error" style={{marginBottom:12}}>⚠ {error}</div>}

      {/* Tab bar */}
      <div style={{display:'flex',gap:4,marginBottom:20,background:'var(--bg-card)',
        padding:4,borderRadius:'var(--radius-md)',width:'fit-content',border:'1px solid var(--border)'}}>
        <button style={tabStyle('summary')} onClick={()=>setTab('summary')}>📋 Summary</button>
        <button style={tabStyle('records')} onClick={()=>setTab('records')}>
          🔍 All Records
          {allRows.length>0 && <span className="badge badge-blue" style={{marginLeft:6,fontSize:10}}>{allRows.length}</span>}
        </button>
        <button style={tabStyle('issues')} onClick={()=>setTab('issues')}>
          ⚠ Issues Only
          {summary?.nonCompliant>0 && <span className="badge badge-red" style={{marginLeft:6,fontSize:10}}>{summary.nonCompliant}</span>}
        </button>
      </div>

      {loading && <div className="loading-overlay"><span className="spinner"/> Loading compliance data…</div>}

      {/* ══ SUMMARY TAB ══ */}
      {tab==='summary' && !loading && data && (
        <>
          {/* Big score */}
          <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:24,marginBottom:20,
            padding:24,background:'var(--bg-card)',borderRadius:'var(--radius-lg)',
            border:`2px solid ${rateColor}30`}}>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',
              justifyContent:'center',minWidth:160}}>
              <div style={{fontSize:64,fontWeight:800,color:rateColor,lineHeight:1}}>{rate}%</div>
              <div style={{fontSize:14,color:'var(--text-secondary)',marginTop:4}}>Overall Compliance</div>
              <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
                {summary.compliant} of {summary.total} records
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
              {[
                { label:'Total Records',    value:summary.total,           color:'blue'  },
                { label:'Fully Compliant',  value:summary.compliant,       color:'green' },
                { label:'Non-Compliant',    value:summary.nonCompliant,    color:'red'   },
                { label:'Compliance Rate',  value:`${rate}%`,              color: rate===100?'green':rate>=80?'amber':'red' },
              ].map(k=>(
                <div key={k.label} style={{padding:'14px 16px',background:'var(--bg-secondary)',
                  borderRadius:'var(--radius-md)',border:'1px solid var(--border)'}}>
                  <div style={{fontSize:22,fontWeight:700,color:`var(--accent-${k.color})`}}>{k.value}</div>
                  <div style={{fontSize:11,color:'var(--text-secondary)',marginTop:2}}>{k.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Check-by-check breakdown */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
            <div className="card">
              <div className="card-header"><span className="card-title">✅ Compliance Checks</span></div>
              <div className="table-wrap"><table>
                <thead><tr><th>Check</th><th>Type</th><th>Pass</th><th>Fail</th><th>Rate</th></tr></thead>
                <tbody>{Object.entries(CHECK_META).map(([key, meta])=>{
                  const pass = summary.byCheck[key] ?? 0;
                  const fail = summary.total - pass;
                  const pct  = summary.total > 0 ? Math.round((pass/summary.total)*100) : 100;
                  const color = pct===100?'var(--accent-green)':pct>=80?'var(--accent-amber)':'var(--accent-red)';
                  return (
                    <tr key={key}>
                      <td>
                        <div style={{fontSize:12,fontWeight:600}}>{meta.label}</div>
                        <div style={{fontSize:10,color:'var(--text-muted)'}}>{meta.desc}</div>
                      </td>
                      <td>
                        <span className={`badge ${meta.critical?'badge-red':'badge-blue'}`} style={{fontSize:10}}>
                          {meta.critical?'Critical':'Advisory'}
                        </span>
                      </td>
                      <td style={{color:'var(--accent-green)',fontWeight:600}}>{pass}</td>
                      <td style={{color:fail>0?'var(--accent-red)':'var(--text-muted)',fontWeight:fail>0?600:400}}>{fail}</td>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <div style={{flex:1,height:5,background:'var(--border)',borderRadius:3,overflow:'hidden',minWidth:60}}>
                            <div style={{width:`${pct}%`,height:'100%',background:color,borderRadius:3}}/>
                          </div>
                          <span style={{fontSize:11,color,minWidth:36}}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            </div>

            {/* By hospital */}
            <div className="card">
              <div className="card-header"><span className="card-title">🏥 Compliance by Hospital</span></div>
              {Object.keys(summary.byHospital).length===0
                ? <div className="empty-state"><div className="icon">🏥</div><p>No data</p></div>
                : <div className="table-wrap"><table>
                    <thead><tr><th>Hospital</th><th>Records</th><th>Compliant</th><th>Rate</th></tr></thead>
                    <tbody>{Object.entries(summary.byHospital).sort((a,b)=>a[0].localeCompare(b[0])).map(([hosp,s])=>{
                      const pct = s.total>0 ? Math.round((s.compliant/s.total)*100) : 100;
                      const color = pct===100?'var(--accent-green)':pct>=80?'var(--accent-amber)':'var(--accent-red)';
                      return (
                        <tr key={hosp}>
                          <td style={{fontSize:12}}>🏥 {hosp}</td>
                          <td style={{fontWeight:600}}>{s.total}</td>
                          <td style={{color:'var(--accent-green)',fontWeight:600}}>{s.compliant}</td>
                          <td>
                            <div style={{display:'flex',alignItems:'center',gap:6}}>
                              <div style={{flex:1,height:5,background:'var(--border)',borderRadius:3,overflow:'hidden'}}>
                                <div style={{width:`${pct}%`,height:'100%',background:color,borderRadius:3}}/>
                              </div>
                              <span style={{fontSize:12,fontWeight:700,color,minWidth:40}}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}</tbody>
                  </table></div>
              }
            </div>
          </div>

          {/* Top issues */}
          {summary.nonCompliant > 0 && (
            <div className="card" style={{borderColor:'rgba(239,68,68,0.3)'}}>
              <div className="card-header">
                <span className="card-title">⚠ Non-Compliant Records
                  <span className="badge badge-red" style={{marginLeft:8}}>{summary.nonCompliant}</span>
                </span>
                <div style={{display:'flex',gap:8}}>
                  <button className="btn btn-ghost btn-sm"
                    onClick={()=>exportCSV(allRows.filter(r=>!r.compliant),`compliance-issues-${today()}.csv`)}>
                    ↓ Export Issues CSV
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{color:'var(--accent-red)'}}
                    onClick={()=>setTab('issues')}>
                    View All Issues →
                  </button>
                </div>
              </div>
              <div className="table-wrap"><table>
                <thead><tr><th>Implant ID</th><th>Device</th><th>Hospital</th><th>Score</th><th>Failing Checks</th></tr></thead>
                <tbody>{allRows.filter(r=>!r.compliant).slice(0,10).map(r=>(
                  <tr key={r.implantId} style={{background:'rgba(239,68,68,0.03)'}}>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{r.implantId}</td>
                    <td style={{fontWeight:600,fontSize:12}}>{r.deviceName}</td>
                    <td style={{fontSize:11}}>🏥 {r.hospitalId}</td>
                    <td>
                      <span className={`badge ${SCORE_BADGE(r.score)}`}>{r.score}%</span>
                    </td>
                    <td>
                      <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                        {r.issues.map(k=>(
                          <span key={k} className="badge badge-red" style={{fontSize:9}}>
                            {CHECK_META[k]?.label||k}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table></div>
            </div>
          )}

          {summary.nonCompliant === 0 && (
            <div className="card" style={{borderColor:'rgba(16,185,129,0.3)'}}>
              <div style={{padding:32,textAlign:'center'}}>
                <div style={{fontSize:48,marginBottom:12}}>✅</div>
                <div style={{fontSize:20,fontWeight:700,color:'var(--accent-green)',marginBottom:8}}>
                  100% Compliant
                </div>
                <div style={{fontSize:14,color:'var(--text-secondary)'}}>
                  All {summary.total} implant records meet FDA UDI documentation requirements.
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ ALL RECORDS TAB ══ */}
      {tab==='records' && !loading && data && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">🔍 All Implant Records</span>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-ghost btn-sm"
                onClick={()=>exportCSV(filtered,`compliance-all-${today()}.csv`)}>
                ↓ Export CSV
              </button>
              <button className="btn btn-ghost btn-sm" onClick={load}>↻ Refresh</button>
            </div>
          </div>
          <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center',flexWrap:'wrap'}}>
            <input placeholder="🔍 Search implant ID, device, UDI..."
              value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,minWidth:200,maxWidth:320}}/>
            {hospitals.length > 1 && (
              <select value={hospFilter} onChange={e=>setHospFilter(e.target.value)} style={{minWidth:200}}>
                <option value="">All Hospitals</option>
                {hospitals.map(h=><option key={h} value={h}>{h}</option>)}
              </select>
            )}
            {(search||hospFilter) && (
              <button className="btn btn-ghost btn-sm" onClick={()=>{setSearch('');setHospFilter('');}}>✕ Clear</button>
            )}
            <span style={{fontSize:12,color:'var(--text-muted)'}}>{filtered.length} records</span>
          </div>
          <RecordsTable rows={filtered} />
        </div>
      )}

      {/* ══ ISSUES ONLY TAB ══ */}
      {tab==='issues' && !loading && data && (
        <div className="card" style={{borderColor:'rgba(239,68,68,0.3)'}}>
          <div className="card-header">
            <span className="card-title">
              ⚠ Non-Compliant Records
              <span className="badge badge-red" style={{marginLeft:8}}>{issues.length}</span>
            </span>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-ghost btn-sm"
                onClick={()=>exportCSV(issues,`compliance-issues-${today()}.csv`)}>
                ↓ Export CSV
              </button>
              <button className="btn btn-ghost btn-sm" onClick={load}>↻ Refresh</button>
            </div>
          </div>
          {issues.length === 0
            ? <div className="empty-state"><div className="icon">✅</div><p>No compliance issues found</p></div>
            : <>
                <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center',flexWrap:'wrap'}}>
                  <input placeholder="🔍 Search..." value={search} onChange={e=>setSearch(e.target.value)}
                    style={{flex:1,minWidth:200,maxWidth:320}}/>
                  {hospitals.length > 1 && (
                    <select value={hospFilter} onChange={e=>setHospFilter(e.target.value)} style={{minWidth:200}}>
                      <option value="">All Hospitals</option>
                      {hospitals.map(h=><option key={h} value={h}>{h}</option>)}
                    </select>
                  )}
                </div>
                <RecordsTable rows={issues} showIssues />
              </>
          }
        </div>
      )}
    </>
  );
}

function RecordsTable({ rows, showIssues }) {
  const [expanded, setExpanded] = useState(null);
  return (
    <div className="table-wrap"><table>
      <thead><tr>
        <th>Implant ID</th><th>Device</th><th>Category</th>
        <th>Hospital</th><th>Procedure Date</th><th>Status</th>
        <th>Score</th>
        {showIssues && <th>Failing Checks</th>}
        <th></th>
      </tr></thead>
      <tbody>{rows.map(r=>(
        <>
          <tr key={r.implantId}
            style={{cursor:'pointer',background:r.compliant?'transparent':'rgba(239,68,68,0.03)'}}
            onClick={()=>setExpanded(expanded===r.implantId?null:r.implantId)}>
            <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{r.implantId}</td>
            <td>
              <div style={{fontWeight:600,fontSize:12}}>{r.deviceName}</div>
              <div style={{fontSize:10,color:'var(--text-muted)'}}>{r.udiDI}</div>
            </td>
            <td><span className="badge badge-blue" style={{fontSize:10}}>{r.deviceCategory?.replace(/_/g,' ')}</span></td>
            <td style={{fontSize:11}}>🏥 {r.hospitalId}</td>
            <td style={{fontSize:11}}>{r.procedureDate}</td>
            <td><span className={`badge ${r.status==='implanted'?'badge-green':r.status==='explanted'?'badge-amber':'badge-red'}`} style={{fontSize:10}}>{r.status}</span></td>
            <td>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <div style={{width:36,height:36,borderRadius:'50%',border:`3px solid ${SCORE_COLOR(r.score)}`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:11,fontWeight:700,color:SCORE_COLOR(r.score)}}>
                  {r.score}
                </div>
              </div>
            </td>
            {showIssues && (
              <td>
                <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                  {r.issues.map(k=>(
                    <span key={k} className="badge badge-red" style={{fontSize:9}}>{CHECK_META[k]?.label||k}</span>
                  ))}
                </div>
              </td>
            )}
            <td style={{fontSize:12,color:'var(--text-muted)'}}>{expanded===r.implantId?'▲':'▼'}</td>
          </tr>
          {expanded===r.implantId && (
            <tr key={r.implantId+'-exp'}>
              <td colSpan={showIssues?9:8} style={{padding:0,background:'var(--bg-secondary)'}}>
                <div style={{padding:'16px 20px',borderLeft:'3px solid var(--accent-blue)'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--accent-blue)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>
                    Compliance Detail
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                    {Object.entries(CHECK_META).map(([key, meta])=>{
                      const val = r.checks[key];
                      const badge = val===null ? 'badge-blue' : val ? 'badge-green' : 'badge-red';
                      const text  = val===null ? 'N/A' : val ? '✓ Pass' : '✕ Fail';
                      return (
                        <div key={key} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                          padding:'6px 10px',background:'var(--bg-card)',borderRadius:'var(--radius-sm)',
                          border:`1px solid ${val===false?'rgba(239,68,68,0.3)':'var(--border)'}`}}>
                          <div>
                            <div style={{fontSize:11,fontWeight:600}}>{meta.label}</div>
                            <div style={{fontSize:10,color:'var(--text-muted)'}}>{meta.critical?'Critical':'Advisory'}</div>
                          </div>
                          <span className={`badge ${badge}`} style={{fontSize:10}}>{text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </td>
            </tr>
          )}
        </>
      ))}</tbody>
    </table></div>
  );
}

function today() { return new Date().toISOString().split('T')[0]; }
