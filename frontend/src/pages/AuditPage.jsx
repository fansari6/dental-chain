import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const ACTION_CATEGORIES = {
  DEVICE:       { label:'Device',       color:'var(--accent-blue)',   bg:'rgba(59,130,246,0.08)',   actions:['REGISTER_DEVICE','ONBOARD_DEVICE','UPDATE_DEVICE'] },
  CLEARANCE:    { label:'Clearance',    color:'var(--accent-green)',  bg:'rgba(16,185,129,0.08)',   actions:['ISSUE_CLEARANCE','REVOKE_CLEARANCE','APPROVE_DEVICE_SUBMISSION','APPROVE_ONBOARDING_REQUEST'] },
  LOT:          { label:'Lot',          color:'var(--accent-purple)', bg:'rgba(139,92,246,0.08)',   actions:['CREATE_LOT','RELEASE_LOT','RECALL_LOT','RECALL_CONSIGNMENT'] },
  CONSIGNMENT:  { label:'Consignment',  color:'var(--accent-cyan)',   bg:'rgba(6,182,212,0.08)',    actions:['CREATE_CONSIGNMENT','RETURN_CONSIGNMENT','TRANSFER_CONSIGNMENT'] },
  IMPLANT:      { label:'Implant',      color:'var(--accent-amber)',  bg:'rgba(245,158,11,0.08)',   actions:['RECORD_IMPLANT','RECORD_EXPLANT','BULK_IMPORT','RECORD_ADVERSE_EVENT'] },
  RECALL:       { label:'Recall',       color:'var(--accent-red)',    bg:'rgba(239,68,68,0.08)',    actions:['BULK_RECALL_NOTIFICATION','RECORD_RECALL_NOTIFICATION'] },
  CERTIFICATION:{ label:'Certification',color:'var(--accent-green)',  bg:'rgba(16,185,129,0.04)',   actions:['UPLOAD_ISO13485','REVOKE_ISO13485'] },
  AUTH:         { label:'Auth',         color:'var(--text-muted)',    bg:'var(--bg-secondary)',     actions:['LOGIN','LOGOUT','CHANGE_PASSWORD'] },
  ADMIN:        { label:'Admin',        color:'var(--text-secondary)',bg:'var(--bg-secondary)',     actions:['CREATE_USER','DEACTIVATE_USER','ACTIVATE_USER'] },
};

function getCategoryForAction(action) {
  for (const [key, cat] of Object.entries(ACTION_CATEGORIES)) {
    if (cat.actions.includes(action)) return { key, ...cat };
  }
  return { key:'OTHER', label:'Other', color:'var(--text-muted)', bg:'transparent' };
}

function ActionBadge({ action }) {
  const cat = getCategoryForAction(action);
  return (
    <span style={{padding:'2px 8px',borderRadius:99,fontSize:10,fontWeight:600,
      background:cat.bg,color:cat.color,border:`1px solid ${cat.color}30`}}>
      {action.replace(/_/g,' ')}
    </span>
  );
}

function DetailCell({ details }) {
  if (!details) return <span style={{color:'var(--text-muted)',fontSize:11}}>—</span>;
  const d = typeof details === 'string' ? JSON.parse(details) : details;
  const entries = Object.entries(d).slice(0,3);
  return (
    <div style={{fontSize:10,fontFamily:'var(--font-mono)',color:'var(--text-secondary)'}}>
      {entries.map(([k,v])=>(
        <div key={k}><span style={{color:'var(--text-muted)'}}>{k}:</span> {String(v).slice(0,40)}</div>
      ))}
      {Object.keys(d).length > 3 && <div style={{color:'var(--text-muted)'}}>+{Object.keys(d).length-3} more</div>}
    </div>
  );
}

