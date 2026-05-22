import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

export default function OnboardingPage() {
  const [checklist, setChecklist] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [expanded,  setExpanded]  = useState({});

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await api.getOnboarding();
      setChecklist(Array.isArray(data) ? data : []);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = name => setExpanded(e => ({ ...e, [name]: e[name] === false ? true : false }));

  const phaseColor = p => p >= 3 ? 'var(--accent-green)' : p === 2 ? 'var(--accent-cyan)' : 'var(--accent-amber)';
  const pctColor   = p => p >= 80 ? 'var(--accent-green)' : p >= 50 ? 'var(--accent-amber)' : 'var(--accent-red)';

  const summary = {
    total:    checklist.length,
    phase3:   checklist.filter(p => p.phase >= 3).length,
    phase2:   checklist.filter(p => p.phase === 2).length,
    phase1:   checklist.filter(p => p.phase === 1).length,
    avgPct:   checklist.length
      ? Math.round(checklist.reduce((s,p) => s + p.progress, 0) / checklist.length)
      : 0,
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">🏥 Practice Onboarding</h1>
          <p className="page-subtitle">Track each practice's readiness — 3-phase onboarding checklist</p>
        </div>
        <button className="btn btn-secondary" onClick={load}>↻ Refresh</button>
      </div>

      {error && <div className="alert alert-error" style={{marginBottom:12}}>⚠ {error}</div>}

      {/* Summary KPIs */}
      <div className="kpi-grid" style={{gridTemplateColumns:'repeat(5,1fr)',marginBottom:16}}>
        {[
          { label:'Total Practices',  value: summary.total,   color:'blue'   },
          { label:'Phase 3 — Live',   value: summary.phase3,  color:'green'  },
          { label:'Phase 2 — Active', value: summary.phase2,  color:'cyan'   },
          { label:'Phase 1 — Setup',  value: summary.phase1,  color:'amber'  },
          { label:'Avg Progress',     value: `${summary.avgPct}%`, color: summary.avgPct >= 80 ? 'green' : 'amber' },
        ].map(k=>(
          <div key={k.label} className={`kpi-card ${k.color}`}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{color:`var(--accent-${k.color})`}}>{k.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="loading-overlay"><span className="spinner"/> Loading onboarding data…</div>
      ) : checklist.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🏥</div>
          <p>No practices found</p>
          <p style={{fontSize:12,color:'var(--text-muted)'}}>Go to Admin → Practices to add a practice</p>
        </div>
      ) : (
        checklist.map(p => {
          const isExpanded = expanded[p.name] !== false;
          const done = p.checks.filter(c => c.done).length;
          const total = p.checks.length;

          return (
            <div key={p.practiceId} className="card" style={{marginBottom:16,
              borderColor: p.progress === 100 ? 'rgba(16,185,129,0.3)' : 'var(--border)'}}>

              {/* Header */}
              <div style={{display:'flex',alignItems:'center',gap:16,cursor:'pointer',padding:'4px 0'}}
                onClick={() => toggle(p.name)}>
                <span style={{fontSize:20}}>🦷</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:700,color:'var(--text-primary)'}}>{p.name}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)',fontFamily:'var(--font-mono)',marginTop:2}}>
                    {p.practiceId} {p.dsoId ? `· DSO: ${p.dsoId}` : '· Independent'}
                  </div>
                </div>
                <div style={{textAlign:'center',minWidth:80}}>
                  <div style={{fontSize:20,fontWeight:800,color:pctColor(p.progress)}}>{p.progress}%</div>
                  <div style={{fontSize:10,color:'var(--text-muted)'}}>complete</div>
                </div>
                <div style={{textAlign:'center',minWidth:80}}>
                  <div style={{fontSize:13,fontWeight:700,color:phaseColor(p.phase)}}>Phase {p.phase}</div>
                  <div style={{fontSize:10,color:'var(--text-muted)'}}>
                    {p.phase === 1 ? 'Setup' : p.phase === 2 ? 'Active' : 'Compliant'}
                  </div>
                </div>
                <div style={{fontSize:11,color:'var(--text-muted)'}}>{done}/{total} tasks</div>
                <span style={{color:'var(--text-muted)',fontSize:14}}>{isExpanded ? '▲' : '▼'}</span>
              </div>

              {/* Progress bar */}
              <div style={{height:6,background:'var(--border)',borderRadius:3,overflow:'hidden',margin:'10px 0'}}>
                <div style={{
                  width:`${p.progress}%`, height:'100%', borderRadius:3,
                  background:`linear-gradient(90deg,${pctColor(p.progress)},${pctColor(p.progress)}aa)`,
                  transition:'width 0.5s ease'
                }}/>
              </div>

              {/* Checklist */}
              {isExpanded && (
                <div style={{borderTop:'1px solid var(--border)',paddingTop:12}}>
                  {/* Phase 1 */}
                  <div style={{fontSize:11,fontWeight:700,color:'var(--accent-amber)',
                    textTransform:'uppercase',letterSpacing:'0.08em',
                    marginBottom:8,fontFamily:'var(--font-mono)'}}>
                    Phase 1 — Setup
                  </div>
                  {p.checks.slice(0,4).map(c => (
                    <div key={c.id} style={{display:'flex',alignItems:'center',gap:10,
                      padding:'7px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                      <div style={{
                        width:22,height:22,borderRadius:5,flexShrink:0,
                        display:'flex',alignItems:'center',justifyContent:'center',
                        background: c.done ? 'rgba(16,185,129,0.15)' : 'var(--bg-secondary)',
                        border: c.done ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border)',
                        fontSize:12
                      }}>
                        {c.done ? '✓' : '□'}
                      </div>
                      <span style={{color: c.done ? 'var(--text-primary)' : 'var(--text-muted)'}}>{c.label}</span>
                      {c.done && <span style={{marginLeft:'auto',fontSize:11,color:'var(--accent-green)'}}>✓ Done</span>}
                    </div>
                  ))}

                  {/* Phase 2 */}
                  {p.checks.length > 4 && (
                    <>
                      <div style={{fontSize:11,fontWeight:700,color:'var(--accent-cyan)',
                        textTransform:'uppercase',letterSpacing:'0.08em',
                        margin:'12px 0 8px',fontFamily:'var(--font-mono)'}}>
                        Phase 2 — Clinical Activity
                      </div>
                      {p.checks.slice(4,6).map(c => (
                        <div key={c.id} style={{display:'flex',alignItems:'center',gap:10,
                          padding:'7px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                          <div style={{
                            width:22,height:22,borderRadius:5,flexShrink:0,
                            display:'flex',alignItems:'center',justifyContent:'center',
                            background: c.done ? 'rgba(16,185,129,0.15)' : 'var(--bg-secondary)',
                            border: c.done ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border)',
                            fontSize:12
                          }}>
                            {c.done ? '✓' : '□'}
                          </div>
                          <span style={{color: c.done ? 'var(--text-primary)' : 'var(--text-muted)'}}>{c.label}</span>
                          {c.done && <span style={{marginLeft:'auto',fontSize:11,color:'var(--accent-green)'}}>✓ Done</span>}
                        </div>
                      ))}
                    </>
                  )}

                  {/* Phase 3 */}
                  {p.checks.length > 6 && (
                    <>
                      <div style={{fontSize:11,fontWeight:700,color:'var(--accent-green)',
                        textTransform:'uppercase',letterSpacing:'0.08em',
                        margin:'12px 0 8px',fontFamily:'var(--font-mono)'}}>
                        Phase 3 — Compliance
                      </div>
                      {p.checks.slice(6).map(c => (
                        <div key={c.id} style={{display:'flex',alignItems:'center',gap:10,
                          padding:'7px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                          <div style={{
                            width:22,height:22,borderRadius:5,flexShrink:0,
                            display:'flex',alignItems:'center',justifyContent:'center',
                            background: c.done ? 'rgba(16,185,129,0.15)' : 'var(--bg-secondary)',
                            border: c.done ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border)',
                            fontSize:12
                          }}>
                            {c.done ? '✓' : '□'}
                          </div>
                          <span style={{color: c.done ? 'var(--text-primary)' : 'var(--text-muted)'}}>{c.label}</span>
                          {c.done && <span style={{marginLeft:'auto',fontSize:11,color:'var(--accent-green)'}}>✓ Done</span>}
                        </div>
                      ))}
                    </>
                  )}

                  {p.progress === 100 && (
                    <div className="alert alert-success" style={{marginTop:12}}>
                      ✅ {p.name} is fully onboarded and compliant — ready for go-live
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
