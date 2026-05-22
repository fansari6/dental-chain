import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function LabWorkPage() {
  const { user } = useAuth();
  const [labWork, setLabWork]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({
    caseId:'', implantId:'', labName:'', workType:'crown',
    shade:'A2', material:'zirconia', sentDate:'', dueDate:'', notes:''
  });

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api.get('/lab-work');
      setLabWork(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function submit(e) {
    e.preventDefault();
    try {
      const practiceId = user.practiceId || '';
      await api.post('/lab-work', { ...form, practiceId,
        labWorkId: `LAB-${Date.now()}` });
      setShowForm(false);
      setForm({ caseId:'', implantId:'', labName:'', workType:'crown',
        shade:'A2', material:'zirconia', sentDate:'', dueDate:'', notes:'' });
      load();
    } catch (e) { alert(e.message); }
  }

  async function updateStatus(labWorkId, status, receivedDate='') {
    try {
      await api.put(`/lab-work/${labWorkId}/status`, { status, receivedDate });
      load();
    } catch (e) { alert(e.message); }
  }

  const statusColor = {
    at_lab:'badge-amber', received:'badge-blue',
    approved:'badge-green', rejected:'badge-red', remade:'badge-purple'
  };

  if (loading) return <div className="page-loading">Loading lab work...</div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">🔬 Lab Work</h1>
          <p className="page-subtitle">Crown, abutment and prosthetic chain of custody</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          + Send to Lab
        </button>
      </div>

      {showForm && (
        <div className="card" style={{marginBottom:16}}>
          <div className="card-header"><span className="card-title">New Lab Work Order</span></div>
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
                <label>Lab Name</label>
                <input required value={form.labName} onChange={e=>setForm({...form,labName:e.target.value})} placeholder="e.g. Glidewell Dental Lab"/>
              </div>
              <div className="form-group">
                <label>Work Type</label>
                <select value={form.workType} onChange={e=>setForm({...form,workType:e.target.value})}>
                  <option value="crown">Crown</option>
                  <option value="abutment">Abutment</option>
                  <option value="bridge">Bridge</option>
                  <option value="full_arch">Full Arch</option>
                  <option value="veneer">Veneer</option>
                </select>
              </div>
              <div className="form-group">
                <label>Material</label>
                <select value={form.material} onChange={e=>setForm({...form,material:e.target.value})}>
                  <option value="zirconia">Zirconia</option>
                  <option value="porcelain">Porcelain</option>
                  <option value="pfm">PFM</option>
                  <option value="gold">Gold</option>
                </select>
              </div>
              <div className="form-group">
                <label>Shade</label>
                <input value={form.shade} onChange={e=>setForm({...form,shade:e.target.value})} placeholder="A2"/>
              </div>
              <div className="form-group">
                <label>Sent Date</label>
                <input type="date" value={form.sentDate} onChange={e=>setForm({...form,sentDate:e.target.value})}/>
              </div>
              <div className="form-group">
                <label>Due Date</label>
                <input type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/>
              </div>
              <div className="form-group" style={{gridColumn:'1/-1'}}>
                <label>Instructions</label>
                <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2} placeholder="Lab instructions..."/>
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:12}}>
              <button type="submit" className="btn btn-primary">📤 Send to Lab</button>
              <button type="button" className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {labWork.length === 0 ? (
        <div className="empty-state">No lab work orders yet</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Lab Work ID</th>
              <th>Lab</th>
              <th>Type</th>
              <th>Material</th>
              <th>Shade</th>
              <th>Sent</th>
              <th>Due</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {labWork.map(lw => (
              <tr key={lw.lab_work_id}>
                <td style={{fontFamily:'monospace',fontSize:11}}>{lw.lab_work_id}</td>
                <td>{lw.lab_name}</td>
                <td>{lw.work_type}</td>
                <td>{lw.material}</td>
                <td>{lw.shade}</td>
                <td>{lw.sent_date?.slice(0,10)}</td>
                <td>{lw.due_date?.slice(0,10)}</td>
                <td><span className={`badge ${statusColor[lw.status]||'badge-grey'}`}>{lw.status}</span></td>
                <td>
                  {lw.status === 'at_lab' && (
                    <button className="btn btn-sm btn-green"
                      onClick={() => updateStatus(lw.lab_work_id, 'received', new Date().toISOString().slice(0,10))}>
                      ✓ Received
                    </button>
                  )}
                  {lw.status === 'received' && (
                    <button className="btn btn-sm btn-primary"
                      onClick={() => updateStatus(lw.lab_work_id, 'approved')}>
                      ✓ Approve
                    </button>
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
