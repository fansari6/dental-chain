import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const STATUS_CONFIG = {
  scheduled:   { badge:'badge-blue',   label:'📋 Scheduled',   bg:'rgba(59,130,246,0.06)',  border:'rgba(59,130,246,0.2)' },
  in_progress: { badge:'badge-amber',  label:'🔪 In Progress', bg:'rgba(245,158,11,0.06)', border:'rgba(245,158,11,0.25)' },
  completed:   { badge:'badge-green',  label:'✓ Completed',    bg:'rgba(16,185,129,0.04)', border:'rgba(16,185,129,0.2)' },
  cancelled:   { badge:'badge-red',    label:'✕ Cancelled',    bg:'rgba(239,68,68,0.04)',  border:'rgba(239,68,68,0.2)' },
};

const SPECIALTY_TO_CATEGORY = {
  'Orthopedic Surgery': 'orthopedic',
  'Cardiac Surgery':    'cardiac',
  'Neurosurgery':       'neurosurgery',
  'General Surgery':    'general_surgery',
};

const PROCEDURES_BY_CATEGORY = {
  orthopedic:      ['Total Hip Arthroplasty','Total Knee Arthroplasty','Total Shoulder Arthroplasty','Total Ankle Arthroplasty','Partial Knee Replacement','Hip Resurfacing','Spinal Fusion - Lumbar','Spinal Fusion - Cervical','ALIF','TLIF','Other'],
  cardiac:         ['Pacemaker Implantation','Defibrillator Implantation','Cardiac Valve Replacement','Coronary Artery Bypass Graft (CABG)','Stent Placement','Other'],
  neurosurgery:    ['Deep Brain Stimulation','Spinal Cord Stimulator Implantation','Ventricular Shunt Placement','Craniotomy','Spinal Fusion - Cervical','Spinal Fusion - Lumbar','Other'],
  general_surgery: ['Hernia Repair with Mesh','Breast Reconstruction','Laparoscopic Cholecystectomy','Other'],
};

const DEVICE_CATEGORIES = ['cardiac','orthopedic','neurosurgery','general_surgery'];

