import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../api/client';

const PERIODS = [
  { label:'7 days',  value:'7'  },
  { label:'30 days', value:'30' },
  { label:'90 days', value:'90' },
  { label:'Custom',  value:'custom' },
];

const CATEGORY_COLORS = {
  'Clinical':     'var(--accent-amber)',
  'Government':   'var(--accent-blue)',
  'Manufacturer': 'var(--accent-green)',
  'Distributor':  'var(--accent-cyan)',
  'Recall':       'var(--accent-red)',
  'Admin/Auth':   'var(--text-muted)',
  'Other':        'var(--border)',
};

const ACTION_META = {
  RECORD_IMPLANT:              { label:'Record Implant',       color:'var(--accent-amber)' },
  LOGIN:                       { label:'Login',                color:'var(--text-muted)'  },
  LOGOUT:                      { label:'Logout',               color:'var(--text-muted)'  },
  CREATE_CONSIGNMENT:          { label:'Create Consignment',   color:'var(--accent-cyan)' },
  APPROVE_DEVICE_SUBMISSION:   { label:'Approve Device',       color:'var(--accent-blue)' },
  ISSUE_CLEARANCE:             { label:'Issue Clearance',      color:'var(--accent-blue)' },
  CREATE_LOT:                  { label:'Create Lot',           color:'var(--accent-purple)' },
  RELEASE_LOT:                 { label:'Release Lot',          color:'var(--accent-green)' },
  SUBMIT_DEVICE:               { label:'Submit Device',        color:'var(--accent-green)' },
  UPLOAD_ISO13485:             { label:'Upload ISO 13485',     color:'var(--accent-green)' },
  RECALL_LOT:                  { label:'Recall Lot',           color:'var(--accent-red)'  },
  BULK_RECALL_NOTIFICATION:    { label:'Bulk Recall Notif.',   color:'var(--accent-red)'  },
  RECORD_RECALL_NOTIFICATION:  { label:'Recall Notification',  color:'var(--accent-red)'  },
  CREATE_USER:                 { label:'Create User',          color:'var(--text-secondary)' },
  CREATE_CASE:                 { label:'Create Case',          color:'var(--accent-blue)' },
  CREATE_REP_VISIT:            { label:'Rep Visit',            color:'var(--accent-purple)' },
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)',
      borderRadius:'var(--radius-sm)', padding:'8px 12px', fontSize:12 }}>
      <div style={{ fontWeight:700, marginBottom:4 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ color:p.color||'var(--accent-blue)' }}>{p.value} actions</div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [period,     setPeriod]     = useState('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo,   setCustomTo]   = useState('');

  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = period === 'custom'
        ? { from: customFrom, to: customTo || today }
        : { days: period };
      setData(await api.getAnalytics(params));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [period, customFrom, customTo, today]);

  useEffect(() => {
    if (period !== 'custom') load();
  }, [period]);

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ['Metric', 'Value'],
      ['Total Actions (period)', data.summary.totalActions],
      ['Active Users (period)', data.summary.activeUsers],
      ['Total Users', data.summary.totalUsers],
      ['All-Time Actions', data.summary.allTimeActions],
      [''],
      ['Date', 'Actions'],
      ...data.dailyActivity.map(d=>[d.day, d.count]),
      [''],
      ['Action', 'Count'],
      ...data.actionBreakdown.map(a=>[a.action, a.count]),
      [''],
      ['User', 'Actions'],
      ...data.topUsers.map(u=>[u.actor, u.count]),
    ];
    const csv = rows.map(r=>r.map(v=>'"'+String(v||'').replace(/"/g,'""')+'"').join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download = 'analytics-'+today+'.csv'; a.click();
  };

  const maxDay = data ? Math.max(...data.dailyActivity.map(d=>d.count), 1) : 1;

  return (
    <>
      <div className="page-header">
        <h2>📊 Usage Analytics</h2>
        <p>System activity, adoption metrics, and user engagement across all hospitals</p>
      </div>

      {error && <div className="alert alert-error" style={{marginBottom:12}}>⚠ {error}</div>}

      {/* Period selector */}
      <div className="card" style={{marginBottom:16,padding:'12px 16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <span style={{fontSize:13,fontWeight:600,color:'var(--text-secondary)'}}>Time Period:</span>
          <div style={{display:'flex',gap:4}}>
            {PERIODS.map(p=>(
              <button key={p.value} onClick={()=>setPeriod(p.value)}
                style={{padding:'5px 14px',borderRadius:'var(--radius-sm)',fontSize:12,fontWeight:600,
                  cursor:'pointer',border:'1px solid var(--border)',
                  background:period===p.value?'var(--accent-blue)':'transparent',
                  color:period===p.value?'#fff':'var(--text-secondary)'}}>
                {p.label}
              </button>
            ))}
          </div>
          {period==='custom' && (
            <>
              <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}
                max={today} style={{fontSize:12,padding:'4px 8px'}}/>
              <span style={{color:'var(--text-muted)'}}>—</span>
              <input type="date" value={customTo||today} onChange={e=>setCustomTo(e.target.value)}
                max={today} style={{fontSize:12,padding:'4px 8px'}}/>
              <button className="btn btn-primary btn-sm" onClick={load}
                disabled={!customFrom}>Apply</button>
            </>
          )}
          <div style={{marginLeft:'auto',display:'flex',gap:8}}>
            <button className="btn btn-ghost btn-sm" onClick={load}>↻ Refresh</button>
            {data && <button className="btn btn-ghost btn-sm" onClick={exportCSV}>↓ Export CSV</button>}
          </div>
        </div>
      </div>

      {loading && <div className="loading-overlay"><span className="spinner"/> Loading analytics…</div>}

      {data && !loading && (
        <>
          {/* Summary KPIs */}
          <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:16}}>
            {[
              { label:'Actions (Period)',  value:data.summary.totalActions.toLocaleString(), color:'blue'   },
              { label:'Active Users',      value:data.summary.activeUsers,                  color:'green'  },
              { label:'Total Users',       value:data.summary.totalUsers,                   color:'cyan'   },
              { label:'All-Time Actions',  value:data.summary.allTimeActions.toLocaleString(), color:'purple' },
            ].map(k=>(
              <div key={k.label} className={'kpi-card '+k.color}>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value" style={{color:'var(--accent-'+k.color+')'}}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Activity trend + Action breakdown */}
          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16,marginBottom:16}}>

            {/* Daily activity chart */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">📈 Daily Activity</span>
                <span style={{fontSize:12,color:'var(--text-muted)'}}>
                  {data.dailyActivity.length} days with activity
                </span>
              </div>
              {data.dailyActivity.length === 0
                ? <div className="empty-state" style={{padding:'24px 0'}}><div className="icon">📈</div><p>No activity in this period</p></div>
                : <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.dailyActivity} margin={{top:4,right:8,bottom:20,left:0}}>
                      <XAxis dataKey="day" tick={{fontSize:10,fill:'var(--text-muted)'}}
                        tickFormatter={v=>v?.slice(5)} angle={-45} textAnchor="end"/>
                      <YAxis tick={{fontSize:10,fill:'var(--text-muted)'}} allowDecimals={false}/>
                      <Tooltip content={<CustomTooltip/>}/>
                      <Bar dataKey="count" radius={[3,3,0,0]}>
                        {data.dailyActivity.map((entry,i)=>(
                          <Cell key={i} fill={entry.count===maxDay?'var(--accent-blue)':'rgba(59,130,246,0.5)'}/>
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
              }
            </div>

            {/* Role breakdown */}
            <div className="card">
              <div className="card-header"><span className="card-title">🔑 By Role Area</span></div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {data.roleBreakdown.map(r=>{
                  const total = data.roleBreakdown.reduce((s,x)=>s+x.count,0);
                  const pct   = total>0?Math.round((r.count/total)*100):0;
                  const color = CATEGORY_COLORS[r.category]||'var(--accent-blue)';
                  return (
                    <div key={r.category}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                        <span style={{fontSize:12,fontWeight:600}}>{r.category}</span>
                        <span style={{fontSize:11,color:'var(--text-muted)'}}>{r.count} ({pct}%)</span>
                      </div>
                      <div style={{height:6,background:'var(--border)',borderRadius:3,overflow:'hidden'}}>
                        <div style={{width:pct+'%',height:'100%',background:color,borderRadius:3,transition:'width 0.5s'}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Top actions + Top users */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>

            {/* Top action types */}
            <div className="card">
              <div className="card-header"><span className="card-title">⚡ Top Actions</span></div>
              <div className="table-wrap"><table>
                <thead><tr><th>Action</th><th>Count</th><th>Share</th></tr></thead>
                <tbody>{data.actionBreakdown.map((a,i)=>{
                  const total = data.actionBreakdown.reduce((s,x)=>s+x.count,0);
                  const pct   = total>0?Math.round((a.count/total)*100):0;
                  const meta  = ACTION_META[a.action]||{ label:a.action.replace(/_/g,' '), color:'var(--accent-blue)' };
                  return (
                    <tr key={a.action}>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <span style={{width:8,height:8,borderRadius:'50%',background:meta.color,flexShrink:0,display:'inline-block'}}/>
                          <span style={{fontSize:12,fontWeight:600}}>{meta.label}</span>
                        </div>
                      </td>
                      <td style={{fontWeight:700,color:meta.color}}>{a.count}</td>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <div style={{width:50,height:4,background:'var(--border)',borderRadius:2,overflow:'hidden'}}>
                            <div style={{width:pct+'%',height:'100%',background:meta.color,borderRadius:2}}/>
                          </div>
                          <span style={{fontSize:10,color:'var(--text-muted)'}}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            </div>

            {/* Top users */}
            <div className="card">
              <div className="card-header"><span className="card-title">👤 Most Active Users</span></div>
              <div className="table-wrap"><table>
                <thead><tr><th>User</th><th>Actions</th><th>Activity</th></tr></thead>
                <tbody>{data.topUsers.map((u,i)=>{
                  const max = data.topUsers[0]?.count||1;
                  const pct = Math.round((u.count/max)*100);
                  const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
                  return (
                    <tr key={u.actor}>
                      <td>
                        <span style={{fontSize:13}}>{medal} </span>
                        <span style={{fontSize:12,fontWeight:600,fontFamily:'var(--font-mono)'}}>{u.actor}</span>
                      </td>
                      <td style={{fontWeight:700,color:'var(--accent-blue)'}}>{u.count}</td>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <div style={{width:60,height:4,background:'var(--border)',borderRadius:2,overflow:'hidden'}}>
                            <div style={{width:pct+'%',height:'100%',background:'var(--accent-blue)',borderRadius:2}}/>
                          </div>
                          <span style={{fontSize:10,color:'var(--text-muted)'}}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            </div>
          </div>

          {/* Per-hospital stats */}
          <div className="card" style={{marginBottom:16}}>
            <div className="card-header"><span className="card-title">🏥 Per-Hospital Stats</span></div>
            <div className="table-wrap"><table>
              <thead><tr><th>Hospital</th><th>Users</th><th>OR Cases</th><th>Completed Cases</th><th>Rep Visits</th></tr></thead>
              <tbody>{data.perHospital.map(h=>(
                <tr key={h.name}>
                  <td style={{fontWeight:600}}>🏥 {h.name}</td>
                  <td><span className="badge badge-blue">{h.user_count}</span></td>
                  <td style={{fontWeight:600,color:'var(--accent-amber)'}}>{h.case_count||0}</td>
                  <td style={{color:'var(--accent-green)'}}>{h.completed_cases||0}</td>
                  <td style={{color:'var(--accent-cyan)'}}>{h.visit_count||0}</td>
                </tr>
              ))}</tbody>
            </table></div>
          </div>

          {/* Recent activity feed */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">🕐 Recent Activity</span>
              <span style={{fontSize:12,color:'var(--text-muted)'}}>Last 25 events</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {data.recentActivity.map((r,i)=>{
                const meta = ACTION_META[r.action]||{label:r.action.replace(/_/g,' '),color:'var(--text-muted)'};
                return (
                  <div key={r.id||i} style={{display:'flex',alignItems:'center',gap:12,
                    padding:'8px 12px',background:i%2===0?'transparent':'var(--bg-secondary)',
                    borderRadius:'var(--radius-sm)'}}>
                    <span style={{width:8,height:8,borderRadius:'50%',background:meta.color,flexShrink:0}}/>
                    <span style={{fontSize:11,color:'var(--text-muted)',whiteSpace:'nowrap',minWidth:130}}>
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                    <span style={{fontSize:12,fontWeight:600,fontFamily:'var(--font-mono)',
                      color:'var(--text-secondary)',minWidth:100}}>{r.actor}</span>
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:99,
                      background:meta.color+'20',color:meta.color,fontWeight:600,whiteSpace:'nowrap'}}>
                      {meta.label}
                    </span>
                    {r.target && (
                      <span style={{fontSize:10,color:'var(--text-muted)',fontFamily:'var(--font-mono)',
                        overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {r.target}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {!loading && !data && !error && (
        <div className="empty-state">
          <div className="icon">📊</div>
          <p>Select a time period to load analytics</p>
        </div>
      )}
    </>
  );
}
