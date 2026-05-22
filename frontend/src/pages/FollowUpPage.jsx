import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function FollowUpPage() {
  const { user } = useAuth();
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({
    caseId:'', implantId:'', patientMrn:'',
    followUpType:'3_month', scheduledDate:'', notes:''
  });

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api.get('/follow-ups');
      setFollowUps(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function submit(e) {
    e.preventDefault();
    try {
      await api.post('/follow-up', {
        ...form,
        practiceId: user.practiceId || '',
        followUpId: `FU-${Date.now()}`
      });
      setShowForm(false);
      load();
    } catch (e) { alert(e.message); }
  }

  async function complete(followUpId, outcome) {
    try {
      await api.put(`/follow-up/${followUpId}/status`, {
        status: 'completed', outcome,
        completedDate: new Date().toISOString().slice(0,10)
      });
      load();
    } catch (e) { alert(e.message); }
  }

  const outcomeColor = {
    healing:'badge-amber', osseointegrated:'badge-green',
    failed:'badge-red', monitoring:'badge-blue'
  };

  if (loading) return <div className="page-loading">Loading follow-ups...</div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">📋 Osseointegration Follow-ups</h1>
          <p className="page-subtitle">Post-implant monitoring and outcome tracking</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          + Schedule Follow-up
        </button>
      </div>

      {showForm && (
        <div className="card" style={{marginBottom:16}}>
          <div className="card-header"><span className="card-title">Schedule Follow-up</span></div>
          <form onSubmit={submit}>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Case ID</label>
                <input value={form.caseId} onChange={e=>setForm({...form,caseId:e.target.value})} placeholder="CASE-001"/>
              </div>
              <div className="form-group">
                <label>Implant ID</label>
                <input value={form.implantId} onChange={e=>setForm({...form,implantId:e.target.value})} placeholder="IMPL-001"/>
              </div>
              <div className="form-group">
                <label>Follow-up Type</label>
                <select value={form.followUpType} onChange={e=>setForm({...form,followUpType:e.target.value})}>
                  <option value="1_week">1 Week</option>
                  <option value="1_month">1 Month</option>
                  <option value="3_month">3 Months</option>
                  <option value="6_month">6 Months</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
              <div className="form-group">
                <label>Scheduled Date</label>
                <input required type="date" value={form.scheduledDate} onChange={e=>setForm({...form,scheduledDate:e.target.value})}/>
              </div>
              <div className="form-group" style={{gridColumn:'1/-1'}}>
                <label>Notes</label>
                <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2}/>
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:12}}>
              <button type="submit" className="btn btn-primary">Schedule</button>
              <button type="button" className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {followUps.length === 0 ? (
        <div className="empty-state">No follow-ups scheduled</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th><th>Case</th><th>Type</th>
              <th>Scheduled</th><th>Completed</th>
              <th>Outcome</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {followUps.map(fu => (
              <tr key={fu.follow_up_id}>
                <td style={{fontFamily:'monospace',fontSize:11}}>{fu.follow_up_id}</td>
                <td>{fu.case_id}</td>
                <td>{fu.follow_up_type?.replace('_',' ')}</td>
                <td>{fu.scheduled_date?.slice(0,10)}</td>
                <td>{fu.completed_date?.slice(0,10) || '—'}</td>
                <td>{fu.outcome
                  ? <span className={`badge ${outcomeColor[fu.outcome]||'badge-grey'}`}>{fu.outcome}</span>
                  : '—'}
                </td>
                <td><span className={`badge ${fu.status==='completed'?'badge-green':'badge-amber'}`}>{fu.status}</span></td>
                <td>
                  {fu.status === 'scheduled' && (
                    <div style={{display:'flex',gap:4}}>
                      <button className="btn btn-sm btn-green"
                        onClick={()=>complete(fu.follow_up_id,'osseointegrated')}>
                        ✓ Complete
                      </button>
                      <button className="btn btn-sm btn-amber"
                        onClick={()=>complete(fu.follow_up_id,'monitoring')}>
                        Monitor
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
