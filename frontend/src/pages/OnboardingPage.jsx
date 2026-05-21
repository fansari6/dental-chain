import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const PHASE_CONFIG = {
  1: { label:'Phase 1 — System Setup',  sub:'Days 1–2', color:'var(--accent-blue)',   bg:'rgba(59,130,246,0.06)'  },
  2: { label:'Phase 2 — Vendor Setup',  sub:'Days 2–3', color:'var(--accent-purple)', bg:'rgba(139,92,246,0.06)' },
  3: { label:'Phase 3 — Go-Live',       sub:'Days 4–7', color:'var(--accent-green)',  bg:'rgba(16,185,129,0.06)' },
};

const STATUS_CONFIG = {
  ready:       { badge:'badge-green', label:'✅ Ready'       },
  in_progress: { badge:'badge-amber', label:'🔄 In Progress' },
  not_started: { badge:'badge-red',   label:'⬜ Not Started' },
};

const ADMIN_CAN_NAVIGATE = ['/admin', '/audit', '/compliance', '/cases', '/onboarding'];

function CircleProgress({ pct, size=64, stroke=6 }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const color = pct === 100 ? 'var(--accent-green)' : pct >= 50 ? 'var(--accent-amber)' : 'var(--accent-red)';
  return (
    <svg width={size} height={size} style={{ transform:'rotate(-90deg)', flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition:'stroke-dashoffset 0.5s ease' }}/>
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        style={{ transform:`rotate(90deg)`, transformOrigin:`${size/2}px ${size/2}px`,
          fontSize:14, fontWeight:700, fill:color, fontFamily:'var(--font-mono)' }}>
        {pct}%
      </text>
    </svg>
  );
}

