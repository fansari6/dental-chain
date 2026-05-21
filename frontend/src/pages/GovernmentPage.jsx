import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

const TABS = [
  { key:'devices',    label:'🦾 Devices' },
  { key:'brownfield', label:'🏥 Brownfield' },
  { key:'clearances', label:'📋 Clearances' },
  { key:'iso13485',   label:'🏭 ISO 13485' },
  { key:'lots',       label:'🔬 Lots' },
  { key:'analytics',  label:'📊 Analytics' },
  { key:'mdr',        label:'⏰ MDR Deadlines' },
];

const CLEARANCE_TYPES = ['510k', 'De_Novo', 'HDE', 'PMA'];

function Modal({ title, onClose, children }) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}
      onClick={onClose}>
      <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',
        borderRadius:'var(--radius-lg)',padding:32,width:480,
        maxHeight:'80vh',overflowY:'auto'}}
        onClick={e=>e.stopPropagation()}>
        <h3 style={{marginBottom:16}}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

export default function GovernmentPage() {
  const [tab, setTab] = useState('devices');

  // Data
  const [devices,            setDevices]            = useState([]);
  const [clearances,         setClearances]         = useState([]);
  const [isos,               setISOs]               = useState([]);
  const [lots,               setLots]               = useState([]);
  const [manufacturers,      setMfrs]               = useState([]);
  const [submissions,        setSubmissions]        = useState([]);
  const [onboardingRequests, setOnboardingRequests] = useState([]);
  const [implants,           setImplants]           = useState([]);
  const [mdrData,            setMdrData]            = useState({ deadlines:[], summary:{} });
  const [mdrLoading,         setMdrLoading]         = useState(false);

  // UI state
  const [loading,          setLoading]          = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [msg,              setMsg]              = useState(null);
  const [busy,             setBusy]             = useState(false);
  const [reviewBusy,       setReviewBusy]       = useState({});
  const [onboardBusy,      setOnboardBusy]      = useState({});
  const [hospitalFilter,   setHospitalFilter]   = useState('');
  const [deviceSearch,     setDeviceSearch]     = useState('');
  const [clearanceSearch,  setClearanceSearch]  = useState('');
  const [lotSearch,        setLotSearch]        = useState('');
  const [surgeonFilter,    setSurgeonFilter]    = useState('');

  // NL Query
  const [nlQuery,   setNlQuery]   = useState('');
  const [nlBusy,    setNlBusy]    = useState(false);
  const [nlResult,  setNlResult]  = useState(null);
  const [nlError,   setNlError]   = useState('');
  const [nlFilters, setNlFilters] = useState(null);

  // Modal
  const [modal,      setModal]  = useState(null);
  const [modalTarget,setMT]     = useState(null);
  const [modalInput, setMI]     = useState('');
  const [modalInput2,setMI2]    = useState('');
  const [modalBusy,  setMB]     = useState(false);
  const [modalMsg,   setMM]     = useState(null);

  // Clearance form
  const [clrForm, setClrForm] = useState({
    clearanceNumber:'', udiDI:'', manufacturerId:'', clearanceType:'510k',
    indicationsForUse:'', clearanceDate:'', expiryDate:'',
  });
  const setC = (k,v) => setClrForm(f=>({...f,[k]:v}));

  const today = new Date().toISOString().split('T')[0];

  // Data loading
  const refresh = useCallback(async () => {
    setLoading(true);
    api.getUsersByRole('manufacturer').then(setMfrs).catch(()=>{});
    try {
      const [d, c, i, l] = await Promise.all([
        api.getDevices(), api.getClearances(), api.getISO13485(), api.getLots(),
      ]);
      setDevices(d); setClearances(c); setISOs(i); setLots(l);
    } catch {}
    setLoading(false);
  }, []);

  const loadSubmissions = useCallback(async () => {
    try { setSubmissions(await api.getDeviceSubmissions()); } catch {}
  }, []);

  const loadOnboardingRequests = useCallback(async () => {
    try { setOnboardingRequests(await api.getOnboardingRequests()); } catch {}
  }, []);

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try { setImplants(Array.isArray(await api.getAllImplants()) ? await api.getAllImplants() : []); }
    catch (err) { console.error('Analytics error:', err); }
    finally { setAnalyticsLoading(false); }
  };

  const loadMDRData = async () => {
    setMdrLoading(true);
    try { setMdrData((await api.getMDRDeadlines()) || { deadlines:[], summary:{} }); }
    catch {}
    finally { setMdrLoading(false); }
  };

  useEffect(() => {
    refresh();
    loadSubmissions();
    loadOnboardingRequests();
  }, [refresh, loadSubmissions, loadOnboardingRequests]);

  // NL Query
  const runNLQuery = async () => {
    if (!nlQuery.trim()) return;
    setNlBusy(true); setNlError(''); setNlResult(null); setNlFilters(null);
    let data = implants;
    if (data.length === 0) {
      setAnalyticsLoading(true);
      try { data = await api.getAllImplants(); setImplants(data); } catch {}
      setAnalyticsLoading(false);
    }
    const hospitals  = [...new Set(data.map(i => i.hospitalId))].join(', ');
    const categories = [...new Set(data.map(i => i.deviceCategory))].join(', ');
    const surgeons   = [...new Set(data.map(i => i.surgeonId).filter(Boolean))].slice(0,20).join(', ');
    const prompt = `You are a medical device data analyst. Convert this natural language query into JSON filter criteria for surgical implant records.
Available data: Hospitals: ${hospitals}. Categories: ${categories}. Surgeons: ${surgeons}. Total: ${data.length} records.
User query: "${nlQuery}"
Return ONLY valid JSON:
{"hospitalId":null,"deviceCategory":null,"status":null,"surgeonId":null,"dateFrom":null,"dateTo":null,"deviceName":null,"explanation":"one sentence"}`;
    try {
      const resp = await fetch('/api/ai/complete', { method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json'}, body: JSON.stringify({ prompt, maxTokens:300 }) });
      const respData = await resp.json();
      if (!resp.ok) throw new Error(respData.error || 'AI failed');
      const jsonMatch = (respData.text||'').match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Could not parse AI response');
      const filters = JSON.parse(jsonMatch[0]);
      const filtered = data.filter(i => {
        if (filters.hospitalId     && !i.hospitalId?.toLowerCase().includes(filters.hospitalId.toLowerCase())) return false;
        if (filters.deviceCategory && i.deviceCategory !== filters.deviceCategory) return false;
        if (filters.status         && i.status !== filters.status) return false;
        if (filters.surgeonId      && i.surgeonId !== filters.surgeonId) return false;
        if (filters.dateFrom       && i.procedureDate < filters.dateFrom) return false;
        if (filters.dateTo         && i.procedureDate > filters.dateTo) return false;
        if (filters.deviceName     && !i.deviceName?.toLowerCase().includes(filters.deviceName.toLowerCase())) return false;
        return true;
      });
      setNlFilters(filters);
      setNlResult({ filters, explanation: filters.explanation||'Query applied', count: filtered.length, records: filtered });
    } catch (err) { setNlError('Could not process query: ' + err.message); }
    finally { setNlBusy(false); }
  };

  const handleReview = async (id, action, rejectReason) => {
    setReviewBusy(b => ({...b,[id]:true}));
    try {
      await api.reviewDeviceSubmission(id, { action, rejectReason });
      setMsg({ type:'success', text: action==='approve' ? 'Device approved and registered on blockchain.' : 'Submission rejected.' });
      setTimeout(()=>setMsg(null), 3000);
      loadSubmissions();
      if (action==='approve') refresh();
    } catch (err) { setMsg({ type:'error', text: err.message }); }
    finally { setReviewBusy(b => ({...b,[id]:false})); }
  };

  const handleOnboardReview = async (id, action, rejectReason) => {
    setOnboardBusy(b => ({...b,[id]:true}));
    try {
      await api.reviewOnboardingRequest(id, { action, rejectReason });
      setMsg({ type:'success', text: action==='approve' ? 'Device fast-track approved.' : 'Onboarding request rejected.' });
      setTimeout(()=>setMsg(null), 3000);
      loadOnboardingRequests();
      if (action==='approve') refresh();
    } catch (err) { setMsg({ type:'error', text: err.message }); }
    finally { setOnboardBusy(b => ({...b,[id]:false})); }
  };

  const openModal  = (type, target, i1='', i2='') => { setModal(type); setMT(target); setMI(i1); setMI2(i2); setMM(null); };
  const closeModal = () => { setModal(null); setMT(null); setMI(''); setMI2(''); setMM(null); };

  const handleModalAction = async () => {
    setMB(true); setMM(null);
    try {
      if (modal==='revoke-clearance') await api.revokeClearance(modalTarget, { reason: modalInput });
      if (modal==='revoke-iso')       await api.revokeISO13485(modalTarget,  { reason: modalInput });
      if (modal==='recall-lot')       await api.recallLot(modalTarget, { recallClass: modalInput, reason: modalInput2 });
      setMM({ type:'success', text:'Done — ledger updated.' });
      refresh();
      setTimeout(closeModal, 1400);
    } catch (err) { setMM({ type:'error', text: err.message }); }
    finally { setMB(false); }
  };

  const submitClearance = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      await api.issueClearance(clrForm);
      setMsg({ type:'success', text:`Clearance "${clrForm.clearanceNumber}" issued on blockchain.` });
      setTimeout(()=>setMsg(null), 3000);
      setClrForm({ clearanceNumber:'', udiDI:'', manufacturerId:'', clearanceType:'510k', indicationsForUse:'', clearanceDate:'', expiryDate:'' });
      refresh();
    } catch (err) { setMsg({ type:'error', text: err.message }); }
    finally { setBusy(false); }
  };

  const tabStyle = (t) => ({
    padding:'8px 16px', borderRadius:'var(--radius-sm)', cursor:'pointer',
    fontSize:13, fontWeight:600, border:'none',
    background: tab===t ? 'var(--accent-blue)' : 'transparent',
    color: tab===t ? '#fff' : 'var(--text-secondary)',
  });

  const statusBadge = (s) => {
    const m = { active:'badge-green', revoked:'badge-red', recalled:'badge-red', quarantine:'badge-amber' };
    return <span className={`badge ${m[s]||'badge-blue'}`}>{s}</span>;
  };

  const pendingCount        = submissions.filter(s=>s.status==='pending').length;
  const pendingOnboardCount = onboardingRequests.filter(r=>r.status==='pending').length;

  const filteredDevices    = devices.filter(d => !deviceSearch.trim() || ['deviceName','udiDI','manufacturerId','deviceCategory','deviceType'].some(k=>(d[k]||'').toLowerCase().includes(deviceSearch.toLowerCase())));
  const filteredClearances = clearances.filter(c => !clearanceSearch.trim() || ['clearanceNumber','udiDI','manufacturerId','clearanceType','indicationsForUse'].some(k=>(c[k]||'').toLowerCase().includes(clearanceSearch.toLowerCase())));
  const filteredLots       = lots.filter(l => !lotSearch.trim() || ['lotId','deviceName','manufacturerId','lotNumber','status'].some(k=>(l[k]||'').toLowerCase().includes(lotSearch.toLowerCase())));

  const CC = {
    cardiac:         {bg:'rgba(59,130,246,0.06)', border:'rgba(59,130,246,0.15)', badge:'badge-blue',   label:'🫀 Cardiac'},
    general_surgery: {bg:'rgba(16,185,129,0.06)',border:'rgba(16,185,129,0.15)',badge:'badge-green',  label:'🟢 General Surgery'},
    neurosurgery:    {bg:'rgba(139,92,246,0.06)',border:'rgba(139,92,246,0.15)',badge:'badge-purple', label:'🧠 Neurosurgery'},
    orthopedic:      {bg:'rgba(245,158,11,0.06)',border:'rgba(245,158,11,0.15)',badge:'badge-amber',  label:'🦴 Orthopedic'},
  };

  return (
    <>
      <div className="page-header">
        <h2>🏛 FDA / Regulatory Portal</h2>
        <p>Review device submissions, issue clearances, manage recalls, view analytics</p>
      </div>

      <div style={{display:'flex',gap:4,marginBottom:20,background:'var(--bg-card)',
        padding:4,borderRadius:'var(--radius-md)',width:'fit-content',
        border:'1px solid var(--border)',flexWrap:'wrap'}}>
        {TABS.map(t => (
          <button key={t.key} style={tabStyle(t.key)} onClick={() => {
            setTab(t.key); setMsg(null);
            if (t.key==='analytics' && implants.length===0) loadAnalytics();
            if (t.key==='mdr') loadMDRData();
          }}>
            {t.label}
            {t.key==='devices'    && pendingCount>0        && <span className="badge badge-amber" style={{marginLeft:6,fontSize:10}}>{pendingCount}</span>}
            {t.key==='brownfield' && pendingOnboardCount>0 && <span className="badge badge-cyan"  style={{marginLeft:6,fontSize:10}}>{pendingOnboardCount}</span>}
            {t.key==='mdr'        && mdrData.summary?.overdue>0 && <span className="badge badge-red" style={{marginLeft:6,fontSize:10}}>{mdrData.summary.overdue}</span>}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`alert alert-${msg.type}`} style={{marginBottom:12}}>
          {msg.type==='error'?'⚠':'✓'} {msg.text}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <Modal title={
          modal==='revoke-clearance' ? '✕ Revoke Clearance' :
          modal==='revoke-iso'       ? '✕ Revoke ISO 13485 Certificate' :
          modal==='recall-lot'       ? '⚠ Recall Lot' : ''
        } onClose={closeModal}>
          {modalMsg && <div className={`alert alert-${modalMsg.type}`}>{modalMsg.text}</div>}
          {(modal==='revoke-clearance'||modal==='revoke-iso') && (
            <div className="form-group" style={{marginBottom:16}}>
              <label>Reason</label>
              <input placeholder="Enter reason..." value={modalInput} onChange={e=>setMI(e.target.value)} />
            </div>
          )}
          {modal==='recall-lot' && (<>
            <div className="form-group" style={{marginBottom:12}}>
              <label>Recall Class</label>
              <select value={modalInput} onChange={e=>setMI(e.target.value)}>
                <option value="">— Select class —</option>
                <option value="Class I">Class I — Dangerous or potentially life-threatening</option>
                <option value="Class II">Class II — May cause temporary adverse health consequences</option>
                <option value="Class III">Class III — Unlikely to cause adverse health consequences</option>
              </select>
            </div>
            <div className="form-group" style={{marginBottom:16}}>
              <label>Recall Reason</label>
              <input placeholder="e.g. Contamination detected in manufacturing process"
                value={modalInput2} onChange={e=>setMI2(e.target.value)} />
            </div>
          </>)}
          <div style={{display:'flex',gap:12}}>
            <button className="btn btn-primary" onClick={handleModalAction}
              disabled={modalBusy||!modalInput||(modal==='recall-lot'&&!modalInput2)}>
              {modalBusy ? <><span className="spinner" style={{width:14,height:14}}/> …</> : '✓ Confirm'}
            </button>
            <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* ══ DEVICES TAB ══ */}
      {tab==='devices' && <>
        <div className="card" style={{borderColor: pendingCount>0?'rgba(245,158,11,0.4)':undefined}}>
          <div className="card-header">
            <span className="card-title">
              📋 Pending Device Submissions
              {pendingCount>0 && <span className="badge badge-amber" style={{marginLeft:8}}>{pendingCount} pending</span>}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={loadSubmissions}>↻ Refresh</button>
          </div>
          {submissions.filter(s=>s.status==='pending').length===0
            ? <div className="empty-state"><div className="icon">📋</div><p>No pending device submissions</p></div>
            : <div className="table-wrap"><table>
                <thead><tr>
                  <th>UDI-DI</th><th>Device Name</th><th>Manufacturer</th>
                  <th>Category</th><th>Type</th><th>Body Locations</th>
                  <th>MRI Safe</th><th>Attributes</th><th>Submitted</th><th>Actions</th>
                </tr></thead>
                <tbody>{submissions.filter(s=>s.status==='pending').map(s=>(
                  <tr key={s.id}>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{s.udi_di}</td>
                    <td style={{fontWeight:600}}>{s.device_name}</td>
                    <td>{s.manufacturer_id}</td>
                    <td><span className="badge badge-blue">{s.device_category}</span></td>
                    <td style={{fontSize:12}}>{s.device_type}</td>
                    <td style={{fontSize:11,maxWidth:180,wordBreak:'break-word'}}>{s.body_locations||'—'}</td>
                    <td><span className={`badge ${s.mri_safe==='safe'?'badge-green':s.mri_safe==='conditional'?'badge-amber':'badge-red'}`}>{s.mri_safe}</span></td>
                    <td style={{fontSize:11}}>
                      {s.single_use    && <span className="badge badge-amber" style={{marginRight:3}}>Single Use</span>}
                      {s.sterile       && <span className="badge badge-green" style={{marginRight:3}}>Sterile</span>}
                      {s.contains_latex && <span className="badge badge-red">Latex</span>}
                    </td>
                    <td style={{fontSize:11}}>{new Date(s.submitted_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{display:'flex',gap:6}}>
                        <button className="btn btn-success btn-sm" disabled={reviewBusy[s.id]}
                          onClick={()=>handleReview(s.id,'approve')}>
                          {reviewBusy[s.id]?<span className="spinner" style={{width:12,height:12}}/>:'✅ Approve'}
                        </button>
                        <button className="btn btn-danger btn-sm" disabled={reviewBusy[s.id]}
                          onClick={()=>{ const r=window.prompt('Rejection reason:'); if(r?.trim()) handleReview(s.id,'reject',r.trim()); }}>
                          ✕ Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>

        {submissions.filter(s=>s.status!=='pending').length>0 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">📁 Reviewed Submissions <span className="badge badge-blue" style={{marginLeft:8}}>{submissions.filter(s=>s.status!=='pending').length}</span></span>
            </div>
            <div className="table-wrap"><table>
              <thead><tr><th>UDI-DI</th><th>Device Name</th><th>Manufacturer</th><th>Submitted</th><th>Reviewed</th><th>Status</th><th>Reject Reason</th></tr></thead>
              <tbody>{submissions.filter(s=>s.status!=='pending').map(s=>(
                <tr key={s.id}>
                  <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{s.udi_di}</td>
                  <td style={{fontWeight:600}}>{s.device_name}</td>
                  <td>{s.manufacturer_id}</td>
                  <td style={{fontSize:11}}>{new Date(s.submitted_at).toLocaleDateString()}</td>
                  <td style={{fontSize:11}}>{s.reviewed_at?new Date(s.reviewed_at).toLocaleDateString():'—'}</td>
                  <td><span className={`badge ${s.status==='approved'?'badge-green':'badge-red'}`}>{s.status}</span></td>
                  <td style={{fontSize:11,color:'var(--accent-red)'}}>{s.reject_reason||'—'}</td>
                </tr>
              ))}</tbody>
            </table></div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <span className="card-title">Registered Devices <span className="badge badge-blue">{devices.length}</span></span>
            <button className="btn btn-ghost btn-sm" onClick={refresh}>↻ Refresh</button>
          </div>
          <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center'}}>
            <input placeholder="🔍 Search by name, UDI, manufacturer, category..."
              value={deviceSearch} onChange={e=>setDeviceSearch(e.target.value)} style={{flex:1,maxWidth:380}}/>
            {deviceSearch && <button className="btn btn-ghost btn-sm" onClick={()=>setDeviceSearch('')}>✕ Clear</button>}
          </div>
          {loading ? <div className="loading-overlay"><span className="spinner"/></div>
          : filteredDevices.length===0 ? <div className="empty-state"><div className="icon">🦾</div><p>No devices</p></div>
          : <div className="table-wrap"><table>
              <thead><tr><th>UDI-DI</th><th>Device Name</th><th>Manufacturer</th><th>Category</th><th>Type</th><th>MRI Safe</th><th>Single Use</th><th>Sterile</th></tr></thead>
              <tbody>{filteredDevices.map(d=>(
                <tr key={d.udiDI}>
                  <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{d.udiDI}</td>
                  <td style={{fontWeight:600}}>{d.deviceName}</td>
                  <td>{d.manufacturerId}</td>
                  <td><span className="badge badge-blue">{d.deviceCategory}</span></td>
                  <td style={{fontSize:12}}>{d.deviceType}</td>
                  <td><span className={`badge ${d.mriSafe==='safe'?'badge-green':d.mriSafe==='conditional'?'badge-amber':'badge-red'}`}>{d.mriSafe}</span></td>
                  <td><span className={`badge ${d.singleUse?'badge-amber':'badge-green'}`}>{d.singleUse?'Yes':'No'}</span></td>
                  <td><span className={`badge ${d.sterile?'badge-green':'badge-red'}`}>{d.sterile?'Yes':'No'}</span></td>
                </tr>
              ))}</tbody>
            </table></div>
          }
        </div>
      </>}

      {/* ══ BROWNFIELD TAB ══ */}
      {tab==='brownfield' && <>
        <div className="card" style={{borderColor:pendingOnboardCount>0?'rgba(6,182,212,0.4)':undefined}}>
          <div className="card-header">
            <span className="card-title">
              🏥 Pending Brownfield Onboarding Requests
              {pendingOnboardCount>0 && <span className="badge badge-cyan" style={{marginLeft:8}}>{pendingOnboardCount} pending</span>}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={loadOnboardingRequests}>↻ Refresh</button>
          </div>
          {onboardingRequests.filter(r=>r.status==='pending').length===0
            ? <div className="empty-state"><div className="icon">🏥</div><p>No pending onboarding requests</p></div>
            : <div className="table-wrap"><table>
                <thead><tr><th>UDI-DI</th><th>Device Name</th><th>Manufacturer</th><th>Category</th><th>Clearance #</th><th>GUDID</th><th>Submitted By</th><th>Actions</th></tr></thead>
                <tbody>{onboardingRequests.filter(r=>r.status==='pending').map(r=>(
                  <tr key={r.id}>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{r.udi_di}</td>
                    <td style={{fontWeight:600}}>{r.device_name}</td>
                    <td>{r.manufacturer_id}</td>
                    <td><span className="badge badge-blue">{r.device_category}</span></td>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{r.clearance_number||'—'}</td>
                    <td><span className={`badge ${r.gudid_verified?'badge-green':'badge-amber'}`}>{r.gudid_verified?'✓ Verified':'Unverified'}</span></td>
                    <td style={{fontSize:11}}>{r.submitted_by}</td>
                    <td>
                      <div style={{display:'flex',gap:6}}>
                        <button className="btn btn-success btn-sm" disabled={onboardBusy[r.id]}
                          onClick={()=>handleOnboardReview(r.id,'approve')}>
                          {onboardBusy[r.id]?<span className="spinner" style={{width:12,height:12}}/>:'✅ Approve'}
                        </button>
                        <button className="btn btn-danger btn-sm" disabled={onboardBusy[r.id]}
                          onClick={()=>{ const reason=window.prompt('Rejection reason:'); if(reason?.trim()) handleOnboardReview(r.id,'reject',reason.trim()); }}>
                          ✕ Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table></div>
          }
        </div>

        {onboardingRequests.filter(r=>r.status!=='pending').length>0 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">📁 Reviewed Onboarding Requests <span className="badge badge-blue" style={{marginLeft:8}}>{onboardingRequests.filter(r=>r.status!=='pending').length}</span></span>
            </div>
            <div className="table-wrap"><table>
              <thead><tr><th>UDI-DI</th><th>Device Name</th><th>Manufacturer</th><th>Clearance #</th><th>GUDID</th><th>Submitted By</th><th>Submitted</th><th>Reviewed</th><th>Status</th><th>Reject Reason</th></tr></thead>
              <tbody>{onboardingRequests.filter(r=>r.status!=='pending').map(r=>(
                <tr key={r.id}>
                  <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{r.udi_di}</td>
                  <td style={{fontWeight:600}}>{r.device_name}</td>
                  <td>{r.manufacturer_id}</td>
                  <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{r.clearance_number||'—'}</td>
                  <td><span className={`badge ${r.gudid_verified?'badge-green':'badge-amber'}`}>{r.gudid_verified?'✓':'—'}</span></td>
                  <td style={{fontSize:11}}>{r.submitted_by}</td>
                  <td style={{fontSize:11}}>{new Date(r.submitted_at).toLocaleDateString()}</td>
                  <td style={{fontSize:11}}>{r.reviewed_at?new Date(r.reviewed_at).toLocaleDateString():'—'}</td>
                  <td><span className={`badge ${r.status==='approved'?'badge-green':'badge-red'}`}>{r.status}</span></td>
                  <td style={{fontSize:11,color:'var(--accent-red)'}}>{r.reject_reason||'—'}</td>
                </tr>
              ))}</tbody>
            </table></div>
          </div>
        )}
      </>}

      {/* ══ CLEARANCES TAB ══ */}
      {tab==='clearances' && <>
        <div className="card">
          <div className="card-header">
            <span className="card-title">📋 Issue Regulatory Clearance</span>
            <span className="badge badge-cyan">510(k) · PMA · HDE · De Novo</span>
          </div>
          <form onSubmit={submitClearance}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:14}}>
              <div className="form-group"><label>Clearance Number</label>
                <input placeholder="e.g. K231234" value={clrForm.clearanceNumber}
                  onChange={e=>setC('clearanceNumber',e.target.value)} required />
              </div>
              <div className="form-group"><label>Medical Device</label>
                <select value={clrForm.udiDI} onChange={e=>setC('udiDI',e.target.value)} required>
                  <option value="">— Select device —</option>
                  {devices.map(d=><option key={d.udiDI} value={d.udiDI}>{d.deviceName} ({d.udiDI})</option>)}
                </select>
              </div>
              <div className="form-group"><label>Manufacturer</label>
                <select value={clrForm.manufacturerId} onChange={e=>setC('manufacturerId',e.target.value)} required>
                  <option value="">— Select —</option>
                  {manufacturers.map(m=><option key={m.username} value={m.username}>{m.username}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Clearance Type</label>
                <select value={clrForm.clearanceType} onChange={e=>setC('clearanceType',e.target.value)} required>
                  {CLEARANCE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group" style={{gridColumn:'1/-1'}}><label>Indications for Use</label>
                <input placeholder="e.g. Intended for total knee arthroplasty..."
                  value={clrForm.indicationsForUse} onChange={e=>setC('indicationsForUse',e.target.value)} required />
              </div>
              <div className="form-group"><label>Clearance Date</label>
                <input type="date" value={clrForm.clearanceDate} onChange={e=>setC('clearanceDate',e.target.value)} required />
              </div>
              <div className="form-group"><label>Expiry Date <span style={{fontSize:10,color:'var(--text-muted)'}}>optional</span></label>
                <input type="date" value={clrForm.expiryDate} onChange={e=>setC('expiryDate',e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary"
              disabled={busy||!clrForm.udiDI||!clrForm.manufacturerId||!clrForm.clearanceNumber}>
              {busy?<><span className="spinner" style={{width:14,height:14}}/> Submitting…</>:'+ Issue Clearance'}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Regulatory Clearances <span className="badge badge-cyan">{clearances.length}</span></span>
            <button className="btn btn-ghost btn-sm" onClick={refresh}>↻ Refresh</button>
          </div>
          <div style={{display:'flex',gap:8,marginBottom:12}}>
            <input placeholder="🔍 Search..." value={clearanceSearch} onChange={e=>setClearanceSearch(e.target.value)} style={{flex:1,maxWidth:380}}/>
            {clearanceSearch && <button className="btn btn-ghost btn-sm" onClick={()=>setClearanceSearch('')}>✕ Clear</button>}
          </div>
          {loading ? <div className="loading-overlay"><span className="spinner"/></div>
          : <div className="table-wrap"><table>
              <thead><tr><th>Clearance #</th><th>Device</th><th>Manufacturer</th><th>Type</th><th>Indications</th><th>Date</th><th>Expiry</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{filteredClearances.map(c=>(
                <tr key={c.clearanceNumber}>
                  <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{c.clearanceNumber}</td>
                  <td style={{fontSize:11}}>{c.udiDI}</td>
                  <td>{c.manufacturerId}</td>
                  <td><span className="badge badge-blue">{c.clearanceType}</span></td>
                  <td style={{fontSize:11,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={c.indicationsForUse}>{c.indicationsForUse}</td>
                  <td style={{fontSize:11}}>{c.clearanceDate}</td>
                  <td style={{fontSize:11}}>{c.expiryDate||'No expiry'}</td>
                  <td>{statusBadge(c.status)}</td>
                  <td>{c.status==='active' && <button className="btn btn-danger btn-sm" onClick={()=>openModal('revoke-clearance',c.clearanceNumber)}>✕ Revoke</button>}</td>
                </tr>
              ))}</tbody>
            </table></div>
          }
        </div>
      </>}

      {/* ══ ISO 13485 TAB ══ */}
      {tab==='iso13485' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">ISO 13485 Certificates <span className="badge badge-green">{isos.length}</span></span>
            <button className="btn btn-ghost btn-sm" onClick={refresh}>↻ Refresh</button>
          </div>
          {loading ? <div className="loading-overlay"><span className="spinner"/></div>
          : isos.length===0 ? <div className="empty-state"><div className="icon">🏭</div><p>No certificates uploaded yet</p></div>
          : <div className="table-wrap"><table>
              <thead><tr><th>Cert ID</th><th>Manufacturer</th><th>Facility</th><th>Cert Body</th><th>Issue Date</th><th>Expiry</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{isos.map(i=>(
                <tr key={i.certId}>
                  <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{i.certId}</td>
                  <td>{i.manufacturerId}</td>
                  <td>{i.facilityName}</td>
                  <td style={{fontSize:11}}>{i.certBody}</td>
                  <td style={{fontSize:11}}>{i.issueDate}</td>
                  <td style={{fontSize:11,color:i.expiryDate<today?'var(--accent-red)':'inherit'}}>{i.expiryDate}</td>
                  <td>
                    {i.status==='revoked' ? <span className="badge badge-red">Revoked</span>
                    : i.expiryDate<today ? <span className="badge badge-amber">Expired</span>
                    : <span className="badge badge-green">Active</span>}
                  </td>
                  <td>{i.status!=='revoked' && <button className="btn btn-danger btn-sm" onClick={()=>openModal('revoke-iso',i.certId)}>✕ Revoke</button>}</td>
                </tr>
              ))}</tbody>
            </table></div>
          }
        </div>
      )}

      {/* ══ LOTS TAB ══ */}
      {tab==='lots' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Device Lots <span className="badge badge-purple">{lots.length}</span></span>
            <button className="btn btn-ghost btn-sm" onClick={refresh}>↻ Refresh</button>
          </div>
          <div style={{display:'flex',gap:8,marginBottom:12}}>
            <input placeholder="🔍 Search lots..." value={lotSearch} onChange={e=>setLotSearch(e.target.value)} style={{flex:1,maxWidth:380}}/>
            {lotSearch && <button className="btn btn-ghost btn-sm" onClick={()=>setLotSearch('')}>✕ Clear</button>}
          </div>
          {loading ? <div className="loading-overlay"><span className="spinner"/></div>
          : <div className="table-wrap"><table>
              <thead><tr><th>Lot ID</th><th>Device</th><th>Lot #</th><th>Manufacturer</th><th>Qty</th><th>Remaining</th><th>Mfr Date</th><th>Expiry</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{filteredLots.map(l=>(
                <tr key={l.lotId}>
                  <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{l.lotId}</td>
                  <td><div style={{fontWeight:600,fontSize:12}}>{l.deviceName}</div><div style={{fontSize:10,color:'var(--text-muted)'}}>{l.udiDI}</div></td>
                  <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{l.lotNumber}</td>
                  <td style={{fontSize:12}}>{l.manufacturerId}</td>
                  <td>{l.quantity}</td>
                  <td style={{color:l.remainingQuantity===0?'var(--text-muted)':'var(--accent-green)'}}>{l.remainingQuantity}</td>
                  <td style={{fontSize:11}}>{l.manufacturingDate}</td>
                  <td style={{fontSize:11,color:l.expiryDate<today?'var(--accent-red)':'inherit'}}>{l.expiryDate}</td>
                  <td>{statusBadge(l.status)}</td>
                  <td>
                    {l.status==='active' && <button className="btn btn-danger btn-sm" onClick={()=>openModal('recall-lot',l.lotId)}>⚠ Recall</button>}
                    {l.status==='recalled' && <span style={{fontSize:11,color:'var(--accent-red)',fontWeight:600}}>Class {l.recallClass}</span>}
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          }
        </div>
      )}

      {/* ══ ANALYTICS TAB ══ */}
      {tab==='analytics' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">📊 Surgical Analytics <span className="badge badge-blue" style={{marginLeft:8}}>{implants.length} records</span></span>
            <button className="btn btn-ghost btn-sm" onClick={loadAnalytics}>↻ Refresh</button>
          </div>

          <div style={{background:'rgba(139,92,246,0.06)',border:'1px solid rgba(139,92,246,0.2)',borderRadius:'var(--radius-md)',padding:'14px 16px',marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:600,color:'var(--accent-purple)',marginBottom:8}}>🤖 Natural Language Query</div>
            <div style={{display:'flex',gap:8}}>
              <input value={nlQuery} onChange={e=>setNlQuery(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&runNLQuery()}
                placeholder="e.g. show me all cardiac implants at Memorial Hospital this year"
                style={{flex:1,background:'var(--bg-secondary)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'8px 12px',fontSize:13,color:'var(--text-primary)'}}/>
              <button className="btn btn-ghost btn-sm"
                style={{color:'var(--accent-purple)',borderColor:'var(--accent-purple)',whiteSpace:'nowrap'}}
                disabled={nlBusy||!nlQuery.trim()} onClick={runNLQuery}>
                {nlBusy?<><span className="spinner" style={{width:12,height:12}}/> Querying…</>:'🔍 Run Query'}
              </button>
              {nlResult && <button className="btn btn-ghost btn-sm" onClick={()=>{setNlResult(null);setNlFilters(null);setNlQuery('');}}>✕ Clear</button>}
            </div>
            {nlError && <div style={{marginTop:8,fontSize:12,color:'var(--accent-red)'}}>⚠ {nlError}</div>}
            {nlResult && (
              <div style={{marginTop:10,padding:'10px 12px',background:'rgba(139,92,246,0.06)',borderRadius:'var(--radius-sm)',border:'1px solid rgba(139,92,246,0.15)'}}>
                <div style={{fontSize:12,color:'var(--accent-purple)',fontWeight:600}}>✓ {nlResult.explanation}</div>
                <div style={{fontSize:12,color:'var(--text-secondary)'}}>Found <strong>{nlResult.count}</strong> records</div>
              </div>
            )}
          </div>

          <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap'}}>
            <select value={hospitalFilter} onChange={e=>setHospitalFilter(e.target.value)} style={{minWidth:220}}>
              <option value="">All Hospitals</option>
              {[...new Set(implants.map(i=>i.hospitalId))].sort().map(h=><option key={h} value={h}>{h}</option>)}
            </select>
            <select value={surgeonFilter} onChange={e=>setSurgeonFilter(e.target.value)} style={{minWidth:180}}>
              <option value="">All Surgeons</option>
              {[...new Set(implants.map(i=>i.surgeonId).filter(Boolean))].sort().map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {analyticsLoading
            ? <div className="loading-overlay"><span className="spinner"/></div>
            : implants.length===0
              ? <div className="empty-state"><div className="icon">📊</div><p>No implant records — click Refresh</p></div>
              : (() => {
                  const filtered = (nlResult ? nlResult.records : implants)
                    .filter(i=>(!hospitalFilter||i.hospitalId===hospitalFilter)&&(!surgeonFilter||i.surgeonId===surgeonFilter))
                    .sort((a,b)=>(a.hospitalId||'').localeCompare(b.hospitalId||'')||(a.deviceCategory||'').localeCompare(b.deviceCategory||''));
                  let lastHosp=null, lastCat=null;
                  return (
                    <div className="table-wrap"><table>
                      <thead><tr><th>Implant ID</th><th>Device</th><th>Category</th><th>Procedure</th><th>Body Location</th><th>Surgeon</th><th>Hospital</th><th>Date</th><th>Status</th></tr></thead>
                      <tbody>{filtered.map(i=>{
                        const cat=CC[i.deviceCategory]||{bg:'transparent',border:'transparent',badge:'badge-blue',label:i.deviceCategory};
                        const newHosp=i.hospitalId!==lastHosp, newCat=newHosp||i.deviceCategory!==lastCat;
                        lastHosp=i.hospitalId; lastCat=i.deviceCategory;
                        return (<>
                          {newHosp && <tr key={'h'+i.hospitalId+i.implantId}><td colSpan={9} style={{padding:'10px 14px',background:'var(--bg-secondary)',borderTop:'2px solid var(--border)',fontSize:13,fontWeight:700}}>🏥 {i.hospitalId}</td></tr>}
                          {newCat  && <tr key={'c'+i.hospitalId+i.deviceCategory+i.implantId}><td colSpan={9} style={{padding:'6px 14px 6px 24px',background:cat.border,fontSize:11,fontWeight:700,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'0.08em',fontFamily:'var(--font-mono)'}}>{cat.label}</td></tr>}
                          <tr key={i.implantId} style={{background:cat.bg}}>
                            <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{i.implantId}</td>
                            <td><div style={{fontWeight:600,fontSize:12}}>{i.deviceName}</div><div style={{fontSize:10,color:'var(--text-muted)'}}>{i.lotNumber}</div></td>
                            <td><span className={`badge ${cat.badge}`}>{(i.deviceCategory||'').replace(/_/g,' ')}</span></td>
                            <td style={{fontSize:11}}>{i.procedureType}</td>
                            <td style={{fontSize:11}}>{i.bodyLocation}</td>
                            <td style={{fontSize:12,fontWeight:500}}>{i.surgeonId||'—'}</td>
                            <td style={{fontSize:11}}>🏥 {i.hospitalId}</td>
                            <td style={{fontSize:11}}>{i.procedureDate}</td>
                            <td><span className={`badge ${i.status==='implanted'?'badge-green':i.status==='explanted'?'badge-amber':'badge-red'}`}>{i.status}</span></td>
                          </tr>
                        </>);
                      })}</tbody>
                    </table></div>
                  );
                })()
          }
        </div>
      )}

      {/* ══ MDR DEADLINES TAB ══ */}
      {tab==='mdr' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              ⏰ MDR 30-Day Deadline Tracker — All Facilities
              {mdrData.summary?.overdue>0 && <span className="badge badge-red" style={{marginLeft:8}}>{mdrData.summary.overdue} overdue</span>}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={loadMDRData}>
              {mdrLoading?<span className="spinner" style={{width:12,height:12}}/>:'↻ Refresh'}
            </button>
          </div>
          <div className="alert alert-info" style={{marginBottom:12,fontSize:12}}>
            ℹ FDA 21 CFR Part 803 — facilities must report within <strong>30 days</strong> of device-related malfunction, serious injury, or death.
          </div>

          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:16}}>
            <div style={{padding:'12px 16px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'var(--radius-md)',textAlign:'center'}}>
              <div style={{fontSize:24,fontWeight:700,color:'var(--accent-red)'}}>{mdrData.summary?.overdue||0}</div>
              <div style={{fontSize:11,color:'var(--text-secondary)',marginTop:2}}>Overdue</div>
            </div>
            <div style={{padding:'12px 16px',background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.3)',borderRadius:'var(--radius-md)',textAlign:'center'}}>
              <div style={{fontSize:24,fontWeight:700,color:'var(--accent-amber)'}}>{mdrData.summary?.critical||0}</div>
              <div style={{fontSize:11,color:'var(--text-secondary)',marginTop:2}}>Due ≤7 Days</div>
            </div>
            <div style={{padding:'12px 16px',background:'rgba(245,158,11,0.04)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:'var(--radius-md)',textAlign:'center'}}>
              <div style={{fontSize:24,fontWeight:700,color:'var(--accent-amber)'}}>{mdrData.summary?.warning||0}</div>
              <div style={{fontSize:11,color:'var(--text-secondary)',marginTop:2}}>Due ≤15 Days</div>
            </div>
            <div style={{padding:'12px 16px',background:'rgba(16,185,129,0.06)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:'var(--radius-md)',textAlign:'center'}}>
              <div style={{fontSize:24,fontWeight:700,color:'var(--accent-green)'}}>{mdrData.summary?.safe||0}</div>
              <div style={{fontSize:11,color:'var(--text-secondary)',marginTop:2}}>Safe</div>
            </div>
            <div style={{padding:'12px 16px',background:'var(--bg-secondary)',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',textAlign:'center'}}>
              <div style={{fontSize:24,fontWeight:700,color:'var(--text-muted)'}}>{mdrData.summary?.reported||0}</div>
              <div style={{fontSize:11,color:'var(--text-secondary)',marginTop:2}}>Reported ✓</div>
            </div>
          </div>

          {mdrLoading
            ? <div className="loading-overlay"><span className="spinner"/></div>
            : (mdrData.deadlines||[]).length===0
              ? <div className="empty-state"><div className="icon">✅</div><p>No open adverse events across all facilities</p></div>
              : <div className="table-wrap"><table>
                  <thead><tr>
                    <th>Urgency</th><th>Event ID</th><th>Device</th><th>Event Type</th>
                    <th>Event Date</th><th>Deadline</th><th>Days Remaining</th><th>Hospital</th><th>Reported</th>
                  </tr></thead>
                  <tbody>{(mdrData.deadlines||[]).map(e=>{
                    const badges={overdue:'badge-red',critical:'badge-red',warning:'badge-amber',safe:'badge-green',reported:'badge-blue'};
                    const labels={overdue:'🔴 Overdue',critical:'🟠 Critical',warning:'🟡 Warning',safe:'🟢 Safe',reported:'✓ Reported'};
                    return (
                      <tr key={e.eventId} style={{background:e.urgency==='overdue'?'rgba(239,68,68,0.04)':e.urgency==='critical'?'rgba(239,68,68,0.02)':'transparent'}}>
                        <td><span className={`badge ${badges[e.urgency]||'badge-blue'}`} style={{fontSize:10}}>{labels[e.urgency]||e.urgency}</span></td>
                        <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{e.eventId}</td>
                        <td style={{fontWeight:600,fontSize:12}}>{e.deviceName}</td>
                        <td><span className={`badge ${e.eventType==='death'?'badge-red':e.eventType==='serious_injury'?'badge-amber':'badge-blue'}`} style={{fontSize:10}}>{e.eventType?.replace(/_/g,' ')}</span></td>
                        <td style={{fontSize:11}}>{e.eventDate}</td>
                        <td style={{fontSize:11,fontWeight:600,color:e.urgency==='overdue'?'var(--accent-red)':e.urgency==='critical'?'var(--accent-amber)':'inherit'}}>{e.deadlineDate}</td>
                        <td style={{fontSize:12,fontWeight:700,color:e.daysRemaining<0?'var(--accent-red)':e.daysRemaining<7?'var(--accent-amber)':'var(--accent-green)'}}>
                          {e.reportedToFDA?'✓ Filed':e.daysRemaining<0?`${Math.abs(e.daysRemaining)}d overdue`:e.daysRemaining===0?'Due today!':`${e.daysRemaining}d left`}
                        </td>
                        <td style={{fontSize:11}}>🏥 {e.hospitalId}</td>
                        <td><span className={`badge ${e.reportedToFDA?'badge-green':'badge-red'}`}>{e.reportedToFDA?'✓ Yes':'✕ No'}</span></td>
                      </tr>
                    );
                  })}</tbody>
                </table></div>
          }
        </div>
      )}
    </>
  );
}
