import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import ExpiryAlertBanner from '../components/ExpiryAlertBanner';

const PURPOSE_LABELS = {
  procedure_support:    '🔪 Procedure Support',
  consignment_delivery: '📦 Consignment Delivery',
  training:             '📚 Training',
  check_in:             '👋 Check-In',
  other:                '📝 Other',
};

const VISIT_STATUS = {
  scheduled:  { badge:'badge-blue',  label:'📋 Scheduled',   bg:'rgba(59,130,246,0.06)',  border:'rgba(59,130,246,0.2)',  next:'checked_in',  nextLabel:'▶ Check In',  nextColor:'var(--accent-amber)' },
  checked_in: { badge:'badge-amber', label:'✅ Checked In',  bg:'rgba(245,158,11,0.06)', border:'rgba(245,158,11,0.25)', next:'completed',   nextLabel:'✓ Complete',  nextColor:'var(--accent-green)' },
  completed:  { badge:'badge-green', label:'✓ Completed',    bg:'rgba(16,185,129,0.04)', border:'rgba(16,185,129,0.2)',  next:null },
  cancelled:  { badge:'badge-red',   label:'✕ Cancelled',    bg:'rgba(239,68,68,0.04)',  border:'rgba(239,68,68,0.2)',   next:null },
};

export default function DistributorPage() {
  const { user } = useAuth();

  const [consignments, setConsignments] = useState([]);
  const [lots,         setLots]         = useState([]);
  const [practices,    setPractices]    = useState([]);
  const [tab,          setTab]          = useState('inventory');
  const [loading,      setLoading]      = useState(true);
  const [msg,          setMsg]          = useState(null);
  const [busy,         setBusy]         = useState(false);
  const [actionBusy,   setActionBusy]   = useState({});

  // Consignment modal
  const [modal,       setModal]      = useState(null);
  const [modalTarget, setModalTarget]= useState(null);
  const [modalReason, setModalReason]= useState('');
  const [modalQty,    setModalQty]   = useState('1');
  const [modalBusy,   setModalBusy]  = useState(false);
  const [modalMsg,    setModalMsg]   = useState(null);

  // Transfer modal
  const [transferModal, setTransferModal] = useState(null);
  const [transferForm,  setTransferForm]  = useState({ toPracticeId:'', newConsignmentId:'', newLocation:'', quantity:'', reason:'' });
  const [transferBusy,  setTransferBusy]  = useState(false);
  const [transferMsg,   setTransferMsg]   = useState(null);

  // Forecast
  const [forecastBusy,   setForecastBusy]   = useState(false);
  const [forecastResult, setForecastResult] = useState(null);
  const [forecastError,  setForecastError]  = useState('');

  // Visit Log
  const [visits,       setVisits]       = useState([]);
  const [visitsLoading,setVisitsLoading]= useState(false);
  const [showVisitForm,setShowVisitForm]= useState(false);
  const [visitBusy,    setVisitBusy]    = useState(false);
  const [visitMsg,     setVisitMsg]     = useState(null);
  const [visitFilter,  setVisitFilter]  = useState('upcoming'); // 'upcoming' | 'past' | 'all'
  const [visitForm,    setVisitForm]    = useState({
    practiceId:'', visitDate:'', visitTime:'', purpose:'', caseId:'', contactName:'', notes:'',
  });
  const setVF = (k,v) => setVisitForm(f=>({...f,[k]:v}));

  // Create consignment form
  const [form, setForm] = useState({ consignmentId:'', lotId:'', practiceId:'', quantity:'', location:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const today = new Date().toISOString().split('T')[0];
  const [consignmentSearch, setConsignmentSearch] = useState('');
  const [assignedPractices, setAssignedPractices] = useState([]);
  const [practiceLoaded,        setPracticeLoaded]         = useState(false);

  const generateVisitId = () => {
    const rep = (user?.username||'REP').substring(0,4).toUpperCase();
    return 'VIS-' + rep + '-' + Date.now().toString(36).toUpperCase();
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    api.getPracticesList().then(h=>setPractices(h||[])).catch(()=>{});
    try {
      const [c, l] = await Promise.allSettled([
        api.getConsignments({ repId: user?.username }),
        api.getLots(),
      ]);
      if (c.status==='fulfilled') setConsignments(c.value||[]);
      if (l.status==='fulfilled') setLots((l.value||[]).filter(l=>l.status==='active'&&l.remainingQuantity>0));
    } catch {}
    setLoading(false);
  }, [user]);

  const loadVisits = useCallback(async () => {
    setVisitsLoading(true);
    try { setVisits(await api.getRepVisits() || []); } catch {}
    setVisitsLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    if (user?.username) {
      api.getRepPractices(user.username)
        .then(h=>{ setAssignedPractices(h||[]); setPracticeLoaded(true); })
        .catch(()=>setPracticeLoaded(true));
    }
  }, [refresh, user]);

  useEffect(() => { if (tab==='visits') loadVisits(); }, [tab, loadVisits]);

  // ── Consignment actions ─────────────────────────────────────────
  const submitConsignment = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      await api.createConsignment(form);
      setMsg({ type:'success', text:'Consignment "'+form.consignmentId+'" created at "'+form.practiceId+'".' });
      setTimeout(()=>setMsg(null), 3000);
      setForm({ consignmentId:'', lotId:'', practiceId:'', quantity:'', location:'' });
      refresh();
    } catch (err) { setMsg({ type:'error', text:err.message }); }
    finally { setBusy(false); }
  };

  const openModal = (type, id) => { setModal(type); setModalTarget(id); setModalReason(''); setModalQty('1'); setModalMsg(null); };
  const closeModal = () => { setModal(null); setModalTarget(null); setModalMsg(null); };

  const openTransferModal = (id) => {
    setTransferModal(id);
    setTransferForm({ toPracticeId:'', newConsignmentId:id+'-TRF-'+Date.now().toString().slice(-4), newLocation:'', quantity:'', reason:'' });
    setTransferMsg(null);
  };
  const closeTransferModal = () => { setTransferModal(null); setTransferMsg(null); };

  const handleTransfer = async () => {
    const { toPracticeId, newConsignmentId, newLocation, quantity, reason } = transferForm;
    if (!toPracticeId||!newConsignmentId||!newLocation||!quantity||!reason) return;
    setTransferBusy(true); setTransferMsg(null);
    try {
      await api.returnConsignment(transferModal, { toPracticeId, newConsignmentId, newLocation, quantity:parseInt(quantity), reason });
      setMsg({ type:'success', text:quantity+' unit(s) transferred to '+toPracticeId+'.' });
      setTimeout(()=>setMsg(null), 3000);
      closeTransferModal(); refresh();
    } catch (err) { setTransferMsg({ type:'error', text:err.message }); }
    finally { setTransferBusy(false); }
  };

  const handleRecall = async () => {
    if (!modalReason.trim()) return;
    setModalBusy(true); setModalMsg(null);
    try {
      await api.recallConsignment(modalTarget, { reason:modalReason });
      setMsg({ type:'success', text:'Consignment "'+modalTarget+'" recalled.' });
      setTimeout(()=>setMsg(null), 3000);
      closeModal(); refresh();
    } catch (err) { setModalMsg({ type:'error', text:err.message }); }
    finally { setModalBusy(false); }
  };

  const handleReturn = async () => {
    if (!modalReason.trim()||!modalQty) return;
    setModalBusy(true); setModalMsg(null);
    try {
      await api.returnConsignment(modalTarget, { quantity:parseInt(modalQty), reason:modalReason });
      setMsg({ type:'success', text:modalQty+' unit(s) returned from "'+modalTarget+'".' });
      setTimeout(()=>setMsg(null), 3000);
      closeModal(); refresh();
    } catch (err) { setModalMsg({ type:'error', text:err.message }); }
    finally { setModalBusy(false); }
  };

  // ── Visit actions ───────────────────────────────────────────────
  const submitVisit = async (e) => {
    e.preventDefault(); setVisitBusy(true); setVisitMsg(null);
    try {
      await api.createRepVisit({ visitId:generateVisitId(), ...visitForm });
      setVisitMsg({ type:'success', text:'Visit scheduled at '+visitForm.practiceId+'.' });
      setTimeout(()=>setVisitMsg(null), 3000);
      setShowVisitForm(false);
      setVisitForm({ practiceId:'', visitDate:'', visitTime:'', purpose:'', caseId:'', contactName:'', notes:'' });
      loadVisits();
    } catch (err) { setVisitMsg({ type:'error', text:err.message }); }
    finally { setVisitBusy(false); }
  };

  const updateVisitStatus = async (visitId, status) => {
    try { await api.updateRepVisitStatus(visitId, status); loadVisits(); }
    catch (err) { setVisitMsg({ type:'error', text:err.message }); }
  };

  // ── Forecast ────────────────────────────────────────────────────
  const runForecast = async () => {
    const active = consignments.filter(c=>c.status==='active');
    if (!active.length) return;
    setForecastBusy(true); setForecastError(''); setForecastResult(null);
    const now = new Date();
    const usageData = active.map(c => {
      const created = c.createdAt ? new Date(c.createdAt) : null;
      const daysSince = created ? Math.max(1,Math.floor((now-created)/86400000)) : null;
      const used = (c.usedQuantity||0)+(c.openedNotUsed||0);
      const avail = c.quantity-used-(c.returnedQuantity||0);
      const dailyRate = daysSince ? (used/daysSince) : null;
      const daysLeft = dailyRate > 0 ? Math.floor(avail/dailyRate) : null;
      return { consignmentId:c.consignmentId, device:c.deviceName, deviceCategory:c.deviceCategory,
        practice:c.practiceId, totalQty:c.quantity, usedQty:used, availableQty:avail,
        dailyUsageRate:dailyRate?parseFloat(dailyRate.toFixed(3)):0,
        estimatedDaysRemaining:daysLeft, expiryDate:c.expiryDate,
        stockPct:c.quantity>0?Math.round((avail/c.quantity)*100):0 };
    });
    try {
      const resp = await fetch('/api/ai/complete', { method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ maxTokens:2000, prompt:`Medical device supply forecast. Return ONLY JSON array. Today: ${now.toISOString().split('T')[0]}\nData: ${JSON.stringify(usageData)}\n[{"consignmentId":"...","urgency":"critical|warning|ok|no_usage","projectedDepletionDate":"YYYY-MM-DD or null","daysUntilDepletion":null,"recommendation":"...","reorderQty":null,"insight":"..."}]` }) });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error||'AI failed');
      const text = (data.text||'').replace(/```json|```/g,'').trim();
      const forecasts = JSON.parse(text.slice(text.indexOf('['),text.lastIndexOf(']')+1));
      const order = {critical:0,warning:1,ok:2,no_usage:3};
      setForecastResult(forecasts.map(f=>({...f,...usageData.find(u=>u.consignmentId===f.consignmentId)}))
        .sort((a,b)=>(order[a.urgency]??4)-(order[b.urgency]??4)));
    } catch (err) { setForecastError('Forecast failed: '+err.message); }
    finally { setForecastBusy(false); }
  };

  // ── Derived ─────────────────────────────────────────────────────
  const selectedLot = lots.find(l=>l.lotId===form.lotId);
  const getAvailable = c => c.quantity-(c.usedQuantity||0)-(c.openedNotUsed||0)-(c.returnedQuantity||0);
  const activeCount   = consignments.filter(c=>c.status==='active').length;
  const depletedCount = consignments.filter(c=>c.status==='depleted').length;
  const recalledCount = consignments.filter(c=>c.status==='recalled').length;
  const returnedCount = consignments.filter(c=>c.status==='returned').length;
  const totalUnits    = consignments.filter(c=>c.status==='active').reduce((s,c)=>s+getAvailable(c),0);

  const filteredConsignments = consignments.filter(c => {
    if (!consignmentSearch.trim()) return true;
    const q = consignmentSearch.toLowerCase();
    return (c.consignmentId||'').toLowerCase().includes(q)||(c.deviceName||'').toLowerCase().includes(q)||
           (c.practiceId||'').toLowerCase().includes(q)||(c.location||'').toLowerCase().includes(q);
  });
  const byPractice = filteredConsignments.reduce((acc,c)=>{ if(!acc[c.practiceId]) acc[c.practiceId]=[]; acc[c.practiceId].push(c); return acc; },{});

  const filteredVisits = visits.filter(v => {
    if (visitFilter==='upcoming') return v.status==='scheduled'||v.status==='checked_in';
    if (visitFilter==='past')     return v.status==='completed'||v.status==='cancelled';
    return true;
  });

  const upcomingCount = visits.filter(v=>v.status==='scheduled'||v.status==='checked_in').length;

  const tabStyle = t => ({
    padding:'8px 16px', borderRadius:'var(--radius-sm)', cursor:'pointer',
    fontSize:13, fontWeight:600, border:'none',
    background: tab===t ? 'var(--accent-blue)' : 'transparent',
    color: tab===t ? '#fff' : 'var(--text-secondary)',
  });

  const statusBadge = s => {
    const m = {active:'badge-green',depleted:'badge-blue',recalled:'badge-red',returned:'badge-amber'};
    return <span className={'badge '+(m[s]||'badge-blue')}>{s}</span>;
  };

  const CC = {
    cardiac:         {bg:'rgba(59,130,246,0.06)',border:'rgba(59,130,246,0.15)',badge:'badge-blue',   label:'🫀 Cardiac'},
    general_surgery: {bg:'rgba(16,185,129,0.06)',border:'rgba(16,185,129,0.15)',badge:'badge-green',  label:'🟢 General Surgery'},
    neurosurgery:    {bg:'rgba(139,92,246,0.06)',border:'rgba(139,92,246,0.15)',badge:'badge-purple', label:'🧠 Neurosurgery'},
    orthopedic:      {bg:'rgba(245,158,11,0.06)',border:'rgba(245,158,11,0.15)',badge:'badge-amber',  label:'🦴 Orthopedic'},
  };

  const allowedPractices = assignedPractices.length>0 ? practices.filter(h=>assignedPractices.includes(h.name)) : practices;

  return (
    <>
      <div className="page-header">
        <h2>🚚 Distributor / Rep Portal</h2>
        <p>Manage consignment inventory across practice accounts</p>
      </div>

      <ExpiryAlertBanner />

      {recalledCount>0 && (
        <div className="alert alert-error" style={{marginBottom:12}}>
          ⚠ <strong>{recalledCount} recalled consignment{recalledCount>1?'s':''}</strong> — contact affected practices immediately.
        </div>
      )}
      {msg && <div className={'alert alert-'+msg.type} style={{marginBottom:12}}>{msg.type==='error'?'⚠':'✓'} {msg.text}</div>}

      {/* Transfer Modal */}
      {transferModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={closeTransferModal}>
          <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:28,width:460}} onClick={e=>e.stopPropagation()}>
            <h3 style={{marginBottom:4}}>🏥 Emergency Transfer — {transferModal}</h3>
            <p style={{fontSize:12,color:'var(--text-secondary)',marginBottom:16}}>Move this consignment to another practice in your territory.</p>
            {transferMsg && <div className={'alert alert-'+transferMsg.type} style={{marginBottom:12}}>⚠ {transferMsg.text}</div>}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div className="form-group" style={{marginBottom:0,gridColumn:'span 2'}}>
                <label>Destination Practice</label>
                <input list="transfer-hosp-list" placeholder="Type or select practice..." value={transferForm.toPracticeId} onChange={e=>setTransferForm(f=>({...f,toPracticeId:e.target.value}))}/>
                <datalist id="transfer-hosp-list">{allowedPractices.map(h=><option key={h.id} value={h.name}/>)}</datalist>
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label>Units to Transfer</label>
                <input type="number" min="1" placeholder="e.g. 3" value={transferForm.quantity} onChange={e=>setTransferForm(f=>({...f,quantity:e.target.value}))}/>
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label>New Consignment ID</label>
                <input value={transferForm.newConsignmentId} onChange={e=>setTransferForm(f=>({...f,newConsignmentId:e.target.value}))} style={{fontFamily:'var(--font-mono)',fontSize:12}}/>
              </div>
            </div>
            <div className="form-group" style={{marginBottom:12}}>
              <label>Storage Location at Destination</label>
              <input placeholder="e.g. OR Supply Room A" value={transferForm.newLocation} onChange={e=>setTransferForm(f=>({...f,newLocation:e.target.value}))}/>
            </div>
            <div className="form-group" style={{marginBottom:16}}>
              <label>Reason for Transfer</label>
              <input placeholder="e.g. Emergency shortage" value={transferForm.reason} onChange={e=>setTransferForm(f=>({...f,reason:e.target.value}))}/>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-primary" style={{flex:1,background:'var(--accent-purple)'}}
                disabled={transferBusy||!transferForm.toPracticeId||!transferForm.quantity||!transferForm.newLocation||!transferForm.reason}
                onClick={handleTransfer}>
                {transferBusy?<><span className="spinner" style={{width:14,height:14}}/> Transferring…</>:'🏥 Confirm Transfer'}
              </button>
              <button className="btn btn-ghost" onClick={closeTransferModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Recall/Return Modal */}
      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={closeModal}>
          <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:28,width:420}} onClick={e=>e.stopPropagation()}>
            <h3 style={{marginBottom:8}}>{modal==='recall'?'⚠ Recall Consignment':'↩ Return Consignment'}</h3>
            <p style={{fontSize:12,color:'var(--text-secondary)',marginBottom:16}}>
              {modal==='recall'?'Mark consignment "'+modalTarget+'" as recalled.':'Return unused devices from "'+modalTarget+'".'}
            </p>
            {modalMsg && <div className={'alert alert-'+modalMsg.type} style={{marginBottom:12}}>{modalMsg.text}</div>}
            {modal==='return' && <div className="form-group" style={{marginBottom:12}}><label>Quantity to return</label><input type="number" min="1" value={modalQty} onChange={e=>setModalQty(e.target.value)}/></div>}
            <div className="form-group" style={{marginBottom:16}}>
              <label>Reason</label>
              <input placeholder={modal==='recall'?'e.g. Lot recalled by manufacturer':'e.g. End of consignment period'} value={modalReason} onChange={e=>setModalReason(e.target.value)}/>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className={'btn '+(modal==='recall'?'btn-danger':'btn-primary')} style={{flex:1}} disabled={modalBusy||!modalReason.trim()} onClick={modal==='recall'?handleRecall:handleReturn}>
                {modalBusy?<><span className="spinner" style={{width:14,height:14}}/> …</>:modal==='recall'?'⚠ Confirm Recall':'↩ Confirm Return'}
              </button>
              <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="kpi-grid" style={{gridTemplateColumns:'repeat(5,1fr)',marginBottom:16}}>
        {[{label:'Active',value:activeCount,color:'green'},{label:'Available Units',value:totalUnits,color:'blue'},
          {label:'Depleted',value:depletedCount,color:'cyan'},{label:'Returned',value:returnedCount,color:'amber'},
          {label:'Recalled',value:recalledCount,color:'red'}].map(({label,value,color})=>(
          <div key={label} className={'kpi-card '+color}>
            <div className="kpi-label">{label}</div>
            <div className="kpi-value" style={{color:'var(--accent-'+color+')'}}>{loading?'—':value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {practiceLoaded && assignedPractices.length>0 && (
        <div className="alert alert-info" style={{marginBottom:12,fontSize:12}}>
          🏥 <strong>Your territory:</strong> {assignedPractices.join(' · ')} — consignments restricted to these practices.
        </div>
      )}
      {practiceLoaded && assignedPractices.length===0 && (
        <div className="alert alert-amber" style={{marginBottom:12,fontSize:12}}>
          ⚠ <strong>No practices assigned yet.</strong> Contact admin to assign your territory.
        </div>
      )}

      {/* Tab bar */}
      <div style={{display:'flex',gap:4,marginBottom:20,background:'var(--bg-card)',padding:4,borderRadius:'var(--radius-md)',width:'fit-content',border:'1px solid var(--border)'}}>
        <button style={tabStyle('inventory')} onClick={()=>setTab('inventory')}>📦 Inventory</button>
        <button style={tabStyle('forecast')}  onClick={()=>setTab('forecast')}>📈 Forecast</button>
        <button style={tabStyle('visits')} onClick={()=>setTab('visits')}>
          📋 Visit Log
          {upcomingCount>0 && <span className="badge badge-amber" style={{marginLeft:6}}>{upcomingCount}</span>}
        </button>
      </div>

      {/* ══ INVENTORY TAB ══ */}
      {tab==='inventory' && <>
        <div className="card">
          <div className="card-header">
            <span className="card-title">📦 Create Consignment</span>
            <span className="badge badge-cyan">Rep-owned inventory placed at practice</span>
          </div>
          <form onSubmit={submitConsignment}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:16,marginBottom:14}}>
              <div className="form-group" style={{gridColumn:'span 2'}}>
                <label>Consignment ID</label>
                <input placeholder="e.g. CONS-MEM-2024-001" value={form.consignmentId} onChange={e=>set('consignmentId',e.target.value)} required style={{fontFamily:'var(--font-mono)'}}/>
              </div>
              <div className="form-group" style={{gridColumn:'span 6'}}>
                <label>Device Lot</label>
                <select value={form.lotId} onChange={e=>set('lotId',e.target.value)} required>
                  <option value="">— Select active lot —</option>
                  {lots.map(l=><option key={l.lotId} value={l.lotId}>{l.lotId} — {l.deviceName} · Lot# {l.lotNumber} (avail: {l.remainingQuantity})</option>)}
                </select>
                {selectedLot && <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>Expiry: {selectedLot.expiryDate} · Sterile: {selectedLot.sterileExpiryDate} · {selectedLot.storageConditions}</div>}
              </div>
              <div className="form-group" style={{gridColumn:'span 2'}}>
                <label>Quantity</label>
                <input type="number" min="1" max={selectedLot?.remainingQuantity||9999} placeholder="e.g. 20" value={form.quantity} onChange={e=>set('quantity',e.target.value)} required/>
              </div>
              <div className="form-group" style={{gridColumn:'span 5'}}>
                <label>Practice</label>
                <input list="practice-list" value={form.practiceId} onChange={e=>set('practiceId',e.target.value)} placeholder="Type or select practice..." required/>
                <datalist id="practice-list">{allowedPractices.map(h=><option key={h.id} value={h.name}/>)}</datalist>
              </div>
              <div className="form-group" style={{gridColumn:'span 5'}}>
                <label>Storage Location</label>
                <input placeholder="e.g. OR Supply Room B, Orthopedic Tray 3" value={form.location} onChange={e=>set('location',e.target.value)} required/>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy||!form.lotId||!form.practiceId||!form.quantity||!form.location}>
              {busy?<><span className="spinner" style={{width:14,height:14}}/> Creating…</>:'+ Create Consignment'}
            </button>
          </form>
        </div>

        {consignments.length>0 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">🏥 Inventory by Practice</span>
              <button className="btn btn-ghost btn-sm" onClick={refresh}>↻ Refresh</button>
            </div>
            <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center'}}>
              <input placeholder="🔍 Search consignment, device, practice, lot..." value={consignmentSearch} onChange={e=>setConsignmentSearch(e.target.value)} style={{flex:1,maxWidth:400}}/>
              {consignmentSearch && <><button className="btn btn-ghost btn-sm" onClick={()=>setConsignmentSearch('')}>✕ Clear</button><span style={{fontSize:12,color:'var(--text-muted)'}}>{filteredConsignments.length} of {consignments.length}</span></>}
            </div>
            {Object.entries(byPractice).map(([practice,items])=>{
              const activeItems=items.filter(c=>c.status==='active');
              const totalAvail=activeItems.reduce((s,c)=>s+getAvailable(c),0);
              return (
                <div key={practice} style={{marginBottom:24}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                    <span style={{fontSize:15,fontWeight:700}}>🏥 {practice}</span>
                    <span className="badge badge-blue">{activeItems.length} active</span>
                    <span style={{fontSize:12,color:'var(--accent-green)',fontWeight:600}}>{totalAvail} units available</span>
                  </div>
                  <div className="table-wrap"><table>
                    <thead><tr><th>Consignment ID</th><th>Device</th><th>Lot #</th><th>Location</th><th>Total</th><th>Used</th><th>Available</th><th>Expiry</th><th>Sterile Expiry</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>{(()=>{
                      const sorted=[...items].sort((a,b)=>(a.deviceCategory||'').localeCompare(b.deviceCategory||'')||(a.deviceName||'').localeCompare(b.deviceName||''));
                      let lastCat=null;
                      return sorted.map(c=>{
                        const avail=getAvailable(c), pct=c.quantity>0?Math.round((avail/c.quantity)*100):0;
                        const cat=CC[c.deviceCategory]||{bg:'transparent',border:'transparent',badge:'badge-blue',label:c.deviceCategory};
                        const newCat=c.deviceCategory!==lastCat; lastCat=c.deviceCategory;
                        return (
                          <>
                            {newCat&&<tr key={'cat-'+practice+c.deviceCategory}><td colSpan={11} style={{padding:'6px 12px',background:cat.border,borderTop:'2px solid '+cat.border,fontSize:11,fontWeight:700,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'0.08em',fontFamily:'var(--font-mono)'}}>{cat.label}</td></tr>}
                            <tr key={c.consignmentId} style={{opacity:c.status==='recalled'?0.65:1,background:cat.bg}}>
                              <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{c.consignmentId}</td>
                              <td><div style={{fontWeight:600,fontSize:12}}>{c.deviceName}</div><div style={{fontSize:10,color:'var(--text-muted)'}}>{(c.deviceCategory||'').replace(/_/g,' ')} · {c.deviceType}</div></td>
                              <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{c.lotNumber}</td>
                              <td style={{fontSize:11}}>{c.location}</td>
                              <td>{c.quantity}</td>
                              <td style={{color:'var(--accent-amber)'}}>{c.usedQuantity||0}</td>
                              <td>
                                <div style={{display:'flex',alignItems:'center',gap:6}}>
                                  <span style={{fontWeight:600,color:pct>20?'var(--accent-green)':avail>0?'var(--accent-amber)':'var(--text-muted)'}}>{avail}</span>
                                  <div style={{width:40,height:4,background:'var(--border)',borderRadius:2,overflow:'hidden'}}><div style={{width:pct+'%',height:'100%',background:pct>20?'var(--accent-green)':'var(--accent-amber)',borderRadius:2}}/></div>
                                </div>
                              </td>
                              <td style={{fontSize:11,color:c.expiryDate<today?'var(--accent-red)':'inherit'}}>{c.expiryDate}</td>
                              <td style={{fontSize:11,color:c.sterileExpiryDate<today?'var(--accent-red)':'inherit'}}>{c.sterileExpiryDate}</td>
                              <td>{statusBadge(c.status)}</td>
                              <td><div style={{display:'flex',gap:4}}>
                                {c.status==='active'&&avail>0&&<button className="btn btn-ghost btn-sm" onClick={()=>openModal('return',c.consignmentId)}>↩ Return</button>}
                                {c.status==='active'&&avail>0&&<button className="btn btn-ghost btn-sm" style={{color:'var(--accent-purple)',borderColor:'var(--accent-purple)'}} onClick={()=>openTransferModal(c.consignmentId)}>🔀 Transfer</button>}
                                {c.status==='active'&&<button className="btn btn-danger btn-sm" disabled={actionBusy[c.consignmentId]} onClick={()=>openModal('recall',c.consignmentId)}>⚠ Recall</button>}
                              </div></td>
                            </tr>
                          </>
                        );
                      });
                    })()}</tbody>
                  </table></div>
                </div>
              );
            })}
            {loading&&<div className="loading-overlay"><span className="spinner"/></div>}
            {!loading&&consignments.length===0&&<div className="empty-state"><div className="icon">📦</div><p>No consignments yet</p></div>}
          </div>
        )}
      </>}

      {/* ══ FORECAST TAB ══ */}
      {tab==='forecast' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">📈 Supply Forecast</span>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              {forecastResult&&<span style={{fontSize:12,color:'var(--text-muted)'}}>{forecastResult.filter(f=>f.urgency==='critical').length} critical · {forecastResult.filter(f=>f.urgency==='warning').length} warnings</span>}
              <button className="btn btn-ghost btn-sm" style={{color:'var(--accent-purple)',borderColor:'var(--accent-purple)'}} disabled={forecastBusy||!consignments.filter(c=>c.status==='active').length} onClick={runForecast}>
                {forecastBusy?<><span className="spinner" style={{width:12,height:12}}/> Forecasting…</>:'🤖 Run Forecast'}
              </button>
              {forecastResult&&<button className="btn btn-ghost btn-sm" onClick={()=>setForecastResult(null)}>✕ Clear</button>}
            </div>
          </div>
          <p style={{fontSize:12,color:'var(--text-secondary)',marginBottom:forecastResult?12:0}}>AI analyzes usage rates and predicts depletion dates with reorder recommendations.</p>
          {forecastError&&<div className="alert alert-error" style={{marginTop:8}}>⚠ {forecastError}</div>}
          {forecastResult&&(
            <div className="table-wrap"><table>
              <thead><tr><th>Status</th><th>Consignment</th><th>Device</th><th>Practice</th><th>Available</th><th>Daily Rate</th><th>Est. Depletion</th><th>Recommendation</th><th>Reorder Qty</th></tr></thead>
              <tbody>{forecastResult.map(f=>{
                const us={critical:{bg:'rgba(239,68,68,0.05)',badge:'badge-red',icon:'🔴'},warning:{bg:'rgba(245,158,11,0.05)',badge:'badge-amber',icon:'🟡'},ok:{bg:'rgba(16,185,129,0.04)',badge:'badge-green',icon:'🟢'},no_usage:{bg:'rgba(100,116,139,0.04)',badge:'badge-blue',icon:'⚪'}}[f.urgency]||{bg:'transparent',badge:'badge-blue',icon:'—'};
                return (<tr key={f.consignmentId} style={{background:us.bg}}>
                  <td><span className={'badge '+us.badge}>{us.icon} {f.urgency?.replace('_',' ')}</span></td>
                  <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{f.consignmentId}</td>
                  <td><div style={{fontWeight:600,fontSize:12}}>{f.device}</div><div style={{fontSize:10,color:'var(--text-muted)'}}>{(f.deviceCategory||'').replace(/_/g,' ')}</div></td>
                  <td style={{fontSize:11}}>🏥 {f.practice}</td>
                  <td><span style={{fontWeight:600,color:f.urgency==='critical'?'var(--accent-red)':f.urgency==='warning'?'var(--accent-amber)':'var(--accent-green)'}}>{f.availableQty}</span> <span style={{fontSize:10,color:'var(--text-muted)'}}>/ {f.totalQty} ({f.stockPct}%)</span></td>
                  <td style={{fontSize:11}}>{f.dailyUsageRate>0?f.dailyUsageRate+' units/day':'No usage'}</td>
                  <td style={{fontSize:11}}>{f.projectedDepletionDate?<><strong style={{color:f.urgency==='critical'?'var(--accent-red)':f.urgency==='warning'?'var(--accent-amber)':'inherit'}}>{f.projectedDepletionDate}</strong> <span style={{color:'var(--text-muted)'}}>({f.daysUntilDepletion}d)</span></>:'—'}</td>
                  <td style={{fontSize:11,maxWidth:200}}><div>{f.recommendation}</div>{f.insight&&<div style={{fontSize:10,color:'var(--text-muted)',fontStyle:'italic'}}>{f.insight}</div>}</td>
                  <td>{f.reorderQty?<span style={{fontWeight:600,color:'var(--accent-cyan)'}}>{f.reorderQty} units</span>:'—'}</td>
                </tr>);
              })}</tbody>
            </table></div>
          )}
          {!forecastResult&&!forecastBusy&&<div className="empty-state" style={{padding:'24px 0'}}><div className="icon">📈</div><p>Click <strong>🤖 Run Forecast</strong> to analyze usage rates</p></div>}
          {forecastBusy&&<div style={{display:'flex',alignItems:'center',gap:12,padding:'24px 0',justifyContent:'center',color:'var(--text-muted)'}}><span className="spinner" style={{width:20,height:20}}/><span>Analyzing {consignments.filter(c=>c.status==='active').length} active consignments…</span></div>}
        </div>
      )}

      {/* ══ VISIT LOG TAB ══ */}
      {tab==='visits' && (
        <>
          {visitMsg && <div className={'alert alert-'+visitMsg.type} style={{marginBottom:12}}>{visitMsg.type==='error'?'⚠':'✓'} {visitMsg.text}</div>}

          {/* Create visit form */}
          {showVisitForm && (
            <div className="card" style={{marginBottom:16,borderColor:'rgba(59,130,246,0.3)'}}>
              <div className="card-header">
                <span className="card-title">📋 Schedule Visit</span>
                <button className="btn btn-ghost btn-sm" onClick={()=>setShowVisitForm(false)}>✕ Cancel</button>
              </div>
              <form onSubmit={submitVisit}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:12,marginBottom:12}}>
                  <div className="form-group" style={{marginBottom:0,gridColumn:'span 2'}}>
                    <label>Practice</label>
                    <input list="visit-hosp-list" placeholder="Select practice..." value={visitForm.practiceId} onChange={e=>setVF('practiceId',e.target.value)} required/>
                    <datalist id="visit-hosp-list">{allowedPractices.map(h=><option key={h.id} value={h.name}/>)}</datalist>
                  </div>
                  <div className="form-group" style={{marginBottom:0}}>
                    <label>Visit Date</label>
                    <input type="date" value={visitForm.visitDate} onChange={e=>setVF('visitDate',e.target.value)} required/>
                  </div>
                  <div className="form-group" style={{marginBottom:0}}>
                    <label>Time <span style={{fontSize:10,color:'var(--text-muted)'}}>optional</span></label>
                    <input type="time" value={visitForm.visitTime} onChange={e=>setVF('visitTime',e.target.value)}/>
                  </div>
                  <div className="form-group" style={{marginBottom:0,gridColumn:'span 2'}}>
                    <label>Purpose</label>
                    <select value={visitForm.purpose} onChange={e=>setVF('purpose',e.target.value)} required>
                      <option value="">— Select purpose —</option>
                      {Object.entries(PURPOSE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{marginBottom:0,gridColumn:'span 2'}}>
                    <label>Practice Contact <span style={{fontSize:10,color:'var(--text-muted)'}}>optional</span></label>
                    <input placeholder="e.g. OR Coordinator name" value={visitForm.contactName} onChange={e=>setVF('contactName',e.target.value)}/>
                  </div>
                  <div className="form-group" style={{marginBottom:0,gridColumn:'span 2'}}>
                    <label>Linked Case ID <span style={{fontSize:10,color:'var(--text-muted)'}}>optional</span></label>
                    <input placeholder="e.g. CASE-MEM-ABC123" value={visitForm.caseId} onChange={e=>setVF('caseId',e.target.value)} style={{fontFamily:'var(--font-mono)'}}/>
                  </div>
                  <div className="form-group" style={{marginBottom:0,gridColumn:'span 2'}}>
                    <label>Notes <span style={{fontSize:10,color:'var(--text-muted)'}}>optional</span></label>
                    <input placeholder="Any additional notes..." value={visitForm.notes} onChange={e=>setVF('notes',e.target.value)}/>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" disabled={visitBusy||!visitForm.practiceId||!visitForm.visitDate||!visitForm.purpose}>
                  {visitBusy?<><span className="spinner" style={{width:14,height:14}}/> Scheduling…</>:'📋 Schedule Visit'}
                </button>
              </form>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <span className="card-title">
                📋 Visit Log
                <span className="badge badge-blue" style={{marginLeft:8}}>{visits.length}</span>
              </span>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-ghost btn-sm" onClick={loadVisits}>↻ Refresh</button>
                {!showVisitForm && <button className="btn btn-primary btn-sm" style={{background:'var(--accent-blue)'}} onClick={()=>setShowVisitForm(true)}>+ Schedule Visit</button>}
              </div>
            </div>

            {/* Compliance info */}
            <div className="alert alert-info" style={{marginBottom:12,fontSize:12}}>
              ℹ Two-step check-in required for compliance: <strong>Schedule → Check In on arrival → Complete after visit</strong>. Each step is timestamped for audit trail.
            </div>

            {/* Filter tabs */}
            <div style={{display:'flex',gap:4,marginBottom:12}}>
              {[['upcoming','Upcoming'],['past','Past'],['all','All']].map(([v,l])=>(
                <button key={v} onClick={()=>setVisitFilter(v)}
                  style={{padding:'4px 12px',borderRadius:'var(--radius-sm)',fontSize:12,fontWeight:600,cursor:'pointer',border:'1px solid var(--border)',
                    background:visitFilter===v?'var(--accent-blue)':'transparent',
                    color:visitFilter===v?'#fff':'var(--text-secondary)'}}>
                  {l} {v==='upcoming'&&upcomingCount>0?'('+upcomingCount+')':''}
                </button>
              ))}
            </div>

            {visitsLoading
              ? <div className="loading-overlay"><span className="spinner"/></div>
              : filteredVisits.length===0
                ? <div className="empty-state"><div className="icon">📋</div>
                    <p>{visitFilter==='upcoming'?'No upcoming visits scheduled':'No visits found'}</p>
                    <button className="btn btn-primary" style={{marginTop:12}} onClick={()=>setShowVisitForm(true)}>+ Schedule First Visit</button>
                  </div>
                : <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    {filteredVisits.map(v=>{
                      const sc = VISIT_STATUS[v.status]||VISIT_STATUS.scheduled;
                      return (
                        <div key={v.visit_id} style={{padding:'14px 18px',background:sc.bg,borderRadius:'var(--radius-md)',border:'1px solid '+sc.border}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                            <div style={{flex:1}}>
                              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                                <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-muted)'}}>{v.visit_id}</span>
                                <span className={'badge '+sc.badge} style={{fontSize:10}}>{sc.label}</span>
                                <span style={{fontSize:12,color:'var(--text-secondary)'}}>📅 {v.visit_date}</span>
                                {v.visit_time && <span style={{fontSize:12,color:'var(--text-secondary)'}}>🕐 {v.visit_time}</span>}
                              </div>
                              <div style={{display:'flex',gap:16,flexWrap:'wrap',fontSize:13}}>
                                <span style={{fontWeight:700}}>🏥 {v.practice_id}</span>
                                <span style={{color:'var(--text-secondary)'}}>{PURPOSE_LABELS[v.purpose]||v.purpose}</span>
                                {v.contact_name && <span style={{color:'var(--text-muted)'}}>Contact: {v.contact_name}</span>}
                                {v.case_id && <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--accent-blue)'}}>Case: {v.case_id}</span>}
                              </div>
                              {v.notes && <div style={{fontSize:12,color:'var(--text-muted)',marginTop:4,fontStyle:'italic'}}>{v.notes}</div>}
                              {/* Timestamps */}
                              <div style={{display:'flex',gap:16,marginTop:6,fontSize:11,color:'var(--text-muted)'}}>
                                <span>Scheduled: {new Date(v.created_at).toLocaleDateString()}</span>
                                {v.checked_in_at && <span style={{color:'var(--accent-amber)'}}>✅ Checked in: {new Date(v.checked_in_at).toLocaleString()}</span>}
                                {v.completed_at  && <span style={{color:'var(--accent-green)'}}>✓ Completed: {new Date(v.completed_at).toLocaleString()}</span>}
                              </div>
                            </div>
                            {/* Action buttons */}
                            <div style={{display:'flex',gap:6,flexShrink:0,marginLeft:16}}>
                              {sc.next && (
                                <button className="btn btn-primary btn-sm"
                                  style={{background:sc.nextColor,whiteSpace:'nowrap'}}
                                  onClick={()=>updateVisitStatus(v.visit_id, sc.next)}>
                                  {sc.nextLabel}
                                </button>
                              )}
                              {(v.status==='scheduled'||v.status==='checked_in') && (
                                <button className="btn btn-ghost btn-sm" style={{color:'var(--accent-red)',borderColor:'var(--accent-red)'}}
                                  onClick={()=>{ if(window.confirm('Cancel this visit?')) updateVisitStatus(v.visit_id,'cancelled'); }}>
                                  ✕ Cancel
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
            }
          </div>
        </>
      )}
    </>
  );
}