function formatDate(d) {
  return new Date(d+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
}

export default function CasesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [cases,        setCases]        = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [date,         setDate]         = useState(new Date().toISOString().split('T')[0]);
  const [consignments, setConsignments] = useState([]);
  const [dentists,     setDentists]     = useState([]);
  const [msg,          setMsg]          = useState(null);
  const [showCreate,   setShowCreate]   = useState(false);
  const [createBusy,   setCreateBusy]   = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const [caseForm, setCaseForm] = useState({
    procedureDate: today,
    procedureTime: '',
    treatmentRoom: '',
    dentistId: '',
    procedureType: '',
    deviceCategory: '',
    patientMrn: '',
    notes: '',
    requiredDevices: [],
  });
  const setF = (k,v) => setCaseForm(f=>({...f,[k]:v}));

  // When dentist changes → auto-fill device category
  const handleDentistChange = (dentistId) => {
    setF('dentistId', dentistId);
    const dentist = dentists.find(s=>s.dentist_id===dentistId);
    if (dentist?.specialty && SPECIALTY_TO_CATEGORY[dentist.specialty]) {
      const cat = SPECIALTY_TO_CATEGORY[dentist.specialty];
      setF('deviceCategory', cat);
      setF('procedureType', ''); // reset so user picks from filtered list
    }
  };

  // When device category changes → reset procedure type
  const handleCategoryChange = (cat) => {
    setF('deviceCategory', cat);
    setF('procedureType', '');
  };

  // Filtered consignments for pre-pull list
  const filteredConsignments = consignments.filter(c =>
    !caseForm.deviceCategory || c.deviceCategory === caseForm.deviceCategory
  );

  const [reqDevice, setReqDevice] = useState({ udiDI:'', deviceName:'', quantity:'1' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { date };
      if (user?.role==='dentist') params.dentistId = user.username;
      else if (user?.practiceId) params.practiceId = user.practiceId;
      setCases(Array.isArray(await api.getCases(params)) ? await api.getCases(params) : []);
    } catch {}
    finally { setLoading(false); }
  }, [date, user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user?.practiceId) return;
    api.getConsignments({}).then(d=>setConsignments((d||[]).filter(c=>c.status==='active'))).catch(()=>{});
    api.getDentists(user?.practiceId).then(setDentists).catch(()=>{});
  }, [user]);

  const prevDay = () => { const d=new Date(date+'T12:00:00'); d.setDate(d.getDate()-1); setDate(d.toISOString().split('T')[0]); };
  const nextDay = () => { const d=new Date(date+'T12:00:00'); d.setDate(d.getDate()+1); setDate(d.toISOString().split('T')[0]); };

  const generateCaseId = () => {
    const hosp=(user?.practiceId||'HOSP').split(' ')[0].substring(0,3).toUpperCase();
    return `CASE-${hosp}-${Date.now().toString(36).toUpperCase()}`;
  };

  const handleCreateCase = async (e) => {
    e.preventDefault(); setCreateBusy(true);
    try {
      const caseId = generateCaseId();
      await api.createCase({ caseId, procedureDate:caseForm.procedureDate, procedureTime:caseForm.procedureTime||null,
        treatmentRoom:caseForm.treatmentRoom, practiceId:user?.practiceId||'', dentistId:caseForm.dentistId,
        procedureType:caseForm.procedureType, deviceCategory:caseForm.deviceCategory,
        requiredDevices:caseForm.requiredDevices, patientMrn:caseForm.patientMrn, notes:caseForm.notes });
      setMsg({ type:'success', text:`Case ${caseId} scheduled` });
      setTimeout(()=>setMsg(null), 3000);
      setShowCreate(false);
      setCaseForm({ procedureDate:today, procedureTime:'', treatmentRoom:'', dentistId:'', procedureType:'', deviceCategory:'', patientMrn:'', notes:'', requiredDevices:[] });
      if (caseForm.procedureDate===date) load();
    } catch (err) { setMsg({ type:'error', text:err.message }); }
    finally { setCreateBusy(false); }
  };

  const updateStatus = async (caseId, status) => {
    try { await api.updateCaseStatus(caseId, status); load(); }
    catch (err) { setMsg({ type:'error', text:err.message }); }
  };

  const addRequiredDevice = () => {
    if (!reqDevice.deviceName) return;
    const cons = filteredConsignments.find(c=>c.udiDI===reqDevice.udiDI||c.consignmentId===reqDevice.udiDI);
    setF('requiredDevices', [...caseForm.requiredDevices, {
      udiDI: cons?.udiDI||reqDevice.udiDI, deviceName: cons?.deviceName||reqDevice.deviceName,
      quantity: parseInt(reqDevice.quantity)||1,
    }]);
    setReqDevice({ udiDI:'', deviceName:'', quantity:'1' });
  };

  const isToday = date===today;

  return (
    <>
      <div className="page-header">
        <h2>📅 Treatment Cases</h2>
        <p>Operating room cases and pre-pull device requirements — {user?.practiceId||'All Practices'}</p>
      </div>

      {msg && <div className={`alert alert-${msg.type}`} style={{marginBottom:12}}>{msg.type==='error'?'⚠':'✓'} {msg.text}</div>}

      {/* Date navigation */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button className="btn btn-ghost btn-sm" onClick={prevDay}>← Prev</button>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)}
              style={{fontFamily:'var(--font-mono)',fontSize:14,fontWeight:600,padding:'6px 12px',
                border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',
                background:'var(--bg-card)',color:'var(--text-primary)'}}/>
            <span style={{fontSize:14,fontWeight:600,color:'var(--text-primary)'}}>{formatDate(date)}</span>
            {isToday && <span className="badge badge-green" style={{fontSize:11}}>Today</span>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={nextDay}>Next →</button>
          {!isToday && <button className="btn btn-ghost btn-sm" onClick={()=>setDate(today)}>⌂ Today</button>}
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-ghost btn-sm" onClick={load}>↻ Refresh</button>
          <button className="btn btn-primary" style={{background:'var(--accent-amber)'}} onClick={()=>setShowCreate(true)}>
            + New Case
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:16}}>
        {[
          { label:'Scheduled',   value:cases.filter(c=>c.status==='scheduled').length,   color:'blue'  },
          { label:'In Progress', value:cases.filter(c=>c.status==='in_progress').length, color:'amber' },
          { label:'Completed',   value:cases.filter(c=>c.status==='completed').length,   color:'green' },
          { label:'Cancelled',   value:cases.filter(c=>c.status==='cancelled').length,   color:'red'   },
        ].map(k=>(
          <div key={k.label} className={`kpi-card ${k.color}`}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{color:`var(--accent-${k.color})`}}>{loading?'—':k.value}</div>
          </div>
        ))}
      </div>

      {/* Create case modal */}
      {showCreate && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1000,
          display:'flex',alignItems:'center',justifyContent:'center',padding:24,overflowY:'auto'}}
          onClick={()=>setShowCreate(false)}>
          <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',
            borderRadius:'var(--radius-lg)',padding:28,width:'min(680px,100%)',maxHeight:'90vh',overflowY:'auto'}}
            onClick={e=>e.stopPropagation()}>
            <h3 style={{marginBottom:20}}>📅 Schedule New Case</h3>
            <form onSubmit={handleCreateCase}>

              {/* Row 1: Date, Time, Treatment Room */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12}}>
                <div className="form-group" style={{marginBottom:0}}>
                  <label>Procedure Date</label>
                  <input type="date" value={caseForm.procedureDate} onChange={e=>setF('procedureDate',e.target.value)} required/>
                </div>
                <div className="form-group" style={{marginBottom:0}}>
                  <label>Procedure Time <span style={{fontSize:10,color:'var(--text-muted)'}}>optional</span></label>
                  <input type="time" value={caseForm.procedureTime} onChange={e=>setF('procedureTime',e.target.value)}/>
                </div>
                <div className="form-group" style={{marginBottom:0}}>
                  <label>Treatment Room <span style={{fontSize:10,color:'var(--text-muted)'}}>optional</span></label>
                  <input placeholder="e.g. OR-1, OR-2" value={caseForm.treatmentRoom} onChange={e=>setF('treatmentRoom',e.target.value)}/>
                </div>
              </div>

              {/* Row 2: Dentist → auto-fills category */}
              <div className="form-group" style={{marginBottom:12}}>
                <label>Dentist</label>
                <select value={caseForm.dentistId} onChange={e=>handleDentistChange(e.target.value)}>
                  <option value="">— Select dentist —</option>
                  {dentists.map(s=>(
                    <option key={s.dentist_id} value={s.dentist_id}>
                      {s.full_name} ({s.specialty||s.dentist_id})
                    </option>
                  ))}
                </select>
                {caseForm.dentistId && (() => {
                  const s = dentists.find(x=>x.dentist_id===caseForm.dentistId);
                  return s ? <div style={{fontSize:11,color:'var(--text-muted)',marginTop:3}}>🔬 {s.specialty} · 🏥 {(s.practices||[]).join(', ')}</div> : null;
                })()}
              </div>

              {/* Row 3: Device Category → filters procedures + consignments */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                <div className="form-group" style={{marginBottom:0}}>
                  <label>Device Category</label>
                  <select value={caseForm.deviceCategory} onChange={e=>handleCategoryChange(e.target.value)}>
                    <option value="">— Select —</option>
                    {DEVICE_CATEGORIES.map(c=><option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
                  </select>
                  {caseForm.deviceCategory && (
                    <div style={{fontSize:11,color:'var(--text-muted)',marginTop:3}}>
                      {filteredConsignments.length} matching consignments in inventory
                    </div>
                  )}
                </div>
                <div className="form-group" style={{marginBottom:0}}>
                  <label>Procedure Type</label>
                  {caseForm.deviceCategory
                    ? <select value={caseForm.procedureType} onChange={e=>setF('procedureType',e.target.value)}>
                        <option value="">— Select procedure —</option>
                        {(PROCEDURES_BY_CATEGORY[caseForm.deviceCategory]||[]).map(p=><option key={p} value={p}>{p}</option>)}
                      </select>
                    : <input placeholder="Select device category first" value={caseForm.procedureType}
                        onChange={e=>setF('procedureType',e.target.value)} disabled={!caseForm.deviceCategory&&dentists.length>0}/>
                  }
                </div>
              </div>

              {/* Row 4: Patient MRN, Notes */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
                <div className="form-group" style={{marginBottom:0}}>
                  <label>Patient MRN <span style={{fontSize:10,color:'var(--text-muted)'}}>optional</span></label>
                  <input placeholder="e.g. MRN-12345" value={caseForm.patientMrn} onChange={e=>setF('patientMrn',e.target.value)}/>
                </div>
                <div className="form-group" style={{marginBottom:0}}>
                  <label>Notes <span style={{fontSize:10,color:'var(--text-muted)'}}>optional</span></label>
                  <input placeholder="Any special requirements..." value={caseForm.notes} onChange={e=>setF('notes',e.target.value)}/>
                </div>
              </div>

              {/* Pre-pull device list */}
              <div style={{marginBottom:16,padding:'14px 16px',background:'var(--bg-secondary)',
                borderRadius:'var(--radius-md)',border:'1px solid var(--border)'}}>
                <div style={{fontSize:13,fontWeight:700,color:'var(--accent-amber)',marginBottom:12}}>
                  📦 Pre-Pull Device List
                  <span style={{fontWeight:400,color:'var(--text-muted)',fontSize:11,marginLeft:8}}>devices needed for this case</span>
                </div>

                {/* Add device row — stacked vertically */}
                <div style={{display:'grid',gridTemplateColumns:'1fr',gap:8,marginBottom:12}}>
                  {/* Select from inventory */}
                  <div className="form-group" style={{marginBottom:0}}>
                    <label>Select from inventory {caseForm.deviceCategory?`(${caseForm.deviceCategory.replace(/_/g,' ')} only)`:''}</label>
                    <select value={reqDevice.udiDI} onChange={e=>{
                      const cons=filteredConsignments.find(c=>c.udiDI===e.target.value);
                      setReqDevice(r=>({...r, udiDI:e.target.value, deviceName:cons?.deviceName||r.deviceName}));
                    }}>
                      <option value="">— Select consignment —</option>
                      {filteredConsignments.map(c=>(
                        <option key={c.consignmentId} value={c.udiDI}>
                          {c.deviceName} · {c.deviceType} · avail: {c.quantity-(c.usedQuantity||0)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Or enter manually */}
                  <div className="form-group" style={{marginBottom:0}}>
                    <label>Or enter device name manually</label>
                    <input placeholder="Device name..." value={reqDevice.deviceName}
                      onChange={e=>setReqDevice(r=>({...r,deviceName:e.target.value}))}/>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'flex-end'}}>
                    <div className="form-group" style={{marginBottom:0,width:100}}>
                      <label>Quantity</label>
                      <input type="number" min="1" value={reqDevice.quantity}
                        onChange={e=>setReqDevice(r=>({...r,quantity:e.target.value}))}/>
                    </div>
                    <button type="button" className="btn btn-primary btn-sm"
                      style={{background:'var(--accent-amber)',marginBottom:0}}
                      disabled={!reqDevice.deviceName} onClick={addRequiredDevice}>
                      + Add to List
                    </button>
                  </div>
                </div>

                {/* Added devices */}
                {caseForm.requiredDevices.length===0
                  ? <div style={{fontSize:12,color:'var(--text-muted)',fontStyle:'italic'}}>No devices added yet</div>
                  : <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                      {caseForm.requiredDevices.map((d,i)=>(
                        <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',
                          background:'var(--bg-card)',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',fontSize:12}}>
                          <span style={{fontWeight:600}}>{d.deviceName}</span>
                          <span className="badge badge-amber" style={{fontSize:10}}>×{d.quantity}</span>
                          <button type="button" onClick={()=>setF('requiredDevices',caseForm.requiredDevices.filter((_,j)=>j!==i))}
                            style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent-red)',fontSize:14,padding:'0 2px',lineHeight:1}}>✕</button>
                        </div>
                      ))}
                    </div>
                }
              </div>

              <div style={{display:'flex',gap:8}}>
                <button type="submit" className="btn btn-primary" style={{background:'var(--accent-amber)'}} disabled={createBusy}>
                  {createBusy?<><span className="spinner" style={{width:14,height:14}}/> Saving…</>:'+ Schedule Case'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={()=>{
                  setShowCreate(false);
                  setCaseForm({ procedureDate:today, procedureTime:'', treatmentRoom:'', dentistId:'',
                    procedureType:'', deviceCategory:'', patientMrn:'', notes:'', requiredDevices:[] });
                  setReqDevice({ udiDI:'', deviceName:'', quantity:'1' });
                }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cases list */}
      {loading
        ? <div className="loading-overlay"><span className="spinner"/></div>
        : cases.length===0
          ? <div className="empty-state">
              <div className="icon">📅</div>
              <p>No cases scheduled for {formatDate(date)}</p>
              <button className="btn btn-primary" style={{marginTop:12,background:'var(--accent-amber)'}}
                onClick={()=>setShowCreate(true)}>+ Schedule First Case</button>
            </div>
          : <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {cases.map(cs=>{
                const sc=STATUS_CONFIG[cs.status]||STATUS_CONFIG.scheduled;
                const reqDevices=typeof cs.required_devices==='string'?JSON.parse(cs.required_devices):(cs.required_devices||[]);
                return (
                  <div key={cs.case_id} style={{padding:'16px 20px',background:sc.bg,
                    borderRadius:'var(--radius-md)',border:`1px solid ${sc.border}`}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                      <div>
                        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
                          <span style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--text-muted)'}}>{cs.case_id}</span>
                          <span className={`badge ${sc.badge}`}>{sc.label}</span>
                          {cs.procedure_time && <span style={{fontSize:12,color:'var(--text-secondary)'}}>🕐 {cs.procedure_time}</span>}
                          {cs.or_room && <span style={{fontSize:12,color:'var(--text-secondary)'}}>🚪 OR {cs.or_room}</span>}
                          {cs.device_category && <span className="badge badge-blue" style={{fontSize:10}}>{cs.device_category.replace(/_/g,' ')}</span>}
                        </div>
                        <div style={{fontSize:16,fontWeight:700,color:'var(--text-primary)',marginBottom:4}}>
                          {cs.procedure_type||'—'}
                        </div>
                        <div style={{display:'flex',gap:16,fontSize:12,color:'var(--text-secondary)',flexWrap:'wrap'}}>
                          {cs.dentist_id && <span>👨‍⚕️ {cs.dentist_id}</span>}
                          {cs.patient_mrn && <span>🏷 {cs.patient_mrn}</span>}
                          <span>🏥 {cs.practice_id}</span>
                          <span style={{color:'var(--text-muted)'}}>by {cs.created_by}</span>
                        </div>
                        {cs.notes && <div style={{fontSize:12,color:'var(--text-muted)',marginTop:4,fontStyle:'italic'}}>{cs.notes}</div>}
                      </div>
                      <div style={{display:'flex',gap:8,flexShrink:0,flexWrap:'wrap',justifyContent:'flex-end'}}>
                        {cs.status==='scheduled' && <>
                          <button className="btn btn-ghost btn-sm" style={{color:'var(--accent-amber)',borderColor:'var(--accent-amber)'}}
                            onClick={()=>updateStatus(cs.case_id,'in_progress')}>▶ Start</button>
                          <button className="btn btn-ghost btn-sm" style={{color:'var(--accent-blue)',borderColor:'var(--accent-blue)'}}
                            onClick={()=>navigate('/dental_assistant')}>+ Record Implant</button>
                          <button className="btn btn-ghost btn-sm" style={{color:'var(--accent-red)',borderColor:'var(--accent-red)'}}
                            onClick={()=>{ if(window.confirm('Cancel this case?')) updateStatus(cs.case_id,'cancelled'); }}>✕ Cancel</button>
                        </>}
                        {cs.status==='in_progress' && <>
                          <button className="btn btn-primary btn-sm"
                            style={{background:'var(--accent-green)',opacity:cs.implant_ids?.length?1:0.4}}
                            disabled={!cs.implant_ids?.length}
                            title={!cs.implant_ids?.length?'Record at least one implant first':'Mark case complete'}
                            onClick={()=>updateStatus(cs.case_id,'completed')}>✓ Complete</button>
                          <button className="btn btn-ghost btn-sm" style={{color:'var(--accent-blue)',borderColor:'var(--accent-blue)'}}
                            onClick={()=>navigate('/dental_assistant')}>+ Record Implant</button>
                        </>}
                      </div>
                    </div>

                    {reqDevices.length>0 && (
                      <div style={{borderTop:'1px solid rgba(0,0,0,0.08)',paddingTop:10}}>
                        <div style={{fontSize:11,fontWeight:700,color:'var(--text-secondary)',textTransform:'uppercase',
                          letterSpacing:'0.06em',marginBottom:8}}>📦 Pre-Pull Device List</div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                          {reqDevices.map((d,i)=>(
                            <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 12px',
                              background:'var(--bg-card)',borderRadius:'var(--radius-sm)',
                              border:'1px solid var(--border)',fontSize:12}}>
                              <span style={{fontWeight:600}}>{d.deviceName}</span>
                              <span className="badge badge-amber" style={{fontSize:10}}>×{d.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {cs.implant_ids?.length>0 && (
                      <div style={{borderTop:'1px solid rgba(0,0,0,0.08)',paddingTop:8,marginTop:8}}>
                        <div style={{fontSize:11,fontWeight:700,color:'var(--accent-green)',textTransform:'uppercase',
                          letterSpacing:'0.06em',marginBottom:6}}>✓ Recorded Implants</div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                          {cs.implant_ids.map(id=>(
                            <span key={id} className="badge badge-green" style={{fontFamily:'var(--font-mono)',fontSize:10}}>{id}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
      }
    </>
  );
}