function HintModal({ item, onClose }) {
  if (!item) return null;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
      onClick={onClose}>
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)',
        borderRadius:'var(--radius-lg)', padding:28, width:'min(480px,100%)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:16, fontWeight:700, marginBottom:12 }}>ℹ {item.label}</div>
        <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:16, lineHeight:1.7 }}>
          {item.hint}
        </div>
        <div style={{ padding:'10px 14px', background:'rgba(245,158,11,0.08)',
          borderRadius:'var(--radius-sm)', border:'1px solid rgba(245,158,11,0.3)',
          fontSize:12, color:'var(--accent-amber)', marginBottom:20 }}>
          ⚠ This step requires a specific role to complete. Share these instructions with the relevant user.
        </div>
        <button className="btn btn-primary" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [data,      setData]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [expanded,  setExpanded]  = useState({});
  const [modalItem, setModalItem] = useState(null);

  const load = () => {
    setLoading(true);
    api.getOnboarding()
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const toggle = name => setExpanded(e => ({ ...e, [name]: e[name] === false ? true : false }));

  const handleItemClick = (item) => {
    if (item.done) return;
    if (ADMIN_CAN_NAVIGATE.includes(item.link)) {
      navigate(item.link);
    } else {
      setModalItem(item);
    }
  };

  const exportCSV = () => {
    if (!data.length) return;
    const rows = [['Hospital','Status','Setup %','Section','Item','Done','Detail']];
    for (const h of data) {
      for (const item of h.checklist) {
        rows.push([h.hospital.name, h.status, h.pct+'%', 'Setup', item.label, item.done?'Yes':'No', item.detail||'']);
      }
      for (const item of (h.adoption||[])) {
        rows.push([h.hospital.name, h.status, h.pct+'%', 'Adoption', item.label, item.done?'Yes':'No', item.detail||'']);
      }
    }
    const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv' }));
    a.download = 'onboarding-' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
  };

  const totalReady    = data.filter(h => h.status === 'ready').length;
  const totalInProg   = data.filter(h => h.status === 'in_progress').length;
  const totalNotStart = data.filter(h => h.status === 'not_started').length;
  const overallPct    = data.length > 0 ? Math.round(data.reduce((s,h)=>s+h.pct,0)/data.length) : 0;

  return (
    <>
      <div className="page-header">
        <h2>🏥 Hospital Onboarding Checklist</h2>
        <p>Track each hospital's readiness for go-live — target: fully operational within 7 days</p>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom:12 }}>⚠ {error}</div>}

      <HintModal item={modalItem} onClose={() => setModalItem(null)} />

      {!loading && data.length > 0 && (
        <>
          <div className="kpi-grid" style={{ gridTemplateColumns:'repeat(4,1fr)', marginBottom:16 }}>
            {[
              { label:'Overall Setup Progress', value:overallPct+'%', color:'blue'  },
              { label:'Fully Ready',             value:totalReady,    color:'green' },
              { label:'In Progress',             value:totalInProg,   color:'amber' },
              { label:'Not Started',             value:totalNotStart, color:'red'   },
            ].map(k => (
              <div key={k.label} className={'kpi-card ' + k.color}>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value" style={{ color:'var(--accent-'+k.color+')' }}>{k.value}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginBottom:12 }}>
            <button className="btn btn-ghost btn-sm" onClick={load}>↻ Refresh</button>
            <button className="btn btn-ghost btn-sm" onClick={exportCSV}>↓ Export CSV</button>
          </div>
        </>
      )}

      {loading && <div className="loading-overlay"><span className="spinner"/> Loading onboarding status…</div>}

      {!loading && data.map(h => {
        const sc = STATUS_CONFIG[h.status] || STATUS_CONFIG.not_started;
        const isExpanded = expanded[h.hospital.name] !== false;
        const adoption = h.adoption || [];
        const adoptionDone = adoption.filter(i=>i.done).length;

        return (
          <div key={h.hospital.name} className="card" style={{ marginBottom:16,
            borderLeft:`4px solid ${h.pct===100?'var(--accent-green)':h.pct>=50?'var(--accent-amber)':'var(--accent-red)'}` }}>

            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', gap:16, cursor:'pointer', padding:'4px 0' }}
              onClick={() => toggle(h.hospital.name)}>
              <CircleProgress pct={h.pct} />
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4, flexWrap:'wrap' }}>
                  <span style={{ fontSize:18, fontWeight:700 }}>🏥 {h.hospital.name}</span>
                  <span className={'badge ' + sc.badge}>{sc.label}</span>
                  <span style={{ fontSize:12, color:'var(--text-muted)' }}>{h.doneItems}/{h.totalItems} setup complete</span>
                  {adoptionDone > 0 && (
                    <span className="badge badge-blue" style={{ fontSize:11 }}>
                      {adoptionDone}/{adoption.length} in active use
                    </span>
                  )}
                </div>
                <div style={{ fontSize:12, color:'var(--text-secondary)' }}>
                  {h.hospital.address || '—'}
                  {h.implantCount > 0 && <span style={{ marginLeft:16 }}>💊 {h.implantCount} implants · UDI {h.udiRate}%</span>}
                  {h.consignmentCount > 0 && <span style={{ marginLeft:16 }}>📦 {h.consignmentCount} consignments</span>}
                </div>
                <div style={{ marginTop:8, height:6, background:'var(--border)', borderRadius:3, overflow:'hidden', maxWidth:400 }}>
                  <div style={{ width:h.pct+'%', height:'100%', borderRadius:3, transition:'width 0.5s ease',
                    background:h.pct===100?'var(--accent-green)':h.pct>=50?'var(--accent-amber)':'var(--accent-red)' }}/>
                </div>
              </div>
              <span style={{ fontSize:14, color:'var(--text-muted)' }}>{isExpanded ? '▲' : '▼'}</span>
            </div>

            {/* Setup checklist */}
            {isExpanded && (
              <>
                <div style={{ marginTop:16, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
                  {[1,2,3].map(phase => {
                    const pc = PHASE_CONFIG[phase];
                    const items = h.checklist.filter(i => i.phase === phase);
                    const phaseDone = items.filter(i=>i.done).length;
                    const phasePct  = Math.round((phaseDone/items.length)*100);
                    return (
                      <div key={phase} style={{ padding:'14px 16px', background:pc.bg,
                        borderRadius:'var(--radius-md)', border:`1px solid ${pc.color}30` }}>
                        <div style={{ marginBottom:10 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:pc.color }}>{pc.label}</div>
                          <div style={{ fontSize:11, color:'var(--text-muted)' }}>{pc.sub} · {phaseDone}/{items.length}</div>
                          <div style={{ marginTop:6, height:4, background:'var(--border)', borderRadius:2, overflow:'hidden' }}>
                            <div style={{ width:phasePct+'%', height:'100%', background:pc.color, borderRadius:2, transition:'width 0.5s' }}/>
                          </div>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                          {items.map(item => (
                            <div key={item.id}
                              onClick={() => handleItemClick(item)}
                              title={item.done ? 'Complete' : item.hint}
                              style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'8px 10px',
                                background:'var(--bg-card)', borderRadius:'var(--radius-sm)',
                                border:`1px solid ${item.done?'rgba(16,185,129,0.2)':'var(--border)'}`,
                                cursor:item.done?'default':'pointer', transition:'border-color 0.15s' }}
                              onMouseEnter={e => { if(!item.done) e.currentTarget.style.borderColor=pc.color; }}
                              onMouseLeave={e => { if(!item.done) e.currentTarget.style.borderColor='var(--border)'; }}>
                              <span style={{ fontSize:16, flexShrink:0, marginTop:1 }}>{item.done?'✅':'⬜'}</span>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:12, fontWeight:item.done?500:600,
                                  color:item.done?'var(--text-secondary)':'var(--text-primary)' }}>
                                  {item.label}
                                </div>
                                {item.detail && (
                                  <div style={{ fontSize:10, color:'var(--accent-green)', marginTop:2 }}>{item.detail}</div>
                                )}
                                {!item.done && (
                                  <div style={{ fontSize:10, color:pc.color, marginTop:2, fontWeight:600 }}>
                                    {ADMIN_CAN_NAVIGATE.includes(item.link) ? '→ Fix this' : 'ℹ requires another role →'}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Adoption tracking — informational */}
                {adoption.length > 0 && (
                  <div style={{ marginTop:16, padding:'14px 16px',
                    background:'rgba(100,116,139,0.05)', borderRadius:'var(--radius-md)',
                    border:'1px solid rgba(100,116,139,0.15)' }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)',
                      textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>
                      📊 Adoption Tracking — informational only
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                      {adoption.map(item => (
                        <div key={item.id} style={{ display:'flex', alignItems:'center', gap:8,
                          padding:'8px 10px', background:'var(--bg-card)', borderRadius:'var(--radius-sm)',
                          border:'1px solid var(--border)' }}>
                          <span style={{ fontSize:16 }}>{item.done ? '✅' : '⬜'}</span>
                          <div>
                            <div style={{ fontSize:12, color:item.done?'var(--text-secondary)':'var(--text-muted)' }}>
                              {item.label}
                            </div>
                            {item.detail && (
                              <div style={{ fontSize:10, color:'var(--accent-green)', marginTop:1 }}>{item.detail}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {h.status === 'ready' && (
                  <div style={{ marginTop:12, padding:'10px 16px', background:'rgba(16,185,129,0.08)',
                    borderRadius:'var(--radius-sm)', border:'1px solid rgba(16,185,129,0.3)',
                    fontSize:13, color:'var(--accent-green)', fontWeight:600, textAlign:'center' }}>
                    ✅ {h.hospital.name} is fully set up and ready for go-live
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      {!loading && data.length === 0 && !error && (
        <div className="empty-state">
          <div className="icon">🏥</div>
          <p>No hospitals found</p>
          <button className="btn btn-primary" style={{ marginTop:12 }} onClick={() => navigate('/admin')}>
            Go to Admin → Add Hospital
          </button>
        </div>
      )}
    </>
  );
}
