import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const CC = {
  cardiac:         { bg:'rgba(59,130,246,0.06)',  border:'rgba(59,130,246,0.15)',  badge:'badge-blue',   label:'🫀 Cardiac' },
  general_surgery: { bg:'rgba(16,185,129,0.06)',  border:'rgba(16,185,129,0.15)',  badge:'badge-green',  label:'🟢 General Surgery' },
  neurosurgery:    { bg:'rgba(139,92,246,0.06)',  border:'rgba(139,92,246,0.15)',  badge:'badge-purple', label:'🧠 Neurosurgery' },
  orthopedic:      { bg:'rgba(245,158,11,0.06)',  border:'rgba(245,158,11,0.15)',  badge:'badge-amber',  label:'🦴 Orthopedic' },
};

async function sha256(text) {
  try {
    const data = new TextEncoder().encode(text.trim().toUpperCase());
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
  } catch { return ''; }
}

// ── Shared expandable implant row ──────────────────────────────────────────
function ImplantRow({ i, expanded, onToggle, showDraftMDR, onDraftMDR }) {
  const cat = CC[i.deviceCategory] || { bg:'transparent', border:'transparent', badge:'badge-blue' };
  return (
    <>
      <tr style={{cursor:'pointer', background: expanded ? 'var(--bg-secondary)' : cat.bg}}
        onClick={onToggle}>
        <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{i.implantId}</td>
        <td>
          <div style={{fontWeight:600,fontSize:12}}>{i.deviceName}</div>
          <div style={{fontSize:10,color:'var(--text-muted)'}}>{i.udiDI}</div>
        </td>
        <td><span className={`badge ${cat.badge}`}>{(i.deviceCategory||'').replace(/_/g,' ')}</span></td>
        <td style={{fontSize:11}}>{i.procedureType}</td>
        <td style={{fontSize:11}}>{i.bodyLocation}</td>
        <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{i.lotNumber}</td>
        <td style={{fontSize:11}}>{i.procedureDate}</td>
        <td style={{fontSize:11}}>🏥 {i.hospitalId}</td>
        <td>
          <span className={`badge ${i.status==='implanted'?'badge-green':i.status==='explanted'?'badge-amber':'badge-red'}`}>
            {i.status}
          </span>
        </td>
        <td style={{fontSize:12,color:'var(--text-muted)'}}>{expanded ? '▲' : '▼'}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={10} style={{padding:0,background:'var(--bg-secondary)'}}>
            <div style={{padding:'16px 20px',borderLeft:'3px solid var(--accent-blue)'}}>
              {/* Implant Details */}
              <div style={{fontSize:11,fontWeight:700,color:'var(--accent-blue)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>
                💊 Implant Details
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px 24px',marginBottom:12}}>
                {[
                  ['Implant ID',       i.implantId,             true],
                  ['UDI-DI',           i.udiDI,                 true],
                  ['UDI-PI',           i.udiPI || '—',          true],
                  ['Consignment ID',   i.consignmentId || '—',  true],
                  ['Lot Number',       i.lotNumber,             true],
                  ['Serial Number',    i.serialNumber || '—',   true],
                  ['Device Type',      i.deviceType || '—',     false],
                  ['Body Location',    i.bodyLocation,          false],
                  ['Procedure Type',   i.procedureType,         false],
                  ['Procedure Date',   i.procedureDate,         false],
                  ['Implanting Surgeon', i.surgeonId || '—',    false],
                  ['Hospital',         i.hospitalId,            false],
                  ['Rep / Distributor',i.repId || '—',          false],
                  ['Documented By',    i.documentedBy || '—',   false],
                  ['Status',           i.status,                false],
                  ['Adverse Event ID', i.adverseEventId || 'None', true],
                ].map(([label, val, mono]) => (
                  <div key={label}>
                    <div style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:2}}>{label}</div>
                    <div style={{fontSize:12,fontFamily:mono?'var(--font-mono)':'inherit',color:'var(--text-primary)'}}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Surgical Notes */}
              {i.notes && (
                <div style={{marginBottom:12,padding:'10px 14px',background:'var(--bg-card)',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)'}}>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>📝 Surgical Notes</div>
                  <div style={{fontSize:13,color:'var(--text-primary)',lineHeight:1.6}}>{i.notes}</div>
                </div>
              )}

              {/* Explant Details */}
              {i.status === 'explanted' && (
                <div style={{padding:'12px 14px',background:'rgba(245,158,11,0.06)',borderRadius:'var(--radius-sm)',border:'1px solid rgba(245,158,11,0.25)'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--accent-amber)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>
                    ↩ Explant Details
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px 24px'}}>
                    {[
                      ['Explant Date',      i.explantDate    || '—', false],
                      ['Explanting Surgeon',i.explantedBy    || '—', false],
                      ['Explant Reason',    i.explantReason  || '—', false],
                      ['Disposition',       i.disposition    || '—', false],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <div style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:2}}>{label}</div>
                        <div style={{fontSize:12,color:'var(--text-primary)'}}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MDR button if adverse event linked */}
              {showDraftMDR && i.adverseEventId && i.adverseEventId !== 'None' && (
                <div style={{marginTop:12}}>
                  <button className="btn btn-ghost btn-sm"
                    style={{color:'var(--accent-purple)',borderColor:'var(--accent-purple)'}}
                    onClick={(e)=>{ e.stopPropagation(); onDraftMDR(i.adverseEventId); }}>
                    🤖 Draft MDR for {i.adverseEventId}
                  </button>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function SurgeonPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('patients');

  // Data
  const [myImplants,     setMyImplants]     = useState([]);
  const [adverseEvents,  setAdverseEvents]  = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [aeLoading,      setAeLoading]      = useState(false);

  // Patient lookup
  const [patientSearch,  setPatientSearch]  = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [searchLoading,  setSearchLoading]  = useState(false);
  const [searchMsg,      setSearchMsg]      = useState(null);
  const [mriData,        setMriData]        = useState({}); // udiDI -> mriSafe

  // Expanded rows
  const [expanded, setExpanded] = useState(null);

  // MDR modal (same as NursePage)
  const [mdrModal,  setMdrModal]  = useState(null);
  const [mdrBusy,   setMdrBusy]   = useState(false);
  const [mdrDraft,  setMdrDraft]  = useState('');

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('');
  const [hospitalFilter, setHospitalFilter] = useState('');
  const [statusFilter,   setStatusFilter]   = useState('');
  const [search,         setSearch]         = useState('');

  const today = new Date().toISOString().split('T')[0];

  // ── Load my patients ──────────────────────────────────────────
  const loadMyImplants = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getImplantsBySurgeon(user?.username);
      const implants = Array.isArray(data) ? data : [];
      setMyImplants(implants);

      // Load adverse events for these implants in the same call
      // avoids stale closure issue with separate loadAdverseEvents
      if (implants.length > 0) {
        try {
          const ids = new Set(implants.map(i => i.implantId));
          console.log('[Doctor] implant IDs:', [...ids]);
          const ae  = await api.getAdverseEvents();
          console.log('[Doctor] AE from API:', ae);
          const filtered = (Array.isArray(ae) ? ae : []).filter(e => ids.has(e.implantId));
          console.log('[Doctor] filtered AE:', filtered);
          setAdverseEvents(filtered);
        } catch (err) { console.error('[Doctor] AE error:', err); }
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [user]);

  // ── Refresh adverse events only (called by Refresh button) ─────
  const loadAdverseEvents = useCallback(async () => {
    setAeLoading(true);
    try {
      const ids  = new Set(myImplants.map(i => i.implantId));
      const data = await api.getAdverseEvents();
      setAdverseEvents((Array.isArray(data) ? data : []).filter(e => ids.has(e.implantId)));
    } catch {}
    setAeLoading(false);
  }, [myImplants]);

  useEffect(() => { loadMyImplants(); }, [loadMyImplants]);

  // ── Patient lookup ─────────────────────────────────────────────
  const searchPatient = async () => {
    if (!patientSearch.trim()) return;
    setSearchLoading(true); setSearchMsg(null); setPatientResults([]); setMriData({});
    try {
      const hash = await sha256(patientSearch.trim());
      const results = await api.getImplantsByPatientHash(hash);
      setPatientResults(results || []);
      setSearchMsg({
        type: results?.length > 0 ? 'success' : 'amber',
        text: results?.length > 0
          ? `Found ${results.length} implant record${results.length!==1?'s':''} for ${patientSearch}`
          : `No implant records found for ${patientSearch}`,
      });
      if (results?.length > 0) {
        const uniqueUDIs = [...new Set(results.map(i => i.udiDI).filter(Boolean))];
        const mriMap = {};
        await Promise.all(uniqueUDIs.map(async udiDI => {
          try {
            const device = await api.getDevice(encodeURIComponent(udiDI));
            mriMap[udiDI] = device?.mriSafe || 'conditional';
          } catch { mriMap[udiDI] = 'conditional'; }
        }));
        setMriData(mriMap);
      }
    } catch (err) { setSearchMsg({ type:'error', text: err.message }); }
    setSearchLoading(false);
  };

  // ── MDR Draft ─────────────────────────────────────────────────
  const draftMDR = async (event) => {
    setMdrModal(event);
    setMdrDraft('');
    setMdrBusy(true);
    try {
      let enriched = { ...event };
      try {
        const history = await api.getImplantHistory(event.implantId);
        if (history?.length > 0) {
          const implant = history.find(h => h.value)?.value || {};
          enriched = { ...enriched, serialNumber: implant.serialNumber||'',
            procedureDate: implant.procedureDate||'', surgeonId: implant.surgeonId||'',
            bodyLocation: implant.bodyLocation||'', procedureType: implant.procedureType||'',
            udiDI: implant.udiDI || event.udiDI || '' };
          const consignmentId = implant.consignmentId || '';
          if (consignmentId) {
            try {
              const cHistory = await api.getConsignmentHistory(consignmentId);
              const cons = cHistory?.find(h=>h.value)?.value || {};
              enriched.expiryDate = cons.expiryDate || '';
              const lotId = cons.lotId || '';
              if (lotId) {
                try {
                  const lotH = await api.getLotHistory(lotId);
                  const lot  = lotH?.find(h=>h.value)?.value || {};
                  enriched.manufacturerId = lot.manufacturerId || '';
                  enriched.expiryDate     = lot.expiryDate || enriched.expiryDate;
                  const udiDI = enriched.udiDI || lot.udiDI || '';
                  if (udiDI) {
                    try {
                      const device = await api.getDevice(encodeURIComponent(udiDI));
                      enriched.modelNum = device?.modelNumber || '';
                    } catch {}
                  }
                } catch {}
              }
            } catch {}
          }
        }
      } catch {}
      setMdrModal(enriched);

      const prompt = `You are an FDA regulatory affairs specialist. Write ONLY the clinical narrative for Section B.5 "Describe Event or Problem" of FDA Form 3500A MedWatch. 150-250 words, factual, regulatory-compliant.

Event data:
- Device: ${enriched.deviceName}
- Lot: ${enriched.lotNumber || 'Unknown'}
- Serial: ${enriched.serialNumber || 'Not tracked'}
- Event Type: ${enriched.eventType?.replace(/_/g,' ')}
- Event Date: ${enriched.eventDate}
- Procedure Date: ${enriched.procedureDate || 'Unknown'}
- Body Location: ${enriched.bodyLocation || 'Unknown'}
- Procedure Type: ${enriched.procedureType || 'Unknown'}
- Hospital: ${enriched.hospitalId}
- Description: ${enriched.description || 'No additional description'}

Write only the narrative. No headers, no bullets. Third person past tense.`;

      const resp = await fetch('/api/ai/complete', {
        method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ prompt, maxTokens: 400 }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'AI failed');
      setMdrDraft(data.text || '');
    } catch { setMdrDraft(''); }
    setMdrBusy(false);
  };

  const printMDR = async (event, narrative) => {
    try {
      const resp = await fetch('/api/ai/mdr-pdf', {
        method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          narrative, eventDate: event.eventDate,
          today: new Date().toISOString().split('T')[0],
          deviceName: event.deviceName, lotNumber: event.lotNumber,
          hospitalId: event.hospitalId, eventId: event.eventId,
          eventType: event.eventType, reportedToFDA: event.reportedToFDA,
          implantId: event.implantId, description: event.description,
          manufacturerId: event.manufacturerId||'', udiDI: event.udiDI||'',
          serialNumber: event.serialNumber||'', expiryDate: event.expiryDate||'',
          procedureDate: event.procedureDate||'', modelNum: event.modelNum||'',
        }),
      });
      if (!resp.ok) { const e = await resp.json().catch(()=>({})); throw new Error(e.error||'Failed'); }
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      const win  = window.open(url, '_blank');
      if (!win) { const a=document.createElement('a'); a.href=url; a.download=`FDA-3500A-${event.eventId}.pdf`; a.click(); }
      setTimeout(()=>URL.revokeObjectURL(url), 300000);
    } catch (err) { alert('PDF failed: ' + err.message); }
  };

  // ── Derived ────────────────────────────────────────────────────
  const MRIAlert = ({ implants, mriMap }) => {
    const active = implants.filter(i => i.status === 'implanted');
    if (!active.length || !Object.keys(mriMap).length) return null;
    const statuses = active.map(i => mriMap[i.udiDI] || 'conditional');
    const worst = statuses.includes('unsafe') ? 'unsafe'
      : statuses.includes('conditional') ? 'conditional' : 'safe';
    const cfg = {
      unsafe:      { bg:'rgba(239,68,68,0.12)',  border:'rgba(239,68,68,0.4)',  color:'var(--accent-red)',
                     icon:'🔴', title:'MRI UNSAFE',
                     sub:'One or more implants must NEVER be placed in an MRI scanner.' },
      conditional: { bg:'rgba(245,158,11,0.10)', border:'rgba(245,158,11,0.4)', color:'var(--accent-amber)',
                     icon:'🟡', title:'MRI CONDITIONAL',
                     sub:'One or more implants have MRI conditions. Verify device-specific requirements before scanning.' },
      safe:        { bg:'rgba(16,185,129,0.08)', border:'rgba(16,185,129,0.3)', color:'var(--accent-green)',
                     icon:'✅', title:'MRI SAFE',
                     sub:'All active implants are MRI safe.' },
    }[worst];
    return (
      <div style={{padding:'14px 18px',background:cfg.bg,border:`2px solid ${cfg.border}`,
        borderRadius:'var(--radius-md)',marginBottom:14}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
          <span style={{fontSize:22}}>{cfg.icon}</span>
          <span style={{fontSize:16,fontWeight:800,color:cfg.color,letterSpacing:'0.05em'}}>{cfg.title}</span>
        </div>
        <div style={{fontSize:13,color:'var(--text-primary)',marginBottom:8}}>{cfg.sub}</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
          {active.map(i => {
            const mri = mriMap[i.udiDI] || 'conditional';
            const badge = mri==='unsafe'?'badge-red':mri==='conditional'?'badge-amber':'badge-green';
            return (
              <div key={i.implantId} style={{display:'flex',alignItems:'center',gap:6,
                padding:'4px 10px',background:'var(--bg-card)',borderRadius:'var(--radius-sm)',
                border:'1px solid var(--border)',fontSize:12}}>
                <span style={{fontWeight:600}}>{i.deviceName}</span>
                <span className={`badge ${badge}`} style={{fontSize:10}}>{mri}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const tabStyle = (t) => ({
    padding:'8px 16px', borderRadius:'var(--radius-sm)', cursor:'pointer',
    fontSize:13, fontWeight:600, border:'none',
    background: tab===t ? 'var(--accent-blue)' : 'transparent',
    color: tab===t ? '#fff' : 'var(--text-secondary)',
  });

  const filteredImplants = myImplants.filter(i => {
    if (categoryFilter && i.deviceCategory !== categoryFilter) return false;
    if (hospitalFilter && i.hospitalId !== hospitalFilter) return false;
    if (statusFilter   && i.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (i.deviceName||'').toLowerCase().includes(q) ||
             (i.implantId||'').toLowerCase().includes(q) ||
             (i.lotNumber||'').toLowerCase().includes(q);
    }
    return true;
  });

  const hospitals  = [...new Set(myImplants.map(i=>i.hospitalId))].sort();
  const categories = [...new Set(myImplants.map(i=>i.deviceCategory))].sort();

  // Analytics
  const totalProcedures = myImplants.length;
  const activeImplants  = myImplants.filter(i=>i.status==='implanted').length;
  const explanted       = myImplants.filter(i=>i.status==='explanted').length;
  const withAE          = myImplants.filter(i=>i.adverseEventId).length;

  const byCategory = categories.reduce((acc, cat) => {
    acc[cat] = myImplants.filter(i=>i.deviceCategory===cat).length;
    return acc;
  }, {});

  const byHospital = hospitals.reduce((acc, h) => {
    acc[h] = myImplants.filter(i=>i.hospitalId===h).length;
    return acc;
  }, {});

  const implantTable = (implants, colSpan=10) => (
    <div className="table-wrap"><table>
      <thead><tr>
        <th>Implant ID</th><th>Device</th><th>Category</th><th>Procedure</th>
        <th>Body Location</th><th>Lot #</th><th>Date</th><th>Hospital</th>
        <th>Status</th><th></th>
      </tr></thead>
      <tbody>{(() => {
        let lastCat = null;
        return implants.map(i => {
          const cat    = CC[i.deviceCategory]||{border:'transparent',label:i.deviceCategory};
          const newCat = i.deviceCategory !== lastCat;
          lastCat = i.deviceCategory;
          return (
            <>
              {newCat && (
                <tr key={'cat-'+i.deviceCategory+i.implantId}>
                  <td colSpan={colSpan} style={{padding:'6px 12px',
                    background:cat.border,borderTop:'2px solid '+cat.border,
                    fontSize:11,fontWeight:700,color:'var(--text-secondary)',
                    textTransform:'uppercase',letterSpacing:'0.08em',fontFamily:'var(--font-mono)'}}>
                    {cat.label || i.deviceCategory}
                  </td>
                </tr>
              )}
              <ImplantRow key={i.implantId} i={i}
                expanded={expanded===i.implantId}
                onToggle={()=>setExpanded(expanded===i.implantId?null:i.implantId)}
                showDraftMDR={true}
                onDraftMDR={async (aeId) => {
                  const ae = adverseEvents.find(e=>e.eventId===aeId);
                  if (ae) draftMDR(ae);
                  else {
                    // Construct minimal event from implant data
                    draftMDR({ eventId: aeId, implantId: i.implantId,
                      deviceName: i.deviceName, lotNumber: i.lotNumber,
                      hospitalId: i.hospitalId, eventType: 'malfunction',
                      eventDate: today, reportedToFDA: false });
                  }
                }}/>
            </>
          );
        });
      })()}</tbody>
    </table></div>
  );

  return (
    <>
      <div className="page-header">
        <h2>🔪 Surgeon Portal</h2>
        <p>
          {user?.username}
          {user?.fullName ? ` — ${user.fullName}` : ''}
          {' '}· Your surgical cases, patient implant history, and adverse events
        </p>
      </div>

      {/* KPI strip */}
      <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:16}}>
        {[
          { label:'Total Procedures',  value:totalProcedures, color:'blue'   },
          { label:'Active Implants',   value:activeImplants,  color:'green'  },
          { label:'Explanted',         value:explanted,       color:'amber'  },
          { label:'Adverse Events',    value:withAE,          color:'red'    },
        ].map(({label,value,color})=>(
          <div key={label} className={`kpi-card ${color}`}>
            <div className="kpi-label">{label}</div>
            <div className="kpi-value" style={{color:`var(--accent-${color})`}}>
              {loading ? '—' : value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{display:'flex',gap:4,marginBottom:20,background:'var(--bg-card)',
        padding:4,borderRadius:'var(--radius-md)',width:'fit-content',
        border:'1px solid var(--border)'}}>
        <button style={tabStyle('patients')} onClick={()=>setTab('patients')}>🩺 My Patients</button>
        <button style={tabStyle('lookup')}   onClick={()=>setTab('lookup')}>👤 Patient Lookup</button>
        <button style={tabStyle('adverse')}  onClick={()=>setTab('adverse')}>
          ⚠ Adverse Events
          {withAE > 0 && <span className="badge badge-red" style={{marginLeft:6}}>{withAE}</span>}
        </button>
        <button style={tabStyle('analytics')} onClick={()=>setTab('analytics')}>📊 Analytics</button>
      </div>

      {/* MDR Modal */}
      {mdrModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1000,
          display:'flex',alignItems:'center',justifyContent:'center',padding:24}}
          onClick={()=>{ if(!mdrBusy) setMdrModal(null); }}>
          <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',
            borderRadius:'var(--radius-lg)',padding:28,width:'min(520px,100%)'}}
            onClick={e=>e.stopPropagation()}>
            <h3 style={{marginBottom:4}}>🤖 AI MDR Draft — {mdrModal.eventId}</h3>
            <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:16}}>
              {mdrModal.deviceName} · {mdrModal.eventType?.replace(/_/g,' ')} · {mdrModal.eventDate}
            </div>
            {mdrBusy ? (
              <div style={{display:'flex',alignItems:'center',gap:12,padding:'24px 0',color:'var(--text-muted)'}}>
                <span className="spinner" style={{width:20,height:20}}/>
                <span>Generating FDA 3500A narrative…</span>
              </div>
            ) : (
              <>
                <div className="alert alert-info" style={{marginBottom:16,fontSize:12}}>
                  ℹ AI pre-fills known fields. Opens in new tab — complete remaining fields then print or save as PDF.
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button className="btn btn-primary" style={{flex:1}}
                    onClick={()=>printMDR(mdrModal, mdrDraft)}>
                    ⬇ Download Pre-filled FDA 3500A PDF
                  </button>
                  <button className="btn btn-ghost" onClick={()=>setMdrModal(null)}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ MY PATIENTS TAB ══════════════════════════════════════════ */}
      {tab === 'patients' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              🩺 My Patients
              <span className="badge badge-blue" style={{marginLeft:8}}>{myImplants.length} records</span>
            </span>
            <button className="btn btn-ghost btn-sm" onClick={loadMyImplants}>↻ Refresh</button>
          </div>

          {/* Filters */}
          <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
            <input placeholder="🔍 Search device, implant ID, lot..."
              value={search} onChange={e=>setSearch(e.target.value)}
              style={{flex:1,minWidth:200,maxWidth:300}}/>
            <select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)} style={{minWidth:150}}>
              <option value="">All Categories</option>
              {categories.map(c=><option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
            </select>
            <select value={hospitalFilter} onChange={e=>setHospitalFilter(e.target.value)} style={{minWidth:180}}>
              <option value="">All Hospitals</option>
              {hospitals.map(h=><option key={h} value={h}>{h}</option>)}
            </select>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{minWidth:130}}>
              <option value="">All Statuses</option>
              <option value="implanted">Implanted</option>
              <option value="explanted">Explanted</option>
              <option value="recalled_in_situ">Recalled In Situ</option>
            </select>
            {(search||categoryFilter||hospitalFilter||statusFilter) && (
              <button className="btn btn-ghost btn-sm"
                onClick={()=>{setSearch('');setCategoryFilter('');setHospitalFilter('');setStatusFilter('');}}>
                ✕ Clear
              </button>
            )}
            <span style={{fontSize:12,color:'var(--text-muted)'}}>
              {filteredImplants.length} of {myImplants.length}
            </span>
          </div>

          {loading
            ? <div className="loading-overlay"><span className="spinner"/></div>
            : myImplants.length === 0
              ? <div className="empty-state"><div className="icon">🩺</div>
                  <p>No implant records found for your surgeon ID</p>
                  <p style={{fontSize:12}}>Records appear here when your surgeon ID is set on implant records</p>
                </div>
              : filteredImplants.length === 0
                ? <div className="empty-state"><div className="icon">🔍</div>
                    <p>No records match the current filters</p>
                  </div>
                : implantTable(filteredImplants)
          }
          <p style={{fontSize:11,color:'var(--text-muted)',marginTop:8}}>
            Click any row to expand full implant details including surgical notes and explant information
          </p>
        </div>
      )}

      {/* ══ PATIENT LOOKUP TAB ══════════════════════════════════════ */}
      {tab === 'lookup' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">👤 Patient Lookup</span>
            <span className="badge badge-blue">Full patient implant history</span>
          </div>
          <div className="alert alert-info" style={{marginBottom:16,fontSize:12}}>
            ℹ Shows all implants for the patient regardless of surgeon — essential for pre-operative assessment.
            Patient MRNs are hashed before searching — no plain-text MRNs are stored on the blockchain.
          </div>
          <div style={{display:'flex',gap:12,marginBottom:16,alignItems:'flex-end'}}>
            <div className="form-group" style={{flex:1,marginBottom:0}}>
              <label>Patient MRN</label>
              <input placeholder="e.g. MRN-123456" value={patientSearch}
                onChange={e=>setPatientSearch(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&searchPatient()}/>
            </div>
            <button className="btn btn-primary" onClick={searchPatient}
              disabled={searchLoading||!patientSearch.trim()}>
              {searchLoading ? <span className="spinner" style={{width:14,height:14}}/> : '🔍 Search'}
            </button>
          </div>

          {searchMsg && (
            <div className={`alert alert-${searchMsg.type}`} style={{marginBottom:12}}>
              {searchMsg.text}
            </div>
          )}

          <MRIAlert implants={patientResults} mriMap={mriData} />

          {patientResults.length > 0 && implantTable(
            [...patientResults].sort((a,b)=>
              (a.deviceCategory||'').localeCompare(b.deviceCategory||'')||
              (a.procedureDate||'').localeCompare(b.procedureDate||'')
            )
          )}
        </div>
      )}

      {/* ══ ADVERSE EVENTS TAB ══════════════════════════════════════ */}
      {tab === 'adverse' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              ⚠ Adverse Events — My Patients
              <span className="badge badge-red" style={{marginLeft:8}}>{adverseEvents.length}</span>
            </span>
            <button className="btn btn-ghost btn-sm" onClick={loadAdverseEvents}>
              {aeLoading ? <span className="spinner" style={{width:12,height:12}}/> : '↻ Refresh'}
            </button>
          </div>
          <div className="alert alert-info" style={{marginBottom:12,fontSize:12}}>
            ℹ Showing adverse events for implants you performed. FDA 21 CFR Part 803 requires mandatory
            reporting within 30 days of serious injury or death.
          </div>

          {aeLoading
            ? <div className="loading-overlay"><span className="spinner"/></div>
            : adverseEvents.length === 0
              ? <div className="empty-state"><div className="icon">✅</div>
                  <p>No adverse events recorded for your patients</p>
                </div>
              : <div className="table-wrap"><table>
                  <thead><tr>
                    <th>Event ID</th><th>Implant ID</th><th>Device</th><th>Type</th>
                    <th>Date</th><th>Hospital</th><th>Reported to FDA</th><th>Status</th><th>Actions</th>
                  </tr></thead>
                  <tbody>{adverseEvents.map(e=>(
                    <tr key={e.eventId}>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{e.eventId}</td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{e.implantId}</td>
                      <td style={{fontWeight:600,fontSize:12}}>{e.deviceName}</td>
                      <td>
                        <span className={`badge ${e.eventType==='death'?'badge-red':e.eventType==='serious_injury'?'badge-amber':'badge-blue'}`}>
                          {e.eventType?.replace(/_/g,' ')}
                        </span>
                      </td>
                      <td style={{fontSize:11}}>{e.eventDate}</td>
                      <td style={{fontSize:11}}>🏥 {e.hospitalId}</td>
                      <td>
                        <span className={`badge ${e.reportedToFDA?'badge-green':'badge-red'}`}>
                          {e.reportedToFDA ? '✓ Yes' : '✕ No'}
                        </span>
                      </td>
                      <td><span className={`badge ${e.status==='open'?'badge-amber':'badge-green'}`}>{e.status}</span></td>
                      <td>
                        <button className="btn btn-ghost btn-sm"
                          style={{color:'var(--accent-purple)',borderColor:'var(--accent-purple)',whiteSpace:'nowrap'}}
                          onClick={()=>draftMDR(e)}>
                          🤖 Draft MDR
                        </button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table></div>
          }
        </div>
      )}

      {/* ══ ANALYTICS TAB ═══════════════════════════════════════════ */}
      {tab === 'analytics' && (
        <>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>

            {/* By Category */}
            <div className="card">
              <div className="card-header"><span className="card-title">Procedures by Category</span></div>
              {categories.length === 0
                ? <div className="empty-state"><div className="icon">📊</div><p>No data</p></div>
                : <div className="table-wrap"><table>
                    <thead><tr><th>Category</th><th>Procedures</th><th>%</th></tr></thead>
                    <tbody>{categories.map(cat=>{
                      const cnt = byCategory[cat] || 0;
                      const pct = totalProcedures > 0 ? Math.round((cnt/totalProcedures)*100) : 0;
                      const c   = CC[cat]||{badge:'badge-blue'};
                      return (
                        <tr key={cat}>
                          <td><span className={`badge ${c.badge}`}>{cat.replace(/_/g,' ')}</span></td>
                          <td style={{fontWeight:600}}>{cnt}</td>
                          <td>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <div style={{flex:1,height:6,background:'var(--border)',borderRadius:3,overflow:'hidden'}}>
                                <div style={{width:`${pct}%`,height:'100%',background:'var(--accent-blue)',borderRadius:3}}/>
                              </div>
                              <span style={{fontSize:11,color:'var(--text-muted)',minWidth:30}}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}</tbody>
                  </table></div>
              }
            </div>

            {/* By Hospital */}
            <div className="card">
              <div className="card-header"><span className="card-title">Procedures by Hospital</span></div>
              {hospitals.length === 0
                ? <div className="empty-state"><div className="icon">🏥</div><p>No data</p></div>
                : <div className="table-wrap"><table>
                    <thead><tr><th>Hospital</th><th>Procedures</th><th>%</th></tr></thead>
                    <tbody>{hospitals.map(h=>{
                      const cnt = byHospital[h] || 0;
                      const pct = totalProcedures > 0 ? Math.round((cnt/totalProcedures)*100) : 0;
                      return (
                        <tr key={h}>
                          <td style={{fontSize:12}}>🏥 {h}</td>
                          <td style={{fontWeight:600}}>{cnt}</td>
                          <td>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <div style={{flex:1,height:6,background:'var(--border)',borderRadius:3,overflow:'hidden'}}>
                                <div style={{width:`${pct}%`,height:'100%',background:'var(--accent-green)',borderRadius:3}}/>
                              </div>
                              <span style={{fontSize:11,color:'var(--text-muted)',minWidth:30}}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}</tbody>
                  </table></div>
              }
            </div>
          </div>

          {/* Recent procedures timeline */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Procedures</span>
              <span className="badge badge-blue">{myImplants.length} total</span>
            </div>
            {myImplants.length === 0
              ? <div className="empty-state"><div className="icon">📅</div><p>No procedures recorded</p></div>
              : implantTable(
                  [...myImplants].sort((a,b)=>(b.procedureDate||'').localeCompare(a.procedureDate||'')).slice(0,20)
                )
            }
            {myImplants.length > 20 && (
              <p style={{fontSize:12,color:'var(--text-muted)',marginTop:8,textAlign:'center'}}>
                Showing 20 most recent — use My Patients tab to see all
              </p>
            )}
          </div>
        </>
      )}
    </>
  );
}
