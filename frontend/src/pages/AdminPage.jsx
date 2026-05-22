import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

// ── Shared user table ─────────────────────────────────────────────
function UserTable({ users, onToggle, emptyMsg = 'No users found' }) {
  if (!users?.length) return <div className="empty-state"><p>{emptyMsg}</p></div>;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Username</th><th>Full Name</th><th>Email</th>
            <th>Practice</th><th>DSO</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.username}>
              <td style={{fontFamily:'monospace',fontSize:12}}>{u.username}</td>
              <td>{u.full_name || '—'}</td>
              <td style={{fontSize:12}}>{u.email || '—'}</td>
              <td style={{fontSize:12}}>{u.practice_id || '—'}</td>
              <td style={{fontSize:12}}>{u.dso_id || '—'}</td>
              <td>
                <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                  {u.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td>
                <button
                  className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-green'}`}
                  onClick={() => onToggle(u.username, !u.is_active)}>
                  {u.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Create user form ──────────────────────────────────────────────
function CreateUserForm({ role, onCreated, practices = [] }) {
  const [form, setForm] = useState({
    username:'', password:'', fullName:'', email:'',
    practiceId:'', dsoId:'', identityLabel:''
  });
  const [busy, setBusy] = useState(false);
  const [msg,  setMsg]  = useState(null);

  const submit = async e => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await api.createUser({ ...form, role,
        identityLabel: form.identityLabel || form.username });
      setMsg({ type:'success', text:`✓ ${form.username} created` });
      setForm({ username:'', password:'', fullName:'', email:'',
        practiceId:'', dsoId:'', identityLabel:'' });
      onCreated();
    } catch(e) { setMsg({ type:'error', text: e.message }); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} style={{marginTop:16}}>
      {msg && <div className={`alert alert-${msg.type}`} style={{marginBottom:10}}>{msg.text}</div>}
      <div className="form-grid-2">
        <div className="form-group">
          <label>Username</label>
          <input required value={form.username} onChange={e=>setForm({...form,username:e.target.value})} placeholder="e.g. dr.jane.smith"/>
        </div>
        <div className="form-group">
          <label>Password</label>
          <input required type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Min 8 chars"/>
        </div>
        <div className="form-group">
          <label>Full Name</label>
          <input value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})} placeholder="Dr. Jane Smith"/>
        </div>
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="jane@practice.com"/>
        </div>
        {['dentist','dental_assistant','infection_control'].includes(role) && (
          <div className="form-group">
            <label>Practice</label>
            <select value={form.practiceId} onChange={e=>setForm({...form,practiceId:e.target.value})}>
              <option value="">— Select practice —</option>
              {practices.map(p => <option key={p.practice_id} value={p.practice_id}>{p.name}</option>)}
            </select>
          </div>
        )}
        <div className="form-group">
          <label>Identity Label (Fabric)</label>
          <input value={form.identityLabel} onChange={e=>setForm({...form,identityLabel:e.target.value})}
            placeholder={`${form.username}@DentalChainMSP`}/>
        </div>
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy} style={{marginTop:8}}>
        {busy ? 'Creating…' : `+ Create ${role.replace('_',' ')} User`}
      </button>
    </form>
  );
}