export default function AuditPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [logs,       setLogs]       = useState([]);
  const [actions,    setActions]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  // Filters
  const [from,       setFrom]       = useState('');
  const [to,         setTo]         = useState('');
  const [actor,      setActor]      = useState('');
  const [action,     setAction]     = useState('');
  const [search,     setSearch]     = useState('');
  const [category,   setCategory]   = useState('');

  // Pagination
  const [page,       setPage]       = useState(1);
  const PAGE_SIZE = 50;

  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    setLoading(true); setError(''); setPage(1);
    try {
      const params = {};
      if (from)   params.from   = from;
      if (to)     params.to     = to;
      if (actor)  params.actor  = actor;
      if (action) params.action = action;
      if (search) params.search = search;
      params.limit = 500;
      const [data, acts] = await Promise.all([
        api.getAuditLog(params),
        actions.length ? Promise.resolve(actions) : api.getAuditActions(),
      ]);
      setLogs(Array.isArray(data) ? data : []);
      if (!actions.length) setActions(Array.isArray(acts) ? acts : []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [from, to, actor, action, search]);

  useEffect(() => {
    api.getAuditActions().then(d=>setActions(Array.isArray(d)?d:[])).catch(()=>{});
    load();
  }, []);

  const exportCSV = () => {
    if (!filtered.length) return;
    const headers = ['id','actor','action','target','details','created_at'];
    const csv = [
      headers.join(','),
      ...filtered.map(r=>[r.id,r.actor,r.action,r.target||'',
        JSON.stringify(r.details||'').replace(/"/g,"'"),
        r.created_at].map(v=>`"${v}"`).join(','))
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download = `audit-trail-${today}.csv`; a.click();
  };

  const printReport = () => {
    const html = `<!DOCTYPE html><html><head><title>Audit Trail Report</title>
<style>
  body{font-family:system-ui,sans-serif;font-size:12px;color:#111;padding:20px}
  h1{font-size:18px;margin-bottom:4px}
  .meta{color:#666;font-size:11px;margin-bottom:20px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{background:#f0f0f0;padding:6px 8px;text-align:left;border-bottom:2px solid #ddd;font-weight:600}
  td{padding:5px 8px;border-bottom:1px solid #eee;vertical-align:top}
  tr:nth-child(even){background:#fafafa}
  .badge{display:inline-block;padding:1px 6px;border-radius:99px;font-size:10px;font-weight:600;background:#e0e0e0}
  @media print{body{padding:0}.no-print{display:none}}
</style></head><body>
<h1>📜 ImplantChain — Audit Trail Report</h1>
<div class="meta">
  Generated: ${new Date().toLocaleString()} · 
  Exported by: ${user?.username} · 
  Records: ${filtered.length}
  ${from||to ? ` · Period: ${from||'—'} to ${to||'—'}` : ''}
</div>
<button class="no-print" onclick="window.print()" style="margin-bottom:16px;padding:8px 16px;cursor:pointer">🖨 Print / Save as PDF</button>
<table>
<thead><tr><th>#</th><th>Timestamp</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
<tbody>
${filtered.map((r,i)=>`<tr>
  <td>${filtered.length-i}</td>
  <td>${new Date(r.created_at).toLocaleString()}</td>
  <td><strong>${r.actor}</strong></td>
  <td><span class="badge">${r.action}</span></td>
  <td style="font-family:monospace;font-size:10px">${r.target||'—'}</td>
  <td style="font-family:monospace;font-size:10px;max-width:200px">${r.details?JSON.stringify(r.details).slice(0,120):'—'}</td>
</tr>`).join('')}
</tbody></table>
</body></html>`;
    const w = window.open('','_blank');
    w.document.write(html);
    w.document.close();
  };

  // Apply category filter client-side
  const filtered = logs.filter(r => {
    if (!category) return true;
    return getCategoryForAction(r.action).key === category;
  });

  const paginated = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // Action category counts for mini-KPIs
  const catCounts = {};
  for (const r of logs) {
    const cat = getCategoryForAction(r.action).key;
    catCounts[cat] = (catCounts[cat]||0) + 1;
  }

  return (
    <>
      <div className="page-header">
        <h2>📜 Audit Trail</h2>
        <p>
          {isAdmin ? 'Complete system audit log — all actions across all users' : 'Blockchain and regulatory action audit trail'}
        </p>
      </div>

      {error && <div className="alert alert-error" style={{marginBottom:12}}>⚠ {error}</div>}

      {/* Category KPIs */}
      {logs.length > 0 && (
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
          <button
            onClick={()=>setCategory('')}
            style={{padding:'6px 12px',borderRadius:'var(--radius-sm)',fontSize:12,fontWeight:600,
              cursor:'pointer',border:`1px solid ${!category?'var(--accent-blue)':'var(--border)'}`,
              background:!category?'rgba(59,130,246,0.1)':'var(--bg-card)',
              color:!category?'var(--accent-blue)':'var(--text-secondary)'}}>
            All ({logs.length})
          </button>
          {Object.entries(ACTION_CATEGORIES).filter(([k])=>catCounts[k]>0).map(([key,cat])=>(
            <button key={key}
              onClick={()=>setCategory(category===key?'':key)}
              style={{padding:'6px 12px',borderRadius:'var(--radius-sm)',fontSize:12,fontWeight:600,
                cursor:'pointer',border:`1px solid ${category===key?cat.color:'var(--border)'}`,
                background:category===key?cat.bg:'var(--bg-card)',
                color:category===key?cat.color:'var(--text-secondary)'}}>
              {cat.label} ({catCounts[key]||0})
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{marginBottom:16}}>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
          <div className="form-group" style={{marginBottom:0}}>
            <label>From</label>
            <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{width:140}}/>
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label>To</label>
            <input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{width:140}}/>
          </div>
          {isAdmin && (
            <div className="form-group" style={{marginBottom:0}}>
              <label>Actor</label>
              <input placeholder="username" value={actor} onChange={e=>setActor(e.target.value)} style={{width:140}}/>
            </div>
          )}
          <div className="form-group" style={{marginBottom:0}}>
            <label>Action Type</label>
            <select value={action} onChange={e=>setAction(e.target.value)} style={{minWidth:180}}>
              <option value="">All Actions</option>
              {actions.map(a=>(
                <option key={a.action} value={a.action}>{a.action} ({a.count})</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{flex:1,marginBottom:0,minWidth:180}}>
            <label>Search</label>
            <input placeholder="actor, action, target..." value={search}
              onChange={e=>setSearch(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&load()}/>
          </div>
          <button className="btn btn-primary" onClick={load} disabled={loading}>
            {loading?<><span className="spinner" style={{width:14,height:14}}/> Loading…</>:'🔍 Apply Filters'}
          </button>
          {(from||to||actor||action||search) && (
            <button className="btn btn-ghost" onClick={()=>{setFrom('');setTo('');setActor('');setAction('');setSearch('');setTimeout(load,50);}}>
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* Main table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            Audit Records
            <span className="badge badge-blue" style={{marginLeft:8}}>{filtered.length}</span>
            {filtered.length !== logs.length && (
              <span className="badge badge-amber" style={{marginLeft:4}}>{logs.length} total</span>
            )}
          </span>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-ghost btn-sm" onClick={exportCSV}>↓ Export CSV</button>
            <button className="btn btn-ghost btn-sm" onClick={printReport}>🖨 Print / PDF</button>
            <button className="btn btn-ghost btn-sm" onClick={load}>↻ Refresh</button>
          </div>
        </div>

        {loading
          ? <div className="loading-overlay"><span className="spinner"/></div>
          : filtered.length === 0
            ? <div className="empty-state"><div className="icon">📜</div><p>No audit records match current filters</p></div>
            : <>
                <div className="table-wrap"><table>
                  <thead><tr>
                    <th style={{width:40}}>#</th>
                    <th>Timestamp</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Details</th>
                  </tr></thead>
                  <tbody>{paginated.map((r,i)=>{
                    const cat = getCategoryForAction(r.action);
                    const rowNum = filtered.length - ((page-1)*PAGE_SIZE + i);
                    return (
                      <tr key={r.id} style={{background:i%2===0?'transparent':'rgba(0,0,0,0.01)'}}>
                        <td style={{fontSize:10,color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>{rowNum}</td>
                        <td style={{fontSize:11,whiteSpace:'nowrap'}}>
                          <div>{new Date(r.created_at).toLocaleDateString()}</div>
                          <div style={{fontSize:10,color:'var(--text-muted)'}}>{new Date(r.created_at).toLocaleTimeString()}</div>
                        </td>
                        <td>
                          <div style={{fontSize:12,fontWeight:600}}>{r.actor}</div>
                        </td>
                        <td><ActionBadge action={r.action}/></td>
                        <td style={{fontFamily:'var(--font-mono)',fontSize:10,maxWidth:160,
                          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}
                          title={r.target}>{r.target||'—'}</td>
                        <td><DetailCell details={r.details}/></td>
                      </tr>
                    );
                  })}</tbody>
                </table></div>

                {totalPages > 1 && (
                  <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,
                    padding:'12px 0',borderTop:'1px solid var(--border)'}}>
                    <button className="btn btn-ghost btn-sm" disabled={page===1} onClick={()=>setPage(p=>p-1)}>← Prev</button>
                    <span style={{fontSize:12,color:'var(--text-secondary)'}}>
                      Page {page} of {totalPages} · {filtered.length} records
                    </span>
                    <button className="btn btn-ghost btn-sm" disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}>Next →</button>
                  </div>
                )}
              </>
        }
      </div>
    </>
  );
}
