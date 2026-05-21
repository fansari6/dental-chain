import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import show from '../assets/show.png';
import hide from '../assets/hide.png';

// ─── Constants ────────────────────────────────────────────────────
const SPECIALTIES = [
  'Cardiac Surgery','General Surgery','Neurosurgery','Orthopedic Surgery',
  'Plastic Surgery','Thoracic Surgery','Urology','Vascular Surgery','Other',
];

const ORG_TYPES = ['manufacturer','distributor','other'];

const LOOKUP_CATEGORIES = [
  {key:'procedure_orthopedic',   label:'Procedures — Orthopedic'},
  {key:'procedure_cardiac',      label:'Procedures — Cardiac'},
  {key:'procedure_neurosurgery', label:'Procedures — Neurosurgery'},
  {key:'procedure_general_surgery',label:'Procedures — General Surgery'},
  {key:'location_orthopedic',    label:'Locations — Orthopedic'},
  {key:'location_cardiac',       label:'Locations — Cardiac'},
  {key:'location_neurosurgery',  label:'Locations — Neurosurgery'},
  {key:'location_general_surgery',label:'Locations — General Surgery'},
  {key:'explant_reason',         label:'Explant Reasons'},
  {key:'disposition',            label:'Device Dispositions'},
  {key:'storage_conditions',     label:'Storage Conditions'},
  {key:'opened_not_implanted_reason',label:'Opened/Not Implanted Reasons'},
];

const BF_DEVICE_TYPES = {
  cardiac:         ['balloon_pump','catheter','defibrillator','pacemaker','recorder','stent','valve','vad'],
  general_surgery: ['collagen_product','mesh','other','tissue_expander'],
  neurosurgery:    ['cage','catheter','cranial_plate','drug_pump','plate','rod','screw','shunt_valve','stimulator'],
  orthopedic:      ['biologic','bone_cement','growth_factor','joint','plate','rod','screw','spacer'],
};

const BF_BODY_LOCS = {
  joint:['Left Hip','Right Hip','Left Knee','Right Knee','Left Shoulder','Right Shoulder','Left Ankle','Right Ankle'],
  pacemaker:['Left Ventricle','Right Ventricle','Left Atrium','Right Atrium'],
  defibrillator:['Left Ventricle','Right Ventricle'],
  valve:['Aortic Valve','Mitral Valve','Tricuspid Valve','Pulmonary Valve'],
  recorder:['Left Ventricle','Right Ventricle','Left Coronary Artery','Right Coronary Artery'],
  stent:['Left Coronary Artery','Right Coronary Artery','Aorta','Femoral Artery'],
  balloon_pump:['Aorta'],vad:['Left Ventricle','Right Ventricle'],
  catheter:['Left Coronary Artery','Right Coronary Artery','Left Ventricle','Right Ventricle'],
  cage:['Cervical Spine (C1-C7)','Thoracic Spine (T1-T12)','L3/L4','L4/L5','L5/S1'],
  rod:['Cervical Spine (C1-C7)','Thoracic Spine (T1-T12)','Lumbar Spine (L1-L5)','L3/L4','L4/L5','L5/S1'],
  spacer:['L3/L4','L4/L5','L5/S1','Cervical Spine (C1-C7)'],
  stimulator:['Lumbar Spine (L1-L5)','Thoracic Spine (T1-T12)','Cervical Spine (C1-C7)'],
  shunt_valve:['Brain - Left Hemisphere','Brain - Right Hemisphere','Cranium'],
  cranial_plate:['Cranium'],drug_pump:['Lumbar Spine (L1-L5)','Abdomen'],
  screw:['Left Hip','Right Hip','Cervical Spine (C1-C7)','Lumbar Spine (L1-L5)','L3/L4','L4/L5','L5/S1'],
  plate:['Left Hip','Right Hip','Cervical Spine (C1-C7)','Cranium'],
  biologic:['Left Knee','Right Knee','Left Hip','Right Hip','Left Shoulder','Right Shoulder'],
  bone_cement:['Left Hip','Right Hip','Left Knee','Right Knee'],
  growth_factor:['Left Knee','Right Knee','Left Hip','Right Hip','Lumbar Spine (L1-L5)'],
  mesh:['Abdomen','Pelvis','Groin - Left','Groin - Right'],
  tissue_expander:['Left Breast','Right Breast'],collagen_product:['Abdomen','Left Knee','Right Knee'],
  other:['Other'],
};

// ─── Shared components ────────────────────────────────────────────

function EditableFullName({ username, fullName, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value,   setValue]   = useState(fullName || '');
  const [saving,  setSaving]  = useState(false);
  const save = async () => {
    setSaving(true);
    try { await api.updateUserFullName(username, value); setEditing(false); onSaved(); } catch {}
    setSaving(false);
  };
  if (editing) return (
    <div style={{display:'flex',gap:4,alignItems:'center'}}>
      <input value={value} onChange={e=>setValue(e.target.value)} autoFocus
        onKeyDown={e=>{ if(e.key==='Enter') save(); if(e.key==='Escape') setEditing(false); }}
        style={{flex:1,fontSize:12,padding:'3px 6px'}}/>
      <button className="btn btn-primary btn-sm" disabled={saving} onClick={save}
        style={{padding:'3px 8px',fontSize:11}}>
        {saving?<span className="spinner" style={{width:10,height:10}}/>:'✓'}
      </button>
      <button className="btn btn-ghost btn-sm" onClick={()=>setEditing(false)}
        style={{padding:'3px 6px',fontSize:11}}>✕</button>
    </div>
  );
  return (
    <div style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer'}}
      onClick={()=>{ setValue(fullName||''); setEditing(true); }}>
      <span style={{color:fullName?'var(--text-primary)':'var(--text-muted)',fontSize:12}}>
        {fullName||'—'}
      </span>
      <span style={{fontSize:10,color:'var(--text-muted)',opacity:0.5}}>✏</span>
    </div>
  );
}

function HospitalMultiSelect({ hospitals, selected, onChange }) {
  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:6,padding:'8px 10px',
      background:'var(--bg-secondary)',borderRadius:'var(--radius-sm)',
      border:'1px solid var(--border)',minHeight:40}}>
      {hospitals.length===0
        ? <span style={{fontSize:12,color:'var(--text-muted)'}}>No hospitals configured</span>
        : hospitals.map(h=>(
          <label key={h.id} className="checkbox-group"
            style={{margin:0,padding:'4px 10px',background:'var(--bg-card)',
              borderRadius:'var(--radius-sm)',fontSize:12,cursor:'pointer',
              border:`1px solid ${selected.includes(h.name)?'var(--accent-cyan)':'var(--border)'}`}}>
            <input type="checkbox" checked={selected.includes(h.name)}
              onChange={e=>{ if(e.target.checked) onChange([...selected,h.name]); else onChange(selected.filter(n=>n!==h.name)); }}/>
            <span style={{marginLeft:5}}>{h.name}</span>
          </label>
        ))
      }
    </div>
  );
}

// ── Reusable user list table (shared by all role tabs) ─────────────
function UserList({ users, extraColumns, onToggle, actBusy, onSaved, extraActions }) {
  return users.length===0
    ? <div className="empty-state"><div className="icon">👤</div><p>No users yet</p></div>
    : <div className="table-wrap"><table>
        <thead><tr>
          <th>Username</th><th>Full Name</th>
          {extraColumns.map(c=><th key={c.key}>{c.label}</th>)}
          <th>Status</th><th>Created</th><th>Actions</th>
        </tr></thead>
        <tbody>{users.map(u=>(
          <tr key={u.id}>
            <td>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:28,height:28,borderRadius:'50%',
                  background:'var(--accent-blue)',display:'flex',alignItems:'center',
                  justifyContent:'center',fontSize:12,color:'#fff',fontWeight:700,flexShrink:0}}>
                  {u.username.charAt(0).toUpperCase()}
                </div>
                <span style={{fontSize:13}}>{u.username}</span>
              </div>
            </td>
            <td style={{minWidth:160}}>
              <EditableFullName username={u.username} fullName={u.full_name} onSaved={onSaved}/>
            </td>
            {extraColumns.map(c=>(
              <td key={c.key} style={{fontSize:12}}>{c.render ? c.render(u) : (u[c.field]||'—')}</td>
            ))}
            <td>
              <span className={`badge ${u.is_active?'badge-green':'badge-red'}`}>
                {u.is_active?'Active':'Inactive'}
              </span>
            </td>
            <td style={{fontSize:11}}>{u.created_at?new Date(u.created_at).toLocaleDateString():'—'}</td>
            <td>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {extraActions && extraActions(u)}
                <button
                  className={`btn btn-sm ${u.is_active?'btn-danger':'btn-success'}`}
                  disabled={actBusy[u.username]}
                  onClick={()=>onToggle(u.username, u.is_active)}>
                  {actBusy[u.username]
                    ? <span className="spinner" style={{width:12,height:12}}/>
                    : u.is_active?'Deactivate':'Activate'}
                </button>
              </div>
            </td>
          </tr>
        ))}</tbody>
      </table></div>;
}

