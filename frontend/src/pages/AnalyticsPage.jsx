import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function AnalyticsPage() {
  const [data,    setData]    = useState(null);
  const [period,  setPeriod]  = useState(30);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => { load(); }, [period]);

  async function load() {
    setLoading(true); setError('');
    try {
      const d = await api.getAnalytics({ days: period });
      setData(d);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  const summary = data?.summary || {};
  const topUsers = data?.topUsers || [];
  const actionBreakdown = data?.actionBreakdown || [];
  const roleBreakdown = data?.roleBreakdown || [];
  const dailyActivity = data?.dailyActivity || [];
  const recentActivity = data?.recentActivity || [];

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">📊 Usage Analytics</h1>
          <p className="page-subtitle">System activity across all practices and roles</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          {[7,30,90].map(d=>(
            <button key={d}
              className={`btn btn-sm ${period===d?'btn-primary':'btn-secondary'}`}
              onClick={()=>setPeriod(d)}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert alert-error" style={{marginBottom:12}}>⚠ {error}</div>}

      {loading ? (
        <div className="loading-overlay"><span className="spinner"/> Loading analytics…</div>
      ) : (
        <>
          {/* Summary KPIs */}
          <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:16}}>
            {[
              { label:'Total Actions',  value: summary.totalActions,  color:'blue'   },
              { label:'Active Users',   value: summary.activeUsers,   color:'green'  },
              { label:'All-time Actions',value:summary.allTimeActions,color:'cyan'   },
              { label:'Total Users',    value: summary.totalUsers,    color:'purple' },
            ].map(k=>(
              <div key={k.label} className={`kpi-card ${k.color}`}>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value" style={{color:`var(--accent-${k.color})`}}>
                  {(k.value||0).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          <div className="two-col" style={{marginBottom:16}}>
            {/* Top Users */}
            <div className="card">
              <div className="card-header"><span className="card-title">Top Users</span></div>
              {topUsers.length === 0 ? <div className="empty-state"><p>No activity yet</p></div> : (
                <div className="table-wrap"><table className="data-table">
                  <thead><tr><th>#</th><th>User</th><th>Actions</th><th>Share</th></tr></thead>
                  <tbody>
                    {topUsers.slice(0,10).map((u,i)=>{
                      const max = topUsers[0]?.count || 1;
                      const pct = Math.round((u.count/max)*100);
                      return (
                        <tr key={u.actor}>
                          <td style={{color:'var(--text-muted)',fontSize:11}}>{i+1}</td>
                          <td style={{fontFamily:'monospace',fontSize:12}}>{u.actor}</td>
                          <td style={{color:'var(--accent-blue)',fontWeight:600}}>{u.count}</td>
                          <td style={{width:120}}>
                            <div style={{height:6,background:'var(--border)',borderRadius:3,overflow:'hidden'}}>
                              <div style={{width:`${pct}%`,height:'100%',background:'var(--accent-blue)',borderRadius:3}}/>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table></div>
              )}
            </div>

            {/* Role Breakdown */}
            <div className="card">
              <div className="card-header"><span className="card-title">Actions by Category</span></div>
              {roleBreakdown.length === 0 ? <div className="empty-state"><p>No data</p></div> : (
                <div style={{display:'flex',flexDirection:'column',gap:10,padding:'8px 0'}}>
                  {roleBreakdown.map(r=>{
                    const max = Math.max(...roleBreakdown.map(x=>x.count),1);
                    const pct = Math.round((r.count/max)*100);
                    return (
                      <div key={r.category}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:12}}>
                          <span style={{color:'var(--text-secondary)'}}>{r.category}</span>
                          <span style={{color:'var(--accent-green)',fontWeight:600}}>{r.count}</span>
                        </div>
                        <div style={{height:6,background:'var(--border)',borderRadius:3,overflow:'hidden'}}>
                          <div style={{width:`${pct}%`,height:'100%',background:'var(--accent-green)',borderRadius:3}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Action Breakdown */}
          <div className="card" style={{marginBottom:16}}>
            <div className="card-header"><span className="card-title">Action Breakdown (last {period} days)</span></div>
            {actionBreakdown.length === 0 ? <div className="empty-state"><p>No actions recorded</p></div> : (
              <div className="table-wrap"><table className="data-table">
                <thead><tr><th>Action</th><th>Count</th><th>Distribution</th></tr></thead>
                <tbody>
                  {actionBreakdown.slice(0,20).map(a=>{
                    const max = actionBreakdown[0]?.count || 1;
                    const pct = Math.round((a.count/max)*100);
                    return (
                      <tr key={a.action}>
                        <td style={{fontFamily:'monospace',fontSize:11}}>{a.action}</td>
                        <td style={{color:'var(--accent-cyan)',fontWeight:600}}>{a.count}</td>
                        <td style={{width:160}}>
                          <div style={{height:6,background:'var(--border)',borderRadius:3,overflow:'hidden'}}>
                            <div style={{width:`${pct}%`,height:'100%',background:'var(--accent-cyan)',borderRadius:3}}/>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="card">
            <div className="card-header"><span className="card-title">Recent Activity</span></div>
            {recentActivity.length === 0 ? <div className="empty-state"><p>No recent activity</p></div> : (
              <div className="table-wrap"><table className="data-table">
                <thead><tr><th>Actor</th><th>Action</th><th>Target</th><th>Time</th></tr></thead>
                <tbody>
                  {recentActivity.slice(0,20).map(a=>(
                    <tr key={a.id}>
                      <td style={{fontFamily:'monospace',fontSize:11}}>{a.actor}</td>
                      <td><span className="badge badge-blue" style={{fontSize:9}}>{a.action}</span></td>
                      <td style={{fontSize:11,color:'var(--text-muted)'}}>{a.target||'—'}</td>
                      <td style={{fontSize:11,color:'var(--text-muted)'}}>{new Date(a.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