// ── Main Admin Page ───────────────────────────────────────────────
export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('practices');

  const [users,     setUsers]     = useState([]);
  const [practices, setPractices] = useState([]);
  const [dsoGroups, setDsoGroups] = useState([]);
  const [dentists,  setDentists]  = useState([]);
  const [repAssign, setRepAssign] = useState({ repUsername:'', practices:[] });

  // Practice form
  const [practiceForm, setPracticeForm] = useState({
    name:'', address:'', phone:'', email:'', npi:'',
    licenseNumber:'', chairCount:'', implantVolume:'', dsoId:''
  });

  // DSO form
  const [dsoForm, setDsoForm] = useState({ name:'', hqAddress:'', contact:'' });

  // Dentist form
  const [dentistForm, setDentistForm] = useState({
    fullName:'', licenseNumber:'', npi:'', specialty:'general',
    deaNumber:'', practices:[]
  });

  const [msg,  setMsg]  = useState({});
  const [busy, setBusy] = useState({});

  const loadAll = useCallback(async () => {
    try { setUsers(    (await api.getUsers())        || []); } catch { setUsers([]); }
    try { setPractices((await api.getPracticesList())|| []); } catch { setPractices([]); }
    try { setDsoGroups((await api.getDsoGroups())    || []); } catch { setDsoGroups([]); }
    try { setDentists( (await api.getDentistsList()) || []); } catch { setDentists([]); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const toggleUser = async (username, isActive) => {
    try {
      await api.setUserActive(username, isActive);
      loadAll();
    } catch(e) { alert(e.message); }
  };

  const createPractice = async e => {
    e.preventDefault();
    setBusy(b=>({...b,practice:true}));
    try {
      await api.createPractice({
        ...practiceForm,
        practiceId: `PRACTICE-${Date.now()}`,
        chairCount:    parseInt(practiceForm.chairCount)    || 0,
        implantVolume: parseInt(practiceForm.implantVolume) || 0,
      });
      setMsg(m=>({...m,practice:'✓ Practice created'}));
      setPracticeForm({ name:'', address:'', phone:'', email:'', npi:'', licenseNumber:'', chairCount:'', implantVolume:'', dsoId:'' });
      loadAll();
    } catch(e) { setMsg(m=>({...m,practice:`Error: ${e.message}`})); }
    finally { setBusy(b=>({...b,practice:false})); }
  };

  const createDso = async e => {
    e.preventDefault();
    setBusy(b=>({...b,dso:true}));
    try {
      await api.createDsoGroup({ ...dsoForm, dsoId:`DSO-${Date.now()}` });
      setMsg(m=>({...m,dso:'✓ DSO group created'}));
      setDsoForm({ name:'', hqAddress:'', contact:'' });
      loadAll();
    } catch(e) { setMsg(m=>({...m,dso:`Error: ${e.message}`})); }
    finally { setBusy(b=>({...b,dso:false})); }
  };

  const createDentist = async e => {
    e.preventDefault();
    setBusy(b=>({...b,dentist:true}));
    try {
      await api.createDentist({
        ...dentistForm,
        dentistId: `DENTIST-${Date.now()}`,
        practices: dentistForm.practices,
      });
      setMsg(m=>({...m,dentist:'✓ Dentist created'}));
      setDentistForm({ fullName:'', licenseNumber:'', npi:'', specialty:'general', deaNumber:'', practices:[] });
      loadAll();
    } catch(e) { setMsg(m=>({...m,dentist:`Error: ${e.message}`})); }
    finally { setBusy(b=>({...b,dentist:false})); }
  };

  const saveRepPractices = async e => {
    e.preventDefault();
    setBusy(b=>({...b,rep:true}));
    try {
      await api.setRepPractices(repAssign.repUsername, repAssign.practices);
      setMsg(m=>({...m,rep:'✓ Rep practices saved'}));
    } catch(e) { setMsg(m=>({...m,rep:`Error: ${e.message}`})); }
    finally { setBusy(b=>({...b,rep:false})); }
  };

  const TABS = [
    { id:'practices',    label:'🏥 Practices'        },
    { id:'dso',          label:'🏢 DSO Groups'        },
    { id:'dentists',     label:'🦷 Dentists'          },
    { id:'government',   label:'🏛 Government'        },
    { id:'manufacturers',label:'🏭 Manufacturers'     },
    { id:'distributors', label:'🚚 Distributors'      },
    { id:'dentist_users',label:'👨‍⚕️ Dentist Users'    },
    { id:'assistants',   label:'🩺 Dental Assistants' },
    { id:'ic_officers',  label:'🔬 Infection Control' },
    { id:'rep_assign',   label:'📋 Rep Assignments'   },
  ];

  const usersByRole = role => users.filter(u => u.role === role);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">⚙ Admin Portal</h1>
          <p className="page-subtitle">Manage practices, DSO groups, dentists and users</p>
        </div>
      </div>

      {/* Stats */}
      <div className="kpi-grid" style={{gridTemplateColumns:'repeat(5,1fr)',marginBottom:16}}>
        {[
          { label:'Total Users',   value: users.length,                     color:'blue'   },
          { label:'Practices',     value: practices.length,                  color:'green'  },
          { label:'DSO Groups',    value: dsoGroups.length,                  color:'cyan'   },
          { label:'Dentists',      value: dentists.length,                   color:'purple' },
          { label:'Active Users',  value: users.filter(u=>u.is_active).length, color:'green'},
        ].map(k => (
          <div key={k.label} className={`kpi-card ${k.color}`}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{color:`var(--accent-${k.color})`}}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="tab-bar" style={{marginBottom:16,display:'flex',flexWrap:'wrap',gap:6}}>
        {TABS.map(t => (
          <button key={t.id}
            className={`btn btn-sm ${tab===t.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PRACTICES ── */}
      {tab === 'practices' && (
        <div>
          <div className="card" style={{marginBottom:12}}>
            <div className="card-header"><span className="card-title">+ Add Practice</span></div>
            {msg.practice && <div className="alert alert-success" style={{marginBottom:10}}>{msg.practice}</div>}
            <form onSubmit={createPractice}>
              <div className="form-grid-2">
                <div className="form-group"><label>Practice Name *</label>
                  <input required value={practiceForm.name} onChange={e=>setPracticeForm({...practiceForm,name:e.target.value})} placeholder="Smile Dental Group"/></div>
                <div className="form-group"><label>Address</label>
                  <input value={practiceForm.address} onChange={e=>setPracticeForm({...practiceForm,address:e.target.value})}/></div>
                <div className="form-group"><label>Phone</label>
                  <input value={practiceForm.phone} onChange={e=>setPracticeForm({...practiceForm,phone:e.target.value})}/></div>
                <div className="form-group"><label>Email</label>
                  <input type="email" value={practiceForm.email} onChange={e=>setPracticeForm({...practiceForm,email:e.target.value})}/></div>
                <div className="form-group"><label>NPI Number</label>
                  <input value={practiceForm.npi} onChange={e=>setPracticeForm({...practiceForm,npi:e.target.value})}/></div>
                <div className="form-group"><label>License Number</label>
                  <input value={practiceForm.licenseNumber} onChange={e=>setPracticeForm({...practiceForm,licenseNumber:e.target.value})}/></div>
                <div className="form-group"><label>Chair Count</label>
                  <input type="number" value={practiceForm.chairCount} onChange={e=>setPracticeForm({...practiceForm,chairCount:e.target.value})}/></div>
                <div className="form-group"><label>Implants/Month</label>
                  <input type="number" value={practiceForm.implantVolume} onChange={e=>setPracticeForm({...practiceForm,implantVolume:e.target.value})}/></div>
                <div className="form-group"><label>DSO Group</label>
                  <select value={practiceForm.dsoId} onChange={e=>setPracticeForm({...practiceForm,dsoId:e.target.value})}>
                    <option value="">— Independent —</option>
                    {dsoGroups.map(d=><option key={d.dso_id} value={d.dso_id}>{d.name}</option>)}
                  </select></div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={busy.practice} style={{marginTop:8}}>
                {busy.practice ? 'Saving…' : '+ Add Practice'}
              </button>
            </form>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">All Practices ({practices.length})</span></div>
            {practices.length === 0 ? <div className="empty-state"><p>No practices yet</p></div> : (
              <div className="table-wrap"><table className="data-table">
                <thead><tr><th>Practice ID</th><th>Name</th><th>NPI</th><th>Chairs</th><th>Implants/mo</th><th>DSO</th></tr></thead>
                <tbody>
                  {practices.map(p=>(
                    <tr key={p.practice_id}>
                      <td style={{fontFamily:'monospace',fontSize:11}}>{p.practice_id}</td>
                      <td style={{fontWeight:600}}>{p.name}</td>
                      <td>{p.npi||'—'}</td>
                      <td style={{textAlign:'center'}}>{p.chair_count||0}</td>
                      <td style={{textAlign:'center'}}>{p.implant_volume||0}</td>
                      <td>{p.dso_id||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>
        </div>
      )}

      {/* ── DSO GROUPS ── */}
      {tab === 'dso' && (
        <div>
          <div className="card" style={{marginBottom:12}}>
            <div className="card-header"><span className="card-title">+ Add DSO Group</span></div>
            {msg.dso && <div className="alert alert-success" style={{marginBottom:10}}>{msg.dso}</div>}
            <form onSubmit={createDso}>
              <div className="form-grid-2">
                <div className="form-group"><label>DSO Name *</label>
                  <input required value={dsoForm.name} onChange={e=>setDsoForm({...dsoForm,name:e.target.value})} placeholder="Aspen Dental Management"/></div>
                <div className="form-group"><label>HQ Address</label>
                  <input value={dsoForm.hqAddress} onChange={e=>setDsoForm({...dsoForm,hqAddress:e.target.value})}/></div>
                <div className="form-group"><label>Contact Email</label>
                  <input type="email" value={dsoForm.contact} onChange={e=>setDsoForm({...dsoForm,contact:e.target.value})}/></div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={busy.dso} style={{marginTop:8}}>
                {busy.dso ? 'Saving…' : '+ Add DSO Group'}
              </button>
            </form>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">DSO Groups ({dsoGroups.length})</span></div>
            {dsoGroups.length === 0 ? <div className="empty-state"><p>No DSO groups yet</p></div> : (
              <div className="table-wrap"><table className="data-table">
                <thead><tr><th>DSO ID</th><th>Name</th><th>HQ Address</th><th>Contact</th></tr></thead>
                <tbody>
                  {dsoGroups.map(d=>(
                    <tr key={d.dso_id}>
                      <td style={{fontFamily:'monospace',fontSize:11}}>{d.dso_id}</td>
                      <td style={{fontWeight:600}}>{d.name}</td>
                      <td>{d.hq_address||'—'}</td>
                      <td>{d.contact||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>
        </div>
      )}

      {/* ── DENTISTS ── */}
      {tab === 'dentists' && (
        <div>
          <div className="card" style={{marginBottom:12}}>
            <div className="card-header"><span className="card-title">+ Add Dentist</span></div>
            {msg.dentist && <div className="alert alert-success" style={{marginBottom:10}}>{msg.dentist}</div>}
            <form onSubmit={createDentist}>
              <div className="form-grid-2">
                <div className="form-group"><label>Full Name *</label>
                  <input required value={dentistForm.fullName} onChange={e=>setDentistForm({...dentistForm,fullName:e.target.value})} placeholder="Dr. Jane Smith"/></div>
                <div className="form-group"><label>License Number</label>
                  <input value={dentistForm.licenseNumber} onChange={e=>setDentistForm({...dentistForm,licenseNumber:e.target.value})}/></div>
                <div className="form-group"><label>NPI</label>
                  <input value={dentistForm.npi} onChange={e=>setDentistForm({...dentistForm,npi:e.target.value})}/></div>
                <div className="form-group"><label>Specialty</label>
                  <select value={dentistForm.specialty} onChange={e=>setDentistForm({...dentistForm,specialty:e.target.value})}>
                    <option value="general">General</option>
                    <option value="oral_surgeon">Oral Surgeon</option>
                    <option value="periodontist">Periodontist</option>
                    <option value="prosthodontist">Prosthodontist</option>
                    <option value="implantologist">Implantologist</option>
                  </select></div>
                <div className="form-group"><label>DEA Number</label>
                  <input value={dentistForm.deaNumber} onChange={e=>setDentistForm({...dentistForm,deaNumber:e.target.value})}/></div>
                <div className="form-group"><label>Practices</label>
                  <select multiple value={dentistForm.practices}
                    onChange={e=>setDentistForm({...dentistForm,practices:[...e.target.selectedOptions].map(o=>o.value)})}>
                    {practices.map(p=><option key={p.practice_id} value={p.practice_id}>{p.name}</option>)}
                  </select></div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={busy.dentist} style={{marginTop:8}}>
                {busy.dentist ? 'Saving…' : '+ Add Dentist'}
              </button>
            </form>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">Dentists ({dentists.length})</span></div>
            {dentists.length === 0 ? <div className="empty-state"><p>No dentists yet</p></div> : (
              <div className="table-wrap"><table className="data-table">
                <thead><tr><th>Dentist ID</th><th>Full Name</th><th>Specialty</th><th>NPI</th><th>License</th><th>Practices</th></tr></thead>
                <tbody>
                  {dentists.map(d=>(
                    <tr key={d.dentist_id}>
                      <td style={{fontFamily:'monospace',fontSize:11}}>{d.dentist_id}</td>
                      <td style={{fontWeight:600}}>{d.full_name}</td>
                      <td><span className="badge badge-purple">{d.specialty}</span></td>
                      <td>{d.npi||'—'}</td>
                      <td>{d.license_number||'—'}</td>
                      <td style={{fontSize:11}}>{(d.practices||[]).join(', ')||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>
        </div>
      )}

      {/* ── USER TABS ── */}
      {tab === 'government' && (
        <div className="card">
          <div className="card-header"><span className="card-title">🏛 Government / FDA Users</span></div>
          <UserTable users={usersByRole('government')} onToggle={toggleUser}/>
          <CreateUserForm role="government" onCreated={loadAll} practices={practices}/>
        </div>
      )}
      {tab === 'manufacturers' && (
        <div className="card">
          <div className="card-header"><span className="card-title">🏭 Manufacturer Users</span></div>
          <UserTable users={usersByRole('manufacturer')} onToggle={toggleUser}/>
          <CreateUserForm role="manufacturer" onCreated={loadAll} practices={practices}/>
        </div>
      )}
      {tab === 'distributors' && (
        <div className="card">
          <div className="card-header"><span className="card-title">🚚 Distributor / Rep Users</span></div>
          <UserTable users={usersByRole('distributor')} onToggle={toggleUser}/>
          <CreateUserForm role="distributor" onCreated={loadAll} practices={practices}/>
        </div>
      )}
      {tab === 'dentist_users' && (
        <div className="card">
          <div className="card-header"><span className="card-title">👨‍⚕️ Dentist Users</span></div>
          <UserTable users={usersByRole('dentist')} onToggle={toggleUser}/>
          <CreateUserForm role="dentist" onCreated={loadAll} practices={practices}/>
        </div>
      )}
      {tab === 'assistants' && (
        <div className="card">
          <div className="card-header"><span className="card-title">🩺 Dental Assistant Users</span></div>
          <UserTable users={usersByRole('dental_assistant')} onToggle={toggleUser}/>
          <CreateUserForm role="dental_assistant" onCreated={loadAll} practices={practices}/>
        </div>
      )}
      {tab === 'ic_officers' && (
        <div className="card">
          <div className="card-header"><span className="card-title">🔬 Infection Control Officers</span></div>
          <UserTable users={usersByRole('infection_control')} onToggle={toggleUser}/>
          <CreateUserForm role="infection_control" onCreated={loadAll} practices={practices}/>
        </div>
      )}

      {/* ── REP ASSIGNMENTS ── */}
      {tab === 'rep_assign' && (
        <div className="card">
          <div className="card-header"><span className="card-title">📋 Rep Practice Assignments</span></div>
          <p style={{fontSize:13,color:'var(--text-secondary)',marginBottom:12}}>
            Assign which practices each rep is authorized to serve. Territory enforcement is applied at consignment creation.
          </p>
          {msg.rep && <div className="alert alert-success" style={{marginBottom:10}}>{msg.rep}</div>}
          <form onSubmit={saveRepPractices}>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Rep Username</label>
                <select required value={repAssign.repUsername}
                  onChange={e=>setRepAssign({...repAssign,repUsername:e.target.value})}>
                  <option value="">— Select rep —</option>
                  {usersByRole('distributor').map(u=>(
                    <option key={u.username} value={u.username}>{u.username} — {u.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Assigned Practices (hold Cmd/Ctrl to multi-select)</label>
                <select multiple value={repAssign.practices}
                  onChange={e=>setRepAssign({...repAssign,practices:[...e.target.selectedOptions].map(o=>o.value)})}
                  style={{height:120}}>
                  {practices.map(p=><option key={p.practice_id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy.rep} style={{marginTop:8}}>
              {busy.rep ? 'Saving…' : '💾 Save Assignments'}
            </button>
          </form>

          <div style={{marginTop:20}}>
            <div className="card-header"><span className="card-title">Current Assignments</span></div>
            <div className="table-wrap"><table className="data-table">
              <thead><tr><th>Rep Username</th><th>Assigned Practices</th></tr></thead>
              <tbody>
                {usersByRole('distributor').map(u => {
                  const assigned = u.assigned_practices || [];
                  return (
                    <tr key={u.username}>
                      <td style={{fontFamily:'monospace',fontSize:12}}>{u.username}</td>
                      <td style={{fontSize:12}}>{assigned.length > 0 ? assigned.join(', ') : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </div>
        </div>
      )}
    </div>
  );
}