// ── Password field with show/hide ──────────────────────────────────
function PasswordField({ value, onChange, showPwd, onToggle }) {
  return (
    <div style={{position:'relative'}}>
      <input type={showPwd?'text':'password'} placeholder="Min. 8 characters"
        value={value} onChange={onChange} minLength={8} required style={{paddingRight:42}}/>
      <button type="button" onClick={onToggle}
        style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',
          background:'none',border:'none',cursor:'pointer'}}>
        <img src={showPwd?hide:show} alt="toggle" style={{width:15,height:15,filter:'invert(1)'}}/>
      </button>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab] = useState('government');

  // ── Shared data ───────────────────────────────────────────────
  const [users,     setUsers]     = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [orgs,      setOrgs]      = useState([]);
  const [mfrs,      setMfrs]      = useState([]);
  const [uLoading,  setULoading]  = useState(false);
  const [actBusy,   setActBusy]   = useState({});

  // ── Per-tab create forms ───────────────────────────────────────
  const emptyBase = {username:'',fullName:'',password:''};
  const [forms, setForms] = useState({
    government:           {...emptyBase, organization:''},
    manufacturer:         {...emptyBase, organization:''},
    distributor:          {...emptyBase, organization:''},
    nurse:                {...emptyBase, hospitalId:''},
    supply_chain:         {...emptyBase, hospitalId:''},
    infection_prevention: {...emptyBase, hospitalId:''},
  });
  const [tabMsg,    setTabMsg]    = useState({});
  const [tabBusy,   setTabBusy]   = useState({});
  const [showPwdFor,setShowPwdFor]= useState(null);

  const setF = (role, key, val) =>
    setForms(f=>({...f,[role]:{...f[role],[key]:val}}));

  // ── Organizations ──────────────────────────────────────────────
  const [oLoading,    setOLoading]    = useState(false);
  const [oForm,       setOForm]       = useState({name:'',type:'',address:'',contact:'',website:''});
  const [oBusy,       setOBusy]       = useState(false);
  const [oMsg,        setOMsg]        = useState(null);
  const [editOrg,     setEditOrg]     = useState(null);
  const [orgMsg,      setOrgMsg]      = useState(null);
  const [orgBusySave, setOrgBusySave] = useState(false);
  const so = (k,v) => setOForm(f=>({...f,[k]:v}));

  // ── Hospitals ──────────────────────────────────────────────────
  const [hLoading,    setHLoading]    = useState(false);
  const [hForm,       setHForm]       = useState({name:'',address:'',contact:'',accreditation:'',bedCount:''});
  const [hBusy,       setHBusy]       = useState(false);
  const [hMsg,        setHMsg]        = useState(null);
  const [editHosp,    setEditHosp]    = useState(null);
  const [hospMsg,     setHospMsg]     = useState(null);
  const [hospBusySave,setHospBusySave]= useState(false);
  const sh = (k,v) => setHForm(f=>({...f,[k]:v}));

  // ── Surgeons ───────────────────────────────────────────────────
  const [surgeons,        setSurgeons]        = useState([]);
  const [sLoading,        setSLoading]        = useState(false);
  const [sForm,           setSForm]           = useState({surgeonId:'',fullName:'',licenseNumber:'',specialty:'',hospitals:[],npi:''});
  const [sBusy,           setSBusy]           = useState(false);
  const [sMsg,            setSMsg]            = useState(null);
  const [editSurg,        setEditSurg]        = useState(null);
  const [createLoginSurg, setCreateLoginSurg] = useState(null);
  const [createLoginForm, setCreateLoginForm] = useState({password:'',fullName:''});
  const [createLoginBusy, setCreateLoginBusy] = useState(false);
  const [createLoginMsg,  setCreateLoginMsg]  = useState(null);
  const [surgActBusy,     setSurgActBusy]     = useState({});
  const [loginRevokeBusy, setLoginRevokeBusy] = useState({});
  const [showSurgPwd,     setShowSurgPwd]     = useState(false);
  const ss = (k,v) => setSForm(f=>({...f,[k]:v}));

  // ── Rep hospital assignment ────────────────────────────────────
  const [repHospModal,   setRepHospModal]   = useState(null);
  const [repHospChecked, setRepHospChecked] = useState([]);
  const [repHospBusy,    setRepHospBusy]    = useState(false);
  const [repHospMsg,     setRepHospMsg]     = useState(null);

  // ── Lookup values ──────────────────────────────────────────────
  const [lookupCat,   setLookupCat]   = useState('procedure_orthopedic');
  const [lookupItems, setLookupItems] = useState([]);
  const [lLoading,    setLLoading]    = useState(false);
  const [newValue,    setNewValue]    = useState('');
  const [lBusy,       setLBusy]       = useState(false);
  const [lMsg,        setLMsg]        = useState(null);

  // ── Brownfield ─────────────────────────────────────────────────
  const [onboardingReqs,setOnboardingReqs]= useState([]);
  const [bfForm,setBfForm] = useState({
    udiDI:'',deviceName:'',manufacturerId:'',deviceCategory:'',deviceType:'',
    singleUse:false,sterile:true,containsLatex:false,mriSafe:'conditional',
    bodyLocations:[],clearanceNumber:'',clearanceType:'',clearanceDate:'',gudidVerified:false,
  });
  const [bfMsg, setBfMsg] = useState(null);
  const [bfBusy,setBfBusy]= useState(false);
  const sbf = (k,v) => setBfForm(f=>({...f,[k]:v}));

  // ── Derived user lists ─────────────────────────────────────────
  const usersOf = (role) => users.filter(u=>u.role===role);
  const surgeonUsernames = new Set(users.filter(u=>u.role==='surgeon').map(u=>u.username));

  // ── Data loaders ──────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setULoading(true);
    try { setUsers((await api.getUsers())||[]); } catch { setUsers([]); }
    finally { setULoading(false); }
  }, []);

  const loadHospitals = useCallback(async () => {
    setHLoading(true);
    try { setHospitals((await api.getHospitals())||[]); } catch { setHospitals([]); }
    finally { setHLoading(false); }
  }, []);

  const loadOrgs = useCallback(async () => {
    setOLoading(true);
    try { setOrgs((await api.getOrganizations())||[]); } catch { setOrgs([]); }
    finally { setOLoading(false); }
  }, []);

  const loadSurgeons = useCallback(async () => {
    setSLoading(true);
    try { setSurgeons((await api.getSurgeons(null,null))||[]); } catch { setSurgeons([]); }
    finally { setSLoading(false); }
  }, []);

  const loadLookup = useCallback(async (cat) => {
    setLLoading(true);
    try {
      const all = await api.getLookupValues();
      setLookupItems((all||[]).filter(r=>r.category===cat));
    } catch { setLookupItems([]); }
    finally { setLLoading(false); }
  }, []);

  const loadOnboardingReqs = useCallback(async () => {
    try { setOnboardingReqs((await api.getOnboardingRequests())||[]); } catch {}
  }, []);

  useEffect(() => {
    loadUsers(); loadHospitals(); loadOrgs();
    api.getUsersByRole('manufacturer').then(setMfrs).catch(()=>{});
  }, [loadUsers,loadHospitals,loadOrgs]);
  useEffect(() => { if(tab==='surgeons') loadSurgeons(); }, [tab,loadSurgeons]);
  useEffect(() => { if(tab==='lookup')   loadLookup(lookupCat); }, [tab,lookupCat,loadLookup]);
  useEffect(() => { if(tab==='brownfield') loadOnboardingReqs(); }, [tab,loadOnboardingReqs]);

  // ── Handlers ──────────────────────────────────────────────────

  const handleCreateUser = async (e, role, formData) => {
    e.preventDefault();
    setTabBusy(b=>({...b,[role]:true}));
    setTabMsg(m=>({...m,[role]:null}));
    try {
      await api.createUser({ ...formData, role });
      setTabMsg(m=>({...m,[role]:{type:'success',text:`"${formData.username}" created.`}}));
      setTimeout(()=>setTabMsg(m=>({...m,[role]:null})), 3000);
      setForms(f=>({...f,[role]:{...emptyBase,
        ...(formData.organization!==undefined ? {organization:''} : {}),
        ...(formData.hospitalId!==undefined   ? {hospitalId:''}   : {}),
      }}));
      loadUsers();
    } catch(err) {
      setTabMsg(m=>({...m,[role]:{type:'error',text:err.message}}));
    }
    setTabBusy(b=>({...b,[role]:false}));
  };

  const toggleActive = async (username, isActive) => {
    setActBusy(a=>({...a,[username]:true}));
    try {
      isActive ? await api.deactivateUser(username) : await api.activateUser(username);
      loadUsers();
    } catch(err) { console.error(err); }
    finally { setActBusy(a=>({...a,[username]:false})); }
  };

  const openRepHospModal = async (username) => {
    setRepHospModal(username); setRepHospMsg(null); setRepHospChecked([]);
    try { setRepHospChecked((await api.getRepHospitals(username))||[]); } catch {}
  };

  const saveRepHospitals = async () => {
    setRepHospBusy(true); setRepHospMsg(null);
    try {
      await api.setRepHospitals(repHospModal, repHospChecked);
      setRepHospMsg({type:'success',text:'Territory saved.'});
      setTimeout(()=>{ setRepHospModal(null); setRepHospMsg(null); },1500);
    } catch(err) { setRepHospMsg({type:'error',text:err.message}); }
    finally { setRepHospBusy(false); }
  };

  // ── Expand surgeons (multi-hospital display) ───────────────────
  const expandedSurgeonRows = (() => {
    const rows = [];
    surgeons.forEach(s => {
      const hospList = (s.hospitals&&s.hospitals.length>0) ? s.hospitals : ['No Hospital'];
      hospList.forEach(hosp => rows.push({...s, displayHospital:hosp}));
    });
    rows.sort((a,b)=>{
      if(a.active!==b.active) return a.active?-1:1;
      return a.displayHospital.localeCompare(b.displayHospital)||
        (a.specialty||'').localeCompare(b.specialty||'')||
        a.full_name.localeCompare(b.full_name);
    });
    return rows;
  })();

  // ── Tab style helper ───────────────────────────────────────────
  const tabStyle = t => ({
    padding:'7px 14px', borderRadius:'var(--radius-sm)', cursor:'pointer',
    fontSize:12, fontWeight:600, border:'none', whiteSpace:'nowrap',
    background: tab===t ? 'var(--accent-blue)' : 'transparent',
    color: tab===t ? '#fff' : 'var(--text-secondary)',
  });

  // ── Reusable create form wrapper ───────────────────────────────
  const Msg = ({role}) => tabMsg[role] ? (
    <div className={`alert alert-${tabMsg[role].type}`} style={{marginBottom:12}}>
      {tabMsg[role].type==='error'?'⚠':'✓'} {tabMsg[role].text}
    </div>
  ) : null;

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <>
      {/* ── Rep Hospital Assignment Modal ── */}
      {repHospModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1000,
          display:'flex',alignItems:'center',justifyContent:'center'}}
          onClick={()=>{setRepHospModal(null);setRepHospMsg(null);}}>
          <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',
            borderRadius:'var(--radius-lg)',padding:28,width:480,maxHeight:'70vh',overflowY:'auto'}}
            onClick={e=>e.stopPropagation()}>
            <h3 style={{marginBottom:4}}>🏥 Hospital Territory — {repHospModal}</h3>
            <p style={{fontSize:12,color:'var(--text-secondary)',marginBottom:16}}>
              Select hospitals this rep is authorized to serve. Rep can only create consignments at assigned hospitals.
            </p>
            {repHospMsg && <div className={`alert alert-${repHospMsg.type}`} style={{marginBottom:12}}>{repHospMsg.text}</div>}
            <HospitalMultiSelect hospitals={hospitals} selected={repHospChecked} onChange={setRepHospChecked}/>
            <div style={{display:'flex',gap:8,marginTop:16}}>
              <button className="btn btn-primary" style={{flex:1}} disabled={repHospBusy} onClick={saveRepHospitals}>
                {repHospBusy?<><span className="spinner" style={{width:14,height:14}}/> Saving…</>:'💾 Save Territory'}
              </button>
              <button className="btn btn-ghost" onClick={()=>{setRepHospModal(null);setRepHospMsg(null);}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <h2>⚙ Admin Portal</h2>
        <p>Manage users by role, organizations, hospitals, surgeons, lookup values, and device onboarding</p>
      </div>

      {/* ── Tab bar ── */}
      <div style={{display:'flex',gap:3,marginBottom:20,background:'var(--bg-card)',
        padding:4,borderRadius:'var(--radius-md)',border:'1px solid var(--border)',flexWrap:'wrap'}}>
        <button style={tabStyle('government')}           onClick={()=>setTab('government')}>🏛 Government</button>
        <button style={tabStyle('manufacturer')}         onClick={()=>setTab('manufacturer')}>🏭 Manufacturers</button>
        <button style={tabStyle('distributor')}          onClick={()=>setTab('distributor')}>🚚 Distributors</button>
        <button style={tabStyle('nurse')}                onClick={()=>setTab('nurse')}>🩺 Nurses</button>
        <button style={tabStyle('supply_chain')}         onClick={()=>setTab('supply_chain')}>📦 Supply Chain</button>
        <button style={tabStyle('infection_prevention')} onClick={()=>setTab('infection_prevention')}>🔬 Infection Prev.</button>
        <button style={tabStyle('surgeons')}             onClick={()=>setTab('surgeons')}>🔪 Surgeons</button>
        <button style={tabStyle('organizations')}        onClick={()=>setTab('organizations')}>🏢 Organizations</button>
        <button style={tabStyle('hospitals')}            onClick={()=>setTab('hospitals')}>🏥 Hospitals</button>
        <button style={tabStyle('lookup')}               onClick={()=>setTab('lookup')}>📋 Lookup Values</button>
        <button style={tabStyle('brownfield')}           onClick={()=>setTab('brownfield')}>
          🏥 Brownfield
          {onboardingReqs.filter(r=>r.status==='pending').length>0 && (
            <span className="badge badge-cyan" style={{marginLeft:5,fontSize:10}}>
              {onboardingReqs.filter(r=>r.status==='pending').length}
            </span>
          )}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════
          GOVERNMENT
      ══════════════════════════════════════════════════ */}
      {tab==='government' && (
        <>
          <div className="card">
            <div className="card-header">
              <span className="card-title">🏛 Add Government / FDA User</span>
              <span className="badge badge-blue">Fabric CA Auto-provisioned</span>
            </div>
            <Msg role="government"/>
            <form onSubmit={e=>handleCreateUser(e,'government',forms.government)}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:16,marginBottom:14}}>
                <div className="form-group" style={{gridColumn:'span 2'}}>
                  <label>Username</label>
                  <input placeholder="e.g. fda-inspector1" value={forms.government.username}
                    onChange={e=>setF('government','username',e.target.value)} required
                    pattern="[a-zA-Z0-9_\-]+" title="Letters, numbers, hyphens, underscores"/>
                </div>
                <div className="form-group" style={{gridColumn:'span 3'}}>
                  <label>Full Name</label>
                  <input placeholder="e.g. Dr. Jane Smith" value={forms.government.fullName}
                    onChange={e=>setF('government','fullName',e.target.value)}/>
                </div>
                <div className="form-group" style={{gridColumn:'span 3'}}>
                  <label>Password</label>
                  <PasswordField value={forms.government.password}
                    onChange={e=>setF('government','password',e.target.value)}
                    showPwd={showPwdFor==='government'} onToggle={()=>setShowPwdFor(v=>v==='government'?null:'government')}/>
                </div>
                <div className="form-group" style={{gridColumn:'span 2'}}>
                  <label>Organization</label>
                  <input placeholder="e.g. FDA" value={forms.government.organization}
                    onChange={e=>setF('government','organization',e.target.value)}/>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={tabBusy.government||!forms.government.username||!forms.government.password}>
                {tabBusy.government?<><span className="spinner" style={{width:14,height:14}}/> Provisioning…</>:'+ Add Government User'}
              </button>
            </form>
          </div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Government Users <span className="badge badge-blue">{usersOf('government').length}</span></span>
              <button className="btn btn-ghost btn-sm" onClick={loadUsers}>↻ Refresh</button>
            </div>
            <UserList
              users={usersOf('government')}
              extraColumns={[{key:'org',label:'Organization',field:'organization'}]}
              actBusy={actBusy} onToggle={toggleActive} onSaved={loadUsers}/>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════
          MANUFACTURERS
      ══════════════════════════════════════════════════ */}
      {tab==='manufacturer' && (
        <>
          <div className="card">
            <div className="card-header">
              <span className="card-title">🏭 Add Manufacturer User</span>
              <span className="badge badge-green">Fabric CA Auto-provisioned</span>
            </div>
            <Msg role="manufacturer"/>
            <form onSubmit={e=>handleCreateUser(e,'manufacturer',forms.manufacturer)}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:16,marginBottom:14}}>
                <div className="form-group" style={{gridColumn:'span 2'}}>
                  <label>Username</label>
                  <input placeholder="e.g. stryker" value={forms.manufacturer.username}
                    onChange={e=>setF('manufacturer','username',e.target.value)} required
                    pattern="[a-zA-Z0-9_\-]+"/>
                </div>
                <div className="form-group" style={{gridColumn:'span 3'}}>
                  <label>Full Name / Contact</label>
                  <input placeholder="e.g. Stryker Admin" value={forms.manufacturer.fullName}
                    onChange={e=>setF('manufacturer','fullName',e.target.value)}/>
                </div>
                <div className="form-group" style={{gridColumn:'span 3'}}>
                  <label>Password</label>
                  <PasswordField value={forms.manufacturer.password}
                    onChange={e=>setF('manufacturer','password',e.target.value)}
                    showPwd={showPwdFor==='manufacturer'} onToggle={()=>setShowPwdFor(v=>v==='manufacturer'?null:'manufacturer')}/>
                </div>
                <div className="form-group" style={{gridColumn:'span 2'}}>
                  <label>Company</label>
                  <input list="mfr-org-list" placeholder="Select or type..." value={forms.manufacturer.organization}
                    onChange={e=>setF('manufacturer','organization',e.target.value)}/>
                  <datalist id="mfr-org-list">
                    {orgs.filter(o=>o.type==='manufacturer').map(o=><option key={o.id} value={o.name}/>)}
                  </datalist>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{background:'var(--accent-green)'}}
                disabled={tabBusy.manufacturer||!forms.manufacturer.username||!forms.manufacturer.password}>
                {tabBusy.manufacturer?<><span className="spinner" style={{width:14,height:14}}/> Provisioning…</>:'+ Add Manufacturer User'}
              </button>
            </form>
          </div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Manufacturer Users <span className="badge badge-green">{usersOf('manufacturer').length}</span></span>
              <button className="btn btn-ghost btn-sm" onClick={loadUsers}>↻ Refresh</button>
            </div>
            <UserList
              users={usersOf('manufacturer')}
              extraColumns={[{key:'org',label:'Company',field:'organization'}]}
              actBusy={actBusy} onToggle={toggleActive} onSaved={loadUsers}/>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════
          DISTRIBUTORS
      ══════════════════════════════════════════════════ */}
      {tab==='distributor' && (
        <>
          <div className="card">
            <div className="card-header">
              <span className="card-title">🚚 Add Distributor / Rep User</span>
              <span className="badge badge-cyan">Fabric CA Auto-provisioned</span>
            </div>
            <Msg role="distributor"/>
            <form onSubmit={e=>handleCreateUser(e,'distributor',forms.distributor)}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:16,marginBottom:14}}>
                <div className="form-group" style={{gridColumn:'span 2'}}>
                  <label>Username</label>
                  <input placeholder="e.g. rep-memorial" value={forms.distributor.username}
                    onChange={e=>setF('distributor','username',e.target.value)} required
                    pattern="[a-zA-Z0-9_\-]+"/>
                </div>
                <div className="form-group" style={{gridColumn:'span 3'}}>
                  <label>Full Name</label>
                  <input placeholder="e.g. John Smith" value={forms.distributor.fullName}
                    onChange={e=>setF('distributor','fullName',e.target.value)}/>
                </div>
                <div className="form-group" style={{gridColumn:'span 3'}}>
                  <label>Password</label>
                  <PasswordField value={forms.distributor.password}
                    onChange={e=>setF('distributor','password',e.target.value)}
                    showPwd={showPwdFor==='distributor'} onToggle={()=>setShowPwdFor(v=>v==='distributor'?null:'distributor')}/>
                </div>
                <div className="form-group" style={{gridColumn:'span 2'}}>
                  <label>Company</label>
                  <input list="dist-org-list" placeholder="Select or type..." value={forms.distributor.organization}
                    onChange={e=>setF('distributor','organization',e.target.value)}/>
                  <datalist id="dist-org-list">
                    {orgs.filter(o=>o.type==='distributor').map(o=><option key={o.id} value={o.name}/>)}
                  </datalist>
                </div>
              </div>
              <div className="alert alert-info" style={{marginBottom:12,fontSize:12}}>
                ℹ After creating the user, assign their hospital territory using the <strong>🏥 Territory</strong> button in the list below.
              </div>
              <button type="submit" className="btn btn-primary" style={{background:'var(--accent-cyan)'}}
                disabled={tabBusy.distributor||!forms.distributor.username||!forms.distributor.password}>
                {tabBusy.distributor?<><span className="spinner" style={{width:14,height:14}}/> Provisioning…</>:'+ Add Distributor User'}
              </button>
            </form>
          </div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Distributor Users <span className="badge badge-cyan">{usersOf('distributor').length}</span></span>
              <button className="btn btn-ghost btn-sm" onClick={loadUsers}>↻ Refresh</button>
            </div>
            <UserList
              users={usersOf('distributor')}
              extraColumns={[{key:'org',label:'Company',field:'organization'}]}
              actBusy={actBusy} onToggle={toggleActive} onSaved={loadUsers}
              extraActions={u=>(
                <button className="btn btn-ghost btn-sm"
                  style={{color:'var(--accent-cyan)',borderColor:'var(--accent-cyan)'}}
                  onClick={()=>openRepHospModal(u.username)}>
                  🏥 Territory
                </button>
              )}/>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════
          NURSES
      ══════════════════════════════════════════════════ */}
      {tab==='nurse' && (
        <>
          <div className="card">
            <div className="card-header">
              <span className="card-title">🩺 Add OR Nurse</span>
              <span className="badge badge-amber">Hospital required · Fabric CA Auto-provisioned</span>
            </div>
            <Msg role="nurse"/>
            <form onSubmit={e=>handleCreateUser(e,'nurse',forms.nurse)}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:16,marginBottom:14}}>
                <div className="form-group" style={{gridColumn:'span 2'}}>
                  <label>Username</label>
                  <input placeholder="e.g. nurse-johnson" value={forms.nurse.username}
                    onChange={e=>setF('nurse','username',e.target.value)} required
                    pattern="[a-zA-Z0-9_\-]+"/>
                </div>
                <div className="form-group" style={{gridColumn:'span 3'}}>
                  <label>Full Name</label>
                  <input placeholder="e.g. Cathy Johnson, RN" value={forms.nurse.fullName}
                    onChange={e=>setF('nurse','fullName',e.target.value)}/>
                </div>
                <div className="form-group" style={{gridColumn:'span 3'}}>
                  <label>Password</label>
                  <PasswordField value={forms.nurse.password}
                    onChange={e=>setF('nurse','password',e.target.value)}
                    showPwd={showPwdFor==='nurse'} onToggle={()=>setShowPwdFor(v=>v==='nurse'?null:'nurse')}/>
                </div>
                <div className="form-group" style={{gridColumn:'span 2'}}>
                  <label>Hospital <span style={{fontSize:10,color:'var(--accent-red)'}}>required</span></label>
                  <select value={forms.nurse.hospitalId} onChange={e=>setF('nurse','hospitalId',e.target.value)} required>
                    <option value="">— Select hospital —</option>
                    {hospitals.map(h=><option key={h.id} value={h.name}>{h.name}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{background:'var(--accent-amber)'}}
                disabled={tabBusy.nurse||!forms.nurse.username||!forms.nurse.password||!forms.nurse.hospitalId}>
                {tabBusy.nurse?<><span className="spinner" style={{width:14,height:14}}/> Provisioning…</>:'+ Add Nurse'}
              </button>
            </form>
          </div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">OR Nurses <span className="badge badge-amber">{usersOf('nurse').length}</span></span>
              <button className="btn btn-ghost btn-sm" onClick={loadUsers}>↻ Refresh</button>
            </div>
            <UserList
              users={[...usersOf('nurse')].sort((a,b)=>(a.hospital_id||'').localeCompare(b.hospital_id||'')||a.username.localeCompare(b.username))}
              extraColumns={[{key:'hosp',label:'Hospital',field:'hospital_id'}]}
              actBusy={actBusy} onToggle={toggleActive} onSaved={loadUsers}/>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════
          SUPPLY CHAIN
      ══════════════════════════════════════════════════ */}
      {tab==='supply_chain' && (
        <>
          <div className="card">
            <div className="card-header">
              <span className="card-title">📦 Add Supply Chain User</span>
              <span className="badge badge-purple">Hospital required · Fabric CA Auto-provisioned</span>
            </div>
            <Msg role="supply_chain"/>
            <form onSubmit={e=>handleCreateUser(e,'supply_chain',forms.supply_chain)}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:16,marginBottom:14}}>
                <div className="form-group" style={{gridColumn:'span 2'}}>
                  <label>Username</label>
                  <input placeholder="e.g. sc-memorial" value={forms.supply_chain.username}
                    onChange={e=>setF('supply_chain','username',e.target.value)} required
                    pattern="[a-zA-Z0-9_\-]+"/>
                </div>
                <div className="form-group" style={{gridColumn:'span 3'}}>
                  <label>Full Name</label>
                  <input placeholder="e.g. Mike Torres" value={forms.supply_chain.fullName}
                    onChange={e=>setF('supply_chain','fullName',e.target.value)}/>
                </div>
                <div className="form-group" style={{gridColumn:'span 3'}}>
                  <label>Password</label>
                  <PasswordField value={forms.supply_chain.password}
                    onChange={e=>setF('supply_chain','password',e.target.value)}
                    showPwd={showPwdFor==='supply_chain'} onToggle={()=>setShowPwdFor(v=>v==='supply_chain'?null:'supply_chain')}/>
                </div>
                <div className="form-group" style={{gridColumn:'span 2'}}>
                  <label>Hospital <span style={{fontSize:10,color:'var(--accent-red)'}}>required</span></label>
                  <select value={forms.supply_chain.hospitalId} onChange={e=>setF('supply_chain','hospitalId',e.target.value)} required>
                    <option value="">— Select hospital —</option>
                    {hospitals.map(h=><option key={h.id} value={h.name}>{h.name}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{background:'var(--accent-purple)'}}
                disabled={tabBusy.supply_chain||!forms.supply_chain.username||!forms.supply_chain.password||!forms.supply_chain.hospitalId}>
                {tabBusy.supply_chain?<><span className="spinner" style={{width:14,height:14}}/> Provisioning…</>:'+ Add Supply Chain User'}
              </button>
            </form>
          </div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Supply Chain Users <span className="badge badge-purple">{usersOf('supply_chain').length}</span></span>
              <button className="btn btn-ghost btn-sm" onClick={loadUsers}>↻ Refresh</button>
            </div>
            <UserList
              users={[...usersOf('supply_chain')].sort((a,b)=>(a.hospital_id||'').localeCompare(b.hospital_id||'')||a.username.localeCompare(b.username))}
              extraColumns={[{key:'hosp',label:'Hospital',field:'hospital_id'}]}
              actBusy={actBusy} onToggle={toggleActive} onSaved={loadUsers}/>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════
          INFECTION PREVENTION
      ══════════════════════════════════════════════════ */}
      {tab==='infection_prevention' && (
        <>
          <div className="card">
            <div className="card-header">
              <span className="card-title">🔬 Add Infection Prevention Officer</span>
              <span className="badge badge-red">Hospital employee · Fabric CA Auto-provisioned</span>
            </div>
            <p style={{fontSize:12,color:'var(--text-secondary)',marginBottom:16}}>
              Infection Prevention officers are hospital employees reporting to the Chief Medical Officer.
              They monitor HAIs, device-related infections, and adverse event trends for their hospital.
            </p>
            <Msg role="infection_prevention"/>
            <form onSubmit={e=>handleCreateUser(e,'infection_prevention',forms.infection_prevention)}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:16,marginBottom:14}}>
                <div className="form-group" style={{gridColumn:'span 2'}}>
                  <label>Username</label>
                  <input placeholder="e.g. ip-memorial" value={forms.infection_prevention.username}
                    onChange={e=>setF('infection_prevention','username',e.target.value)} required
                    pattern="[a-zA-Z0-9_\-]+"/>
                </div>
                <div className="form-group" style={{gridColumn:'span 3'}}>
                  <label>Full Name</label>
                  <input placeholder="e.g. Sarah Chen, RN, CIC" value={forms.infection_prevention.fullName}
                    onChange={e=>setF('infection_prevention','fullName',e.target.value)}/>
                </div>
                <div className="form-group" style={{gridColumn:'span 3'}}>
                  <label>Password</label>
                  <PasswordField value={forms.infection_prevention.password}
                    onChange={e=>setF('infection_prevention','password',e.target.value)}
                    showPwd={showPwdFor==='infection_prevention'} onToggle={()=>setShowPwdFor(v=>v==='infection_prevention'?null:'infection_prevention')}/>
                </div>
                <div className="form-group" style={{gridColumn:'span 2'}}>
                  <label>Hospital <span style={{fontSize:10,color:'var(--accent-red)'}}>required</span></label>
                  <select value={forms.infection_prevention.hospitalId} onChange={e=>setF('infection_prevention','hospitalId',e.target.value)} required>
                    <option value="">— Select hospital —</option>
                    {hospitals.map(h=><option key={h.id} value={h.name}>{h.name}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{background:'var(--accent-red)'}}
                disabled={tabBusy.infection_prevention||!forms.infection_prevention.username||!forms.infection_prevention.password||!forms.infection_prevention.hospitalId}>
                {tabBusy.infection_prevention?<><span className="spinner" style={{width:14,height:14}}/> Provisioning…</>:'+ Add Infection Prevention Officer'}
              </button>
            </form>
          </div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Infection Prevention Officers <span className="badge badge-red">{usersOf('infection_prevention').length}</span></span>
              <button className="btn btn-ghost btn-sm" onClick={loadUsers}>↻ Refresh</button>
            </div>
            <UserList
              users={[...usersOf('infection_prevention')].sort((a,b)=>(a.hospital_id||'').localeCompare(b.hospital_id||'')||a.username.localeCompare(b.username))}
              extraColumns={[{key:'hosp',label:'Hospital',field:'hospital_id'}]}
              actBusy={actBusy} onToggle={toggleActive} onSaved={loadUsers}/>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════
          SURGEONS
      ══════════════════════════════════════════════════ */}
      {tab==='surgeons' && (
        <>
          <div className="card">
            <div className="card-header"><span className="card-title">🔪 Register Surgeon</span><span className="badge badge-blue">OR Dropdown · Multi-hospital · Login via 🔑 Create Login</span></div>
            {sMsg && <div className={`alert alert-${sMsg.type}`} style={{marginBottom:12}}>{sMsg.type==='error'?'⚠':'✓'} {sMsg.text}</div>}
            <form onSubmit={async e=>{
              e.preventDefault(); setSBusy(true); setSMsg(null);
              try {
                await api.createSurgeon({...sForm});
                setSMsg({type:'success',text:`Surgeon "${sForm.fullName}" registered.`});
                setTimeout(()=>setSMsg(null),3000);
                setSForm({surgeonId:'',fullName:'',licenseNumber:'',specialty:'',hospitals:[],npi:''});
                loadSurgeons();
              } catch(err) { setSMsg({type:'error',text:err.message}); }
              finally { setSBusy(false); }
            }}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:16,marginBottom:14}}>
                <div className="form-group" style={{gridColumn:'span 2'}}>
                  <label>Surgeon ID</label>
                  <input placeholder="e.g. DR-JOHNSON-ORTH" value={sForm.surgeonId}
                    onChange={e=>ss('surgeonId',e.target.value)} required
                    style={{fontFamily:'var(--font-mono)'}}/>
                </div>
                <div className="form-group" style={{gridColumn:'span 3'}}>
                  <label>Full Name</label>
                  <input placeholder="e.g. Dr. Robert Johnson" value={sForm.fullName}
                    onChange={e=>ss('fullName',e.target.value)} required/>
                </div>
                <div className="form-group" style={{gridColumn:'span 2'}}>
                  <label>License Number</label>
                  <input placeholder="e.g. MD-IL-123456" value={sForm.licenseNumber}
                    onChange={e=>ss('licenseNumber',e.target.value)}/>
                </div>
                <div className="form-group" style={{gridColumn:'span 2'}}>
                  <label>NPI</label>
                  <input placeholder="e.g. 1234567890" value={sForm.npi}
                    onChange={e=>ss('npi',e.target.value)} maxLength={10}
                    style={{fontFamily:'var(--font-mono)'}}/>
                </div>
                <div className="form-group" style={{gridColumn:'span 3'}}>
                  <label>Specialty <span style={{fontSize:10,color:'var(--accent-red)'}}>required</span></label>
                  <select value={sForm.specialty} onChange={e=>ss('specialty',e.target.value)} required>
                    <option value="">— Select specialty —</option>
                    {SPECIALTIES.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{gridColumn:'span 10'}}>
                  <label>Hospital Affiliations <span style={{fontSize:10,color:'var(--text-muted)'}}>select all hospitals where this surgeon operates</span></label>
                  <HospitalMultiSelect hospitals={hospitals} selected={sForm.hospitals} onChange={v=>ss('hospitals',v)}/>
                </div>
              </div>
              <button type="submit" className="btn btn-primary"
                disabled={sBusy||!sForm.surgeonId||!sForm.fullName||!sForm.specialty}>
                {sBusy?<><span className="spinner" style={{width:14,height:14}}/> Saving…</>:'+ Register Surgeon'}
              </button>
            </form>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Surgeons <span className="badge badge-blue">{surgeons.length}</span></span>
              {sLoading && <span className="spinner" style={{width:14,height:14}}/>}
              <button className="btn btn-ghost btn-sm" onClick={loadSurgeons}>↻ Refresh</button>
            </div>
            {surgeons.length===0
              ? <div className="empty-state"><div className="icon">🔪</div><p>No surgeons registered yet</p></div>
              : <div className="table-wrap"><table>
                  <thead><tr>
                    <th>Surgeon ID</th><th>Full Name</th><th>License</th><th>NPI</th>
                    <th>Specialty</th><th>Hospitals</th><th>Portal</th><th>Added</th><th>Actions</th>
                  </tr></thead>
                  <tbody>{(()=>{
                    const rows = [];
                    let lastHosp=null, lastSpec=null;
                    expandedSurgeonRows.forEach((s,i)=>{
                      const newHosp = s.displayHospital!==lastHosp;
                      const newSpec = newHosp||s.specialty!==lastSpec;
                      lastHosp=s.displayHospital; lastSpec=s.specialty;
                      if(newHosp) rows.push(
                        <tr key={`h-${i}`}><td colSpan={9} style={{padding:'10px 14px',
                          background:'var(--bg-secondary)',borderTop:'2px solid var(--border)',
                          fontSize:13,fontWeight:700,color:'var(--text-primary)'}}>
                          🏥 {s.displayHospital}
                        </td></tr>
                      );
                      if(newSpec&&s.specialty) rows.push(
                        <tr key={`sp-${i}`}><td colSpan={9} style={{padding:'6px 14px 6px 28px',
                          background:'rgba(139,92,246,0.08)',borderTop:'1px solid rgba(139,92,246,0.15)',
                          fontSize:11,fontWeight:700,color:'var(--accent-purple)',
                          textTransform:'uppercase',letterSpacing:'0.08em',fontFamily:'var(--font-mono)'}}>
                          🔬 {s.specialty}
                        </td></tr>
                      );
                      if(editSurg?.id===s.id){
                        rows.push(
                          <tr key={`edit-${s.id}-${s.displayHospital}`} style={{background:'rgba(59,130,246,0.06)'}}>
                            <td style={{fontFamily:'var(--font-mono)',fontSize:11,paddingLeft:32}}>{s.surgeon_id}</td>
                            <td><input value={editSurg.full_name} onChange={e=>setEditSurg(x=>({...x,full_name:e.target.value}))} style={{width:'100%'}}/></td>
                            <td><input value={editSurg.license_number||''} onChange={e=>setEditSurg(x=>({...x,license_number:e.target.value}))} style={{width:'100%'}}/></td>
                            <td><input value={editSurg.npi||''} onChange={e=>setEditSurg(x=>({...x,npi:e.target.value}))} style={{width:100,fontFamily:'var(--font-mono)'}}/></td>
                            <td><select value={editSurg.specialty||''} onChange={e=>setEditSurg(x=>({...x,specialty:e.target.value}))}>
                              <option value="">—</option>
                              {SPECIALTIES.map(sp=><option key={sp} value={sp}>{sp}</option>)}
                            </select></td>
                            <td colSpan={2}>
                              <HospitalMultiSelect hospitals={hospitals} selected={editSurg.hospitals||[]}
                                onChange={v=>setEditSurg(x=>({...x,hospitals:v}))}/>
                            </td>
                            <td/>
                            <td style={{display:'flex',gap:6}}>
                              <button className="btn btn-success btn-sm"
                                onClick={async()=>{
                                  await api.updateSurgeon(editSurg.id,{
                                    fullName:editSurg.full_name,licenseNumber:editSurg.license_number,
                                    specialty:editSurg.specialty,hospitals:editSurg.hospitals||[],npi:editSurg.npi,
                                  });
                                  setEditSurg(null); loadSurgeons();
                                }}>Save</button>
                              <button className="btn btn-ghost btn-sm" onClick={()=>setEditSurg(null)}>Cancel</button>
                            </td>
                          </tr>
                        );
                      } else {
                        rows.push(
                          <tr key={`${s.id}-${s.displayHospital}`} style={{opacity:s.active===false?0.45:1}}>
                            <td style={{fontFamily:'var(--font-mono)',fontSize:11,paddingLeft:32}}>{s.surgeon_id}</td>
                            <td style={{fontWeight:600}}>{s.full_name}</td>
                            <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{s.license_number||'—'}</td>
                            <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{s.npi||'—'}</td>
                            <td><span className="badge badge-purple">{s.specialty||'—'}</span></td>
                            <td style={{fontSize:11}}>
                              {(s.hospitals||[]).map(h=>(
                                <span key={h} className="badge badge-blue" style={{marginRight:4,fontSize:10}}>{h}</span>
                              ))}
                            </td>
                            <td>
                              {surgeonUsernames.has(s.surgeon_id)
                                ? <span className="badge badge-green" style={{fontSize:10}}>🔑 Active</span>
                                : <span style={{fontSize:11,color:'var(--text-muted)'}}>—</span>}
                            </td>
                            <td style={{fontSize:11}}>{new Date(s.created_at).toLocaleDateString()}</td>
                            <td style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                              {s.active!==false && (
                                <button className="btn btn-ghost btn-sm"
                                  onClick={()=>setEditSurg({...s,hospitals:s.hospitals||[]})}>✏ Edit</button>
                              )}
                              <button
                                className={`btn btn-sm ${s.active!==false?'btn-danger':'btn-success'}`}
                                disabled={!!surgActBusy[s.id]}
                                onClick={async()=>{
                                  setSurgActBusy(b=>({...b,[s.id]:true}));
                                  try {
                                    s.active!==false ? await api.deactivateSurgeon(s.id) : await api.activateSurgeon(s.id);
                                    loadSurgeons();
                                  } finally { setSurgActBusy(b=>({...b,[s.id]:false})); }
                                }}>
                                {surgActBusy[s.id]
                                  ? <span className="spinner" style={{width:12,height:12}}/>
                                  : s.active!==false?'Deactivate':'Activate'}
                              </button>
                              {s.active!==false && !surgeonUsernames.has(s.surgeon_id) && (
                                <button className="btn btn-ghost btn-sm"
                                  style={{color:'var(--accent-blue)',borderColor:'var(--accent-blue)',whiteSpace:'nowrap'}}
                                  onClick={()=>{ setCreateLoginSurg(s); setCreateLoginForm({password:'',fullName:s.full_name||''}); setCreateLoginMsg(null); }}>
                                  🔑 Create Login
                                </button>
                              )}
                              {surgeonUsernames.has(s.surgeon_id) && (
                                <button className="btn btn-ghost btn-sm"
                                  style={{color:'var(--accent-red)',borderColor:'var(--accent-red)',whiteSpace:'nowrap'}}
                                  disabled={!!loginRevokeBusy[s.surgeon_id]}
                                  onClick={async()=>{
                                    if(!window.confirm(`Revoke portal login for ${s.surgeon_id}?`)) return;
                                    setLoginRevokeBusy(b=>({...b,[s.surgeon_id]:true}));
                                    try { await api.deactivateUser(s.surgeon_id); loadUsers(); loadSurgeons(); }
                                    finally { setLoginRevokeBusy(b=>({...b,[s.surgeon_id]:false})); }
                                  }}>
                                  {loginRevokeBusy[s.surgeon_id]
                                    ? <span className="spinner" style={{width:12,height:12}}/>
                                    : '🔑 Revoke Login'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      }
                    });
                    return rows;
                  })()}</tbody>
                </table></div>
            }
          </div>

          {/* Create Surgeon Login Modal */}
          {createLoginSurg && (
            <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1000,
              display:'flex',alignItems:'center',justifyContent:'center',padding:24}}
              onClick={()=>setCreateLoginSurg(null)}>
              <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',
                borderRadius:'var(--radius-lg)',padding:28,width:'min(480px,100%)'}}
                onClick={e=>e.stopPropagation()}>
                <h3 style={{marginBottom:4}}>🔑 Create Surgeon Portal Login</h3>
                <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:16}}>
                  {createLoginSurg.full_name} · {createLoginSurg.surgeon_id} · {createLoginSurg.specialty}
                </div>
                <div className="alert alert-info" style={{marginBottom:16,fontSize:12}}>
                  ℹ Username will be <strong>{createLoginSurg.surgeon_id}</strong> — must match
                  the surgeon ID on implant records so they see their own patients.
                </div>
                {createLoginMsg && (
                  <div className={`alert alert-${createLoginMsg.type}`} style={{marginBottom:12}}>
                    {createLoginMsg.text}
                  </div>
                )}
                <div style={{display:'grid',gap:12,marginBottom:16}}>
                  <div className="form-group" style={{marginBottom:0}}>
                    <label>Full Name</label>
                    <input value={createLoginForm.fullName}
                      onChange={e=>setCreateLoginForm(f=>({...f,fullName:e.target.value}))}
                      placeholder="e.g. Dr. Robert Johnson, MD"/>
                  </div>
                  <div className="form-group" style={{marginBottom:0}}>
                    <label>Password</label>
                    <PasswordField value={createLoginForm.password}
                      onChange={e=>setCreateLoginForm(f=>({...f,password:e.target.value}))}
                      showPwd={showSurgPwd} onToggle={()=>setShowSurgPwd(v=>!v)}/>
                  </div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button className="btn btn-primary" style={{flex:1}}
                    disabled={createLoginBusy||!createLoginForm.password||createLoginForm.password.length<8}
                    onClick={async()=>{
                      setCreateLoginBusy(true); setCreateLoginMsg(null);
                      try {
                        await api.createUser({
                          username:  createLoginSurg.surgeon_id,
                          password:  createLoginForm.password,
                          role:      'surgeon',
                          fullName:  createLoginForm.fullName||createLoginSurg.full_name,
                          organization: (createLoginSurg.hospitals||[])[0]||'',
                          hospitalId: '',
                          hospitals: createLoginSurg.hospitals||[],
                          specialty: createLoginSurg.specialty||'',
                        });
                        setCreateLoginMsg({type:'success',text:`Portal login created for ${createLoginSurg.surgeon_id}.`});
                        loadUsers();
                        setTimeout(()=>setCreateLoginSurg(null),2000);
                      } catch(err) { setCreateLoginMsg({type:'error',text:err.message}); }
                      finally { setCreateLoginBusy(false); }
                    }}>
                    {createLoginBusy?<><span className="spinner" style={{width:14,height:14}}/> Creating…</>:'🔑 Create Portal Login'}
                  </button>
                  <button className="btn btn-ghost" onClick={()=>setCreateLoginSurg(null)}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════
          ORGANIZATIONS
      ══════════════════════════════════════════════════ */}
      {tab==='organizations' && (
        <>
          <div className="card">
            <div className="card-header"><span className="card-title">🏢 Add Organization</span><span className="badge badge-blue">Manufacturers &amp; Distributors · Database only</span></div>
            {oMsg && <div className={`alert alert-${oMsg.type}`}>{oMsg.type==='error'?'⚠':'✓'} {oMsg.text}</div>}
            <form onSubmit={async e=>{
              e.preventDefault(); setOBusy(true); setOMsg(null);
              try { await api.createOrganization(oForm); setOMsg({type:'success',text:`"${oForm.name}" saved.`}); setTimeout(()=>setOMsg(null),3000); setOForm({name:'',type:'',address:'',contact:'',website:''}); loadOrgs(); }
              catch(err) { setOMsg({type:'error',text:err.message}); }
              finally { setOBusy(false); }
            }}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:16,marginBottom:14}}>
                <div className="form-group" style={{gridColumn:'span 4'}}><label>Organization Name</label>
                  <input placeholder="e.g. Stryker Corporation" value={oForm.name} onChange={e=>so('name',e.target.value)} required/></div>
                <div className="form-group" style={{gridColumn:'span 2'}}><label>Type</label>
                  <select value={oForm.type} onChange={e=>so('type',e.target.value)} required>
                    <option value="">— Select —</option>
                    {ORG_TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                  </select></div>
                <div className="form-group" style={{gridColumn:'span 4'}}><label>Contact Email</label>
                  <input placeholder="e.g. contact@stryker.com" value={oForm.contact} onChange={e=>so('contact',e.target.value)}/></div>
                <div className="form-group" style={{gridColumn:'span 5'}}><label>Address</label>
                  <input placeholder="e.g. 2825 Airview Blvd, Kalamazoo, MI 49002" value={oForm.address} onChange={e=>so('address',e.target.value)}/></div>
                <div className="form-group" style={{gridColumn:'span 5'}}><label>Website</label>
                  <input placeholder="e.g. https://www.stryker.com" value={oForm.website} onChange={e=>so('website',e.target.value)}/></div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={oBusy||!oForm.name||!oForm.type}>
                {oBusy?<><span className="spinner" style={{width:14,height:14}}/> Saving…</>:'+ Add Organization'}
              </button>
            </form>
          </div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Organizations <span className="badge badge-blue">{orgs.length}</span></span>
              <button className="btn btn-ghost btn-sm" onClick={loadOrgs}>↻ Refresh</button>
            </div>
            {orgs.length===0
              ? <div className="empty-state"><div className="icon">🏢</div><p>No organizations yet</p></div>
              : <div className="table-wrap"><table>
                  <thead><tr><th>Name</th><th>Type</th><th>Address</th><th>Contact</th><th>Website</th><th>Added</th><th>Actions</th></tr></thead>
                  <tbody>{orgs.map(o=>editOrg?.id===o.id?(
                    <tr key={o.id} style={{background:'rgba(59,130,246,0.06)'}}>
                      <td colSpan={7} style={{padding:'12px 8px'}}>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:8}}>
                          <div><label style={{fontSize:10,fontWeight:600,display:'block',marginBottom:2}}>Name *</label>
                            <input value={editOrg.name} onChange={e=>setEditOrg(x=>({...x,name:e.target.value}))} style={{width:'100%'}}/></div>
                          <div><label style={{fontSize:10,fontWeight:600,display:'block',marginBottom:2}}>Type *</label>
                            <select value={editOrg.type} onChange={e=>setEditOrg(x=>({...x,type:e.target.value}))} style={{width:'100%'}}>
                              {ORG_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
                          <div><label style={{fontSize:10,fontWeight:600,display:'block',marginBottom:2}}>Contact</label>
                            <input value={editOrg.contact||''} onChange={e=>setEditOrg(x=>({...x,contact:e.target.value}))} style={{width:'100%'}}/></div>
                          <div style={{gridColumn:'span 3'}}><label style={{fontSize:10,fontWeight:600,display:'block',marginBottom:2}}>Address</label>
                            <input value={editOrg.address||''} onChange={e=>setEditOrg(x=>({...x,address:e.target.value}))} style={{width:'100%'}}/></div>
                          <div style={{gridColumn:'span 2'}}><label style={{fontSize:10,fontWeight:600,display:'block',marginBottom:2}}>Website</label>
                            <input value={editOrg.website||''} onChange={e=>setEditOrg(x=>({...x,website:e.target.value}))} style={{width:'100%'}}/></div>
                        </div>
                        {orgMsg && <div className={`alert alert-${orgMsg.type}`} style={{marginBottom:8,fontSize:12}}>{orgMsg.text}</div>}
                        <div style={{display:'flex',gap:8}}>
                          <button className="btn btn-primary btn-sm" disabled={orgBusySave||!editOrg.name}
                            onClick={async()=>{
                              setOrgBusySave(true); setOrgMsg(null);
                              try { await api.updateOrganization(editOrg.id,editOrg); setEditOrg(null); loadOrgs(); }
                              catch(err) { setOrgMsg({type:'error',text:err.message}); }
                              finally { setOrgBusySave(false); }
                            }}>
                            {orgBusySave?<><span className="spinner" style={{width:12,height:12}}/> Saving…</>:'✓ Save'}
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={()=>{setEditOrg(null);setOrgMsg(null);}}>Cancel</button>
                        </div>
                      </td>
                    </tr>
                  ):(
                    <tr key={o.id}>
                      <td style={{fontWeight:600}}>{o.name}</td>
                      <td><span className="badge badge-blue">{o.type}</span></td>
                      <td style={{fontSize:12}}>{o.address||'—'}</td>
                      <td style={{fontSize:12}}>{o.contact||'—'}</td>
                      <td style={{fontSize:12}}>{o.website?<a href={o.website} target="_blank" rel="noreferrer" style={{color:'var(--accent-blue)'}}>{o.website}</a>:'—'}</td>
                      <td style={{fontSize:11}}>{new Date(o.created_at).toLocaleDateString()}</td>
                      <td style={{display:'flex',gap:6}}>
                        <button className="btn btn-ghost btn-sm" onClick={()=>setEditOrg({...o})}>✏ Edit</button>
                        <button className="btn btn-danger btn-sm"
                          onClick={async()=>{ if(window.confirm('Delete '+o.name+'?')){ await api.deleteOrganization(o.id); loadOrgs(); } }}>✕</button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table></div>
            }
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════
          HOSPITALS
      ══════════════════════════════════════════════════ */}
      {tab==='hospitals' && (
        <>
          <div className="card">
            <div className="card-header"><span className="card-title">🏥 Add Hospital</span><span className="badge badge-blue">Referenced by all hospital roles · Database only</span></div>
            {hMsg && <div className={`alert alert-${hMsg.type}`}>{hMsg.type==='error'?'⚠':'✓'} {hMsg.text}</div>}
            <form onSubmit={async e=>{
              e.preventDefault(); setHBusy(true); setHMsg(null);
              try { await api.createHospital(hForm); setHMsg({type:'success',text:`"${hForm.name}" saved.`}); setTimeout(()=>setHMsg(null),3000); setHForm({name:'',address:'',contact:'',accreditation:'',bedCount:''}); loadHospitals(); }
              catch(err) { setHMsg({type:'error',text:err.message}); }
              finally { setHBusy(false); }
            }}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:16,marginBottom:14}}>
                <div className="form-group" style={{gridColumn:'span 4'}}><label>Hospital Name</label>
                  <input placeholder="e.g. Memorial Hospital" value={hForm.name} onChange={e=>sh('name',e.target.value)} required/></div>
                <div className="form-group" style={{gridColumn:'span 3'}}><label>Accreditation</label>
                  <input placeholder="e.g. JC-2024-001234" value={hForm.accreditation} onChange={e=>sh('accreditation',e.target.value)}/></div>
                <div className="form-group" style={{gridColumn:'span 2'}}><label>Bed Count</label>
                  <input type="number" min="1" value={hForm.bedCount} onChange={e=>sh('bedCount',e.target.value)}/></div>
                <div className="form-group" style={{gridColumn:'span 3'}}><label>Contact</label>
                  <input placeholder="e.g. admin@memorial.org" value={hForm.contact} onChange={e=>sh('contact',e.target.value)}/></div>
                <div className="form-group" style={{gridColumn:'span 10'}}><label>Address</label>
                  <input placeholder="e.g. 1234 Medical Center Drive, Chicago, IL 60601" value={hForm.address} onChange={e=>sh('address',e.target.value)}/></div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={hBusy||!hForm.name}>
                {hBusy?<><span className="spinner" style={{width:14,height:14}}/> Saving…</>:'+ Add Hospital'}
              </button>
            </form>
          </div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Hospitals <span className="badge badge-blue">{hospitals.length}</span></span>
              <button className="btn btn-ghost btn-sm" onClick={loadHospitals}>↻ Refresh</button>
            </div>
            {hospitals.length===0
              ? <div className="empty-state"><div className="icon">🏥</div><p>No hospitals yet</p></div>
              : <div className="table-wrap"><table>
                  <thead><tr><th>Name</th><th>Accreditation</th><th>Beds</th><th>Address</th><th>Contact</th><th>Added</th><th>Actions</th></tr></thead>
                  <tbody>{hospitals.map(h=>editHosp?.id===h.id?(
                    <tr key={h.id} style={{background:'rgba(59,130,246,0.06)'}}>
                      <td colSpan={7} style={{padding:'12px 8px'}}>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:8}}>
                          <div><label style={{fontSize:10,fontWeight:600,display:'block',marginBottom:2}}>Name *</label>
                            <input value={editHosp.name} onChange={e=>setEditHosp(x=>({...x,name:e.target.value}))} style={{width:'100%'}}/></div>
                          <div><label style={{fontSize:10,fontWeight:600,display:'block',marginBottom:2}}>Accreditation</label>
                            <input value={editHosp.accreditation||''} onChange={e=>setEditHosp(x=>({...x,accreditation:e.target.value}))} style={{width:'100%'}}/></div>
                          <div><label style={{fontSize:10,fontWeight:600,display:'block',marginBottom:2}}>Bed Count</label>
                            <input type="number" value={editHosp.bed_count||''} onChange={e=>setEditHosp(x=>({...x,bed_count:e.target.value}))} style={{width:'100%'}}/></div>
                          <div style={{gridColumn:'span 3'}}><label style={{fontSize:10,fontWeight:600,display:'block',marginBottom:2}}>Address</label>
                            <input value={editHosp.address||''} onChange={e=>setEditHosp(x=>({...x,address:e.target.value}))} style={{width:'100%'}}/></div>
                          <div style={{gridColumn:'span 2'}}><label style={{fontSize:10,fontWeight:600,display:'block',marginBottom:2}}>Contact</label>
                            <input value={editHosp.contact||''} onChange={e=>setEditHosp(x=>({...x,contact:e.target.value}))} style={{width:'100%'}}/></div>
                        </div>
                        {hospMsg && <div className={`alert alert-${hospMsg.type}`} style={{marginBottom:8,fontSize:12}}>{hospMsg.text}</div>}
                        <div style={{display:'flex',gap:8}}>
                          <button className="btn btn-primary btn-sm" disabled={hospBusySave||!editHosp.name}
                            onClick={async()=>{
                              setHospBusySave(true); setHospMsg(null);
                              try { await api.updateHospital(editHosp.id,{...editHosp,bedCount:editHosp.bed_count}); setEditHosp(null); loadHospitals(); }
                              catch(err) { setHospMsg({type:'error',text:err.message}); }
                              finally { setHospBusySave(false); }
                            }}>
                            {hospBusySave?<><span className="spinner" style={{width:12,height:12}}/> Saving…</>:'✓ Save'}
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={()=>{setEditHosp(null);setHospMsg(null);}}>Cancel</button>
                        </div>
                      </td>
                    </tr>
                  ):(
                    <tr key={h.id}>
                      <td style={{fontWeight:600}}>{h.name}</td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{h.accreditation||'—'}</td>
                      <td style={{fontSize:12}}>{h.bed_count||'—'}</td>
                      <td style={{fontSize:12}}>{h.address||'—'}</td>
                      <td style={{fontSize:12}}>{h.contact||'—'}</td>
                      <td style={{fontSize:11}}>{new Date(h.created_at).toLocaleDateString()}</td>
                      <td style={{display:'flex',gap:6}}>
                        <button className="btn btn-ghost btn-sm" onClick={()=>setEditHosp({...h})}>✏ Edit</button>
                        <button className="btn btn-danger btn-sm"
                          onClick={async()=>{ if(window.confirm('Delete '+h.name+'?')){ await api.deleteHospital(h.id); loadHospitals(); } }}>✕</button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table></div>
            }
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════
          LOOKUP VALUES
      ══════════════════════════════════════════════════ */}
      {tab==='lookup' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">📋 Lookup Values</span>
            <span className="badge badge-blue">Configures dropdown options across the app</span>
          </div>
          <div style={{display:'flex',gap:12,marginBottom:16,alignItems:'flex-end'}}>
            <div className="form-group" style={{marginBottom:0,minWidth:280}}>
              <label>Category</label>
              <select value={lookupCat} onChange={e=>setLookupCat(e.target.value)}>
                {LOOKUP_CATEGORIES.map(c=><option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>
          {lMsg && <div className={`alert alert-${lMsg.type}`} style={{marginBottom:12}}>{lMsg.type==='error'?'⚠':'✓'} {lMsg.text}</div>}
          <form onSubmit={async e=>{
            e.preventDefault(); if(!newValue.trim()) return;
            setLBusy(true); setLMsg(null);
            try { await api.createLookupValue({category:lookupCat,value:newValue.trim()}); setNewValue(''); loadLookup(lookupCat); setLMsg({type:'success',text:`"${newValue}" added.`}); setTimeout(()=>setLMsg(null),3000); }
            catch(err) { setLMsg({type:'error',text:err.message}); }
            finally { setLBusy(false); }
          }} style={{display:'flex',gap:8,marginBottom:16}}>
            <input style={{flex:1}} placeholder="Add new value..." value={newValue} onChange={e=>setNewValue(e.target.value)}/>
            <button type="submit" className="btn btn-primary" disabled={lBusy||!newValue.trim()}>
              {lBusy?<span className="spinner" style={{width:14,height:14}}/>:'+ Add'}
            </button>
          </form>
          {lLoading
            ? <div className="loading-overlay"><span className="spinner"/></div>
            : lookupItems.length===0
              ? <div className="empty-state"><div className="icon">📋</div><p>No values in this category</p></div>
              : <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                  {lookupItems.map(item=>(
                    <div key={item.id} style={{display:'flex',alignItems:'center',gap:6,
                      padding:'6px 12px',background:'var(--bg-secondary)',
                      borderRadius:'var(--radius-sm)',border:'1px solid var(--border)'}}>
                      <span style={{fontSize:13}}>{item.value}</span>
                      <button style={{background:'none',border:'none',cursor:'pointer',
                        color:'var(--text-muted)',fontSize:14,padding:'0 2px'}}
                        onClick={async()=>{ await api.deleteLookupValue(item.id); loadLookup(lookupCat); }}>✕</button>
                    </div>
                  ))}
                </div>
          }
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          BROWNFIELD ONBOARDING
      ══════════════════════════════════════════════════ */}
      {tab==='brownfield' && (
        <>
          <div className="card">
            <div className="card-header">
              <span className="card-title">🏥 Submit Brownfield Onboarding Request</span>
              <span className="badge badge-cyan">Fast-track · Existing FDA-cleared device</span>
            </div>
            {bfMsg && <div className={`alert alert-${bfMsg.type}`} style={{marginBottom:12}}>{bfMsg.type==='error'?'⚠':'✓'} {bfMsg.text}</div>}
            <form onSubmit={async e=>{
              e.preventDefault(); setBfBusy(true); setBfMsg(null);
              try { await api.createOnboardingRequest(bfForm); setBfMsg({type:'success',text:`"${bfForm.deviceName}" submitted.`}); setTimeout(()=>setBfMsg(null),3000);
                setBfForm({udiDI:'',deviceName:'',manufacturerId:'',deviceCategory:'',deviceType:'',singleUse:false,sterile:true,containsLatex:false,mriSafe:'conditional',bodyLocations:[],clearanceNumber:'',clearanceType:'',clearanceDate:'',gudidVerified:false});
                loadOnboardingReqs();
              } catch(err) { setBfMsg({type:'error',text:err.message}); }
              finally { setBfBusy(false); }
            }}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:16,marginBottom:14}}>
                <div className="form-group" style={{gridColumn:'span 3'}}>
                  <label>UDI-DI</label>
                  <input placeholder="e.g. (01)00643169007234" value={bfForm.udiDI} onChange={e=>sbf('udiDI',e.target.value)} required style={{fontFamily:'var(--font-mono)'}}/>
                </div>
                <div className="form-group" style={{gridColumn:'span 4'}}>
                  <label>Device Name</label>
                  <input placeholder="e.g. Stryker Triathlon Total Knee System" value={bfForm.deviceName} onChange={e=>sbf('deviceName',e.target.value)} required/>
                </div>
                <div className="form-group" style={{gridColumn:'span 3'}}>
                  <label>Manufacturer</label>
                  <select value={bfForm.manufacturerId} onChange={e=>sbf('manufacturerId',e.target.value)} required>
                    <option value="">— Select —</option>
                    {mfrs.map(m=><option key={m.username} value={m.username}>{m.username}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{gridColumn:'span 2'}}>
                  <label>MRI Safety</label>
                  <select value={bfForm.mriSafe} onChange={e=>sbf('mriSafe',e.target.value)}>
                    {['conditional','safe','unsafe'].map(o=><option key={o} value={o}>{o.charAt(0).toUpperCase()+o.slice(1)}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{gridColumn:'span 3'}}>
                  <label>Device Category</label>
                  <select value={bfForm.deviceCategory}
                    onChange={e=>{ sbf('deviceCategory',e.target.value); sbf('deviceType',''); sbf('bodyLocations',[]); }} required>
                    <option value="">— Select —</option>
                    {['cardiac','general_surgery','neurosurgery','orthopedic'].map(c=>(
                      <option key={c} value={c}>{c.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{gridColumn:'span 3'}}>
                  <label>Device Type</label>
                  <select value={bfForm.deviceType}
                    onChange={e=>{ sbf('deviceType',e.target.value); sbf('bodyLocations',[]); }} required>
                    <option value="">— Select —</option>
                    {(BF_DEVICE_TYPES[bfForm.deviceCategory]||[]).map(t=>(
                      <option key={t} value={t}>{t.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{gridColumn:'span 2'}}>
                  <label>Attributes</label>
                  <div style={{display:'flex',gap:8,paddingTop:8,flexDirection:'column'}}>
                    {[['singleUse','Single Use'],['sterile','Sterile'],['containsLatex','Latex']].map(([k,l])=>(
                      <label key={k} className="checkbox-group" style={{margin:0}}>
                        <input type="checkbox" checked={bfForm[k]} onChange={e=>sbf(k,e.target.checked)}/>
                        <span style={{fontSize:12}}>{l}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="form-group" style={{gridColumn:'span 3'}}>
                  <label>Clearance Number</label>
                  <input placeholder="e.g. K193629" value={bfForm.clearanceNumber} onChange={e=>sbf('clearanceNumber',e.target.value)} style={{fontFamily:'var(--font-mono)'}}/>
                </div>
                <div className="form-group" style={{gridColumn:'span 2'}}>
                  <label>Clearance Type</label>
                  <select value={bfForm.clearanceType} onChange={e=>sbf('clearanceType',e.target.value)}>
                    <option value="">— Select —</option>
                    {['510k','PMA','HDE','De_Novo'].map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{gridColumn:'span 2'}}>
                  <label>Clearance Date</label>
                  <input type="date" value={bfForm.clearanceDate} onChange={e=>sbf('clearanceDate',e.target.value)}/>
                </div>
                <div className="form-group" style={{gridColumn:'span 3'}}>
                  <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',marginTop:4}}>
                    <input type="checkbox" checked={bfForm.gudidVerified} onChange={e=>sbf('gudidVerified',e.target.checked)}/>
                    GUDID Verified
                  </label>
                </div>
                {bfForm.deviceType && BF_BODY_LOCS[bfForm.deviceType] && (
                  <div className="form-group" style={{gridColumn:'span 10'}}>
                    <label>Valid Body Locations</label>
                    <div style={{display:'flex',flexWrap:'wrap',gap:8,padding:'10px 12px',
                      background:'var(--bg-secondary)',borderRadius:'var(--radius-sm)',
                      border:`1px solid ${bfForm.bodyLocations.length===0?'var(--accent-amber)':'var(--border)'}`}}>
                      {BF_BODY_LOCS[bfForm.deviceType].map(loc=>(
                        <label key={loc} className="checkbox-group" style={{margin:0}}>
                          <input type="checkbox" checked={bfForm.bodyLocations.includes(loc)}
                            onChange={e=>sbf('bodyLocations',e.target.checked?[...bfForm.bodyLocations,loc]:bfForm.bodyLocations.filter(l=>l!==loc))}/>
                          <span style={{fontSize:12}}>{loc}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button type="submit" className="btn btn-primary" style={{background:'var(--accent-cyan)'}}
                disabled={bfBusy||!bfForm.manufacturerId||!bfForm.deviceCategory||!bfForm.deviceType||bfForm.bodyLocations.length===0}>
                {bfBusy?<><span className="spinner" style={{width:14,height:14}}/> Submitting…</>:'🏥 Submit Brownfield Onboarding Request'}
              </button>
            </form>
          </div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Onboarding Requests <span className="badge badge-cyan">{onboardingReqs.length}</span></span>
              <button className="btn btn-ghost btn-sm" onClick={loadOnboardingReqs}>↻ Refresh</button>
            </div>
            {onboardingReqs.length===0
              ? <div className="empty-state"><div className="icon">🏥</div><p>No onboarding requests yet</p></div>
              : <div className="table-wrap"><table>
                  <thead><tr><th>UDI-DI</th><th>Device Name</th><th>Manufacturer</th><th>Category</th><th>Clearance #</th><th>GUDID</th><th>Date</th><th>Status</th></tr></thead>
                  <tbody>{onboardingReqs.map(r=>(
                    <tr key={r.id}>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{r.udi_di}</td>
                      <td style={{fontWeight:600}}>{r.device_name}</td>
                      <td>{r.manufacturer_id}</td>
                      <td><span className="badge badge-blue">{r.device_category}</span></td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{r.clearance_number||'—'}</td>
                      <td><span className={`badge ${r.gudid_verified?'badge-green':'badge-amber'}`}>{r.gudid_verified?'✓ Verified':'Unverified'}</span></td>
                      <td style={{fontSize:11}}>{new Date(r.submitted_at).toLocaleDateString()}</td>
                      <td><span className={`badge ${r.status==='approved'?'badge-green':r.status==='rejected'?'badge-red':'badge-amber'}`}>{r.status}</span></td>
                    </tr>
                  ))}</tbody>
                </table></div>
            }
          </div>
        </>
      )}
    </>
  );
}
