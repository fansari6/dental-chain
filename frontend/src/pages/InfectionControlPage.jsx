import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function InfectionPrevPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('recall');

  // Recalled lots
  const [recalledLots,    setRecalledLots]    = useState([]);
  const [lotsLoading,     setLotsLoading]     = useState(false);

  // Recall query
  const [lotSearch,       setLotSearch]       = useState('');
  const [lotResults,      setLotResults]      = useState([]);
  const [activeOnly,      setActiveOnly]      = useState(true);
  const [lotLoading,      setLotLoading]      = useState(false);
  const [lotMsg,          setLotMsg]          = useState(null);

  // Notification state
  const [notifMethod,     setNotifMethod]     = useState('phone');
  const [notifNotes,      setNotifNotes]      = useState('');
  const [notifBusy,       setNotifBusy]       = useState(false);
  const [notifMsg,        setNotifMsg]        = useState(null);
  const [notifiedIds,     setNotifiedIds]     = useState(new Set());
  const [singleBusy,      setSingleBusy]      = useState({});

  // Notification history
  const [histLot,         setHistLot]         = useState('');
  const [notifications,   setNotifications]   = useState([]);
  const [histLoading,     setHistLoading]     = useState(false);
  const [histMsg,         setHistMsg]         = useState(null);

  // Patient query
  const [patientSearch,   setPatientSearch]   = useState('');
  const [patientResults,  setPatientResults]  = useState([]);
  const [patientLoading,  setPatientLoading]  = useState(false);
  const [patientMsg,      setPatientMsg]      = useState(null);

  // Adverse events
  const [adverseEvents,   setAdverseEvents]   = useState([]);
  const [adverseLoading,  setAdverseLoading]  = useState(false);
  const [adverseLoaded,   setAdverseLoaded]   = useState(false);

  // MDR Deadlines
  const [mdrDeadlines,    setMdrDeadlines]    = useState([]);
  const [mdrSummary,      setMdrSummary]      = useState({ overdue:0, critical:0, warning:0, safe:0, reported:0, total:0 });
  const [mdrLoading,      setMdrLoading]      = useState(false);
  const [mdrLoaded,       setMdrLoaded]       = useState(false);

  // MDR / AI
  const [mdrModal,        setMdrModal]        = useState(null);
  const [mdrBusy,         setMdrBusy]         = useState(false);
  const [mdrDraft,        setMdrDraft]        = useState('');
  const [recallAnalysis,  setRecallAnalysis]  = useState('');
  const [recallBusy,      setRecallBusy]      = useState(false);

  const isSystemLevel = !user?.practiceId;

  const NOTIF_METHODS = [
    { value:'phone',     label:'📞 Phone' },
    { value:'letter',    label:'✉ Letter' },
    { value:'email',     label:'📧 Email' },
    { value:'in_person', label:'🏥 In Person' },
    { value:'portal',    label:'💻 Portal' },
  ];

  const URGENCY = {
    overdue:  { badge:'badge-red',   bg:'rgba(239,68,68,0.06)',  label:'🔴 Overdue' },
    critical: { badge:'badge-red',   bg:'rgba(239,68,68,0.03)',  label:'🟠 Critical' },
    warning:  { badge:'badge-amber', bg:'rgba(245,158,11,0.04)', label:'🟡 Warning' },
    safe:     { badge:'badge-green', bg:'transparent',           label:'🟢 Safe' },
    reported: { badge:'badge-blue',  bg:'transparent',           label:'✓ Reported' },
  };

  // Auto-load recalled lots on mount
  const loadRecalledLots = useCallback(async () => {
    setLotsLoading(true);
    try {
      const lots = await api.getLots();
      setRecalledLots((Array.isArray(lots) ? lots : []).filter(l => l.status === 'recalled'));
    } catch { setRecalledLots([]); }
    finally { setLotsLoading(false); }
  }, []);

  useEffect(() => { loadRecalledLots(); }, [loadRecalledLots]);

  const loadMDRDeadlines = async () => {
    setMdrLoading(true);
    try {
      const data = await api.getMDRDeadlines();
      setMdrDeadlines(data?.deadlines || []);
      setMdrSummary(data?.summary || { overdue:0, critical:0, warning:0, safe:0, reported:0, total:0 });
      setMdrLoaded(true);
    } catch (err) { console.error(err); }
    finally { setMdrLoading(false); }
  };

  const selectRecalledLot = async (lot) => {
    setLotSearch(lot.lotNumber);
    setLotLoading(true); setLotMsg(null); setLotResults([]); setNotifMsg(null); setRecallAnalysis('');
    try {
      const results = activeOnly
        ? await api.getActiveImplantsByRecalledLot(lot.lotNumber)
        : await api.getPatientsByLot(lot.lotNumber);
      setLotResults(results || []);
      try {
        const existing = await api.getRecallNotifications(lot.lotNumber);
        setNotifiedIds(new Set((Array.isArray(existing) ? existing : []).map(n => n.implantId)));
      } catch { setNotifiedIds(new Set()); }
      setLotMsg({
        type: (results||[]).length > 0 ? 'error' : 'success',
        text: (results||[]).length > 0
          ? `⚠ ${results.length} patient${results.length>1?'s':''} with active implants from lot "${lot.lotNumber}"`
          : `✅ No active implants found for lot "${lot.lotNumber}"${user?.practiceId ? ` at ${user.practiceId}` : ''}`,
      });
    } catch (err) { setLotMsg({ type:'error', text: err.message }); }
    finally { setLotLoading(false); }
  };

  const searchByLot = async () => {
    if (!lotSearch.trim()) return;
    await selectRecalledLot({ lotNumber: lotSearch.trim() });
  };

  const notifyAll = async () => {
    const unnotified = lotResults.filter(r => !notifiedIds.has(r.implantId));
    if (!unnotified.length) return;
    setNotifBusy(true); setNotifMsg(null);
    try {
      const result = await api.bulkRecallNotification({
        lotNumber: lotSearch.trim(),
        notificationMethod: notifMethod,
        notes: notifNotes,
        implants: unnotified.map(r => ({ implantId: r.implantId, patientIdHash: r.patientIdHash||'', practiceId: r.practiceId })),
      });
      const succeeded = result.succeeded || 0;
      setNotifMsg({
        type: result.failed > 0 ? 'amber' : 'success',
        text: `✓ ${succeeded} notification${succeeded!==1?'s':''} recorded on blockchain${result.failed>0?` · ${result.failed} failed`:''}`,
      });
      const newIds = new Set(notifiedIds);
      (result.results||[]).filter(r=>r.status==='success').forEach(r=>newIds.add(r.implantId));
      setNotifiedIds(newIds);
    } catch (err) { setNotifMsg({ type:'error', text: err.message }); }
    finally { setNotifBusy(false); }
  };

  const notifySingle = async (implant) => {
    setSingleBusy(b=>({...b,[implant.implantId]:true}));
    try {
      const ts = Date.now().toString(36).toUpperCase();
      await api.recordRecallNotification({
        notificationId: `NOTIF-${implant.implantId}-${ts}`,
        lotNumber: lotSearch.trim(), implantId: implant.implantId,
        patientIdHash: implant.patientIdHash||'', practiceId: implant.practiceId,
        notificationMethod: notifMethod, notes: notifNotes,
      });
      setNotifiedIds(ids => { const s=new Set(ids); s.add(implant.implantId); return s; });
    } catch (err) { setNotifMsg({ type:'error', text: err.message }); }
    finally { setSingleBusy(b=>({...b,[implant.implantId]:false})); }
  };

  const loadNotificationHistory = async (lot) => {
    const target = (lot || histLot).trim();
    if (!target) return;
    setHistLoading(true); setHistMsg(null);
    try {
      const data = await api.getRecallNotifications(target);
      setNotifications(Array.isArray(data) ? data : []);
      setHistMsg({
        type: (data||[]).length > 0 ? 'success' : 'amber',
        text: (data||[]).length > 0
          ? `${data.length} notification${data.length!==1?'s':''} recorded for lot "${target}"`
          : `No notifications recorded for lot "${target}" yet`,
      });
      if (target !== histLot) setHistLot(target);
    } catch (err) { setHistMsg({ type:'error', text: err.message }); }
    finally { setHistLoading(false); }
  };

  const searchByPatient = async () => {
    if (!patientSearch.trim()) return;
    setPatientLoading(true); setPatientMsg(null); setPatientResults([]);
    try {
      const results = await api.getImplantsByPatient(patientSearch.trim());
      setPatientResults(results || []);
      setPatientMsg({
        type: (results||[]).length > 0 ? 'success' : 'amber',
        text: (results||[]).length > 0
          ? `Found ${results.length} implant record${results.length>1?'s':''} for "${patientSearch}"`
          : `No implant records found for "${patientSearch}"`,
      });
    } catch (err) { setPatientMsg({ type:'error', text: err.message }); }
    finally { setPatientLoading(false); }
  };

  const loadAdverseEvents = async () => {
    setAdverseLoading(true);
    try { setAdverseEvents((await api.getAdverseEvents()) || []); setAdverseLoaded(true); }
    catch { }
    finally { setAdverseLoading(false); }
  };

  const analyzeRecallImpact = async () => {
    if (!lotResults.length) return;
    setRecallBusy(true); setRecallAnalysis('');
    try {
      const summary = lotResults.map((r,i) => ({
        index:i+1, device:r.deviceName, category:r.deviceCategory,
        bodyLocation:r.bodyLocation, procedureDate:r.procedureDate,
        practice:r.practiceId, status:r.status||'implanted',
      }));
      const resp = await fetch('/api/ai/complete', {
        method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ prompt:`Analyze these ${lotResults.length} patients affected by device recall for lot ${lotSearch}. Provide risk stratification (HIGH/MEDIUM/LOW), notification timeline, clinical considerations, and action checklist for infection prevention team. Patients: ${JSON.stringify(summary)}`, maxTokens:1000 }),
      });
      const data = await resp.json();
      setRecallAnalysis(data.text || '');
    } catch (err) { setRecallAnalysis('Error: '+err.message); }
    finally { setRecallBusy(false); }
  };

  const draftMDR = async (event) => {
    setMdrModal(event); setMdrDraft(''); setMdrBusy(true);
    try {
      const resp = await fetch('/api/ai/complete', {
        method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ prompt:`Write ONLY the clinical narrative for Section B.5 of FDA Form 3500A. 150-250 words, factual, third person past tense. Device: ${event.deviceName}, Event: ${event.eventType}, Date: ${event.eventDate}, Practice: ${event.practiceId}. Description: ${event.description||'N/A'}`, maxTokens:400 }),
      });
      const data = await resp.json();
      setMdrDraft(data.text || '');
    } catch { setMdrDraft(''); }
    finally { setMdrBusy(false); }
  };

  const printMDR = async (event, narrative) => {
    try {
      const resp = await fetch('/api/ai/mdr-pdf', {
        method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ narrative, eventDate:event.eventDate, today:today(),
          deviceName:event.deviceName, lotNumber:event.lotNumber, practiceId:event.practiceId,
          eventId:event.eventId, eventType:event.eventType, reportedToFDA:event.reportedToFDA,
          implantId:event.implantId, description:event.description,
          manufacturerId:event.manufacturerId||'', udiDI:event.udiDI||'',
          serialNumber:event.serialNumber||'', expiryDate:event.expiryDate||'',
          procedureDate:event.procedureDate||'', modelNum:event.modelNum||'' }),
      });
      if (!resp.ok) throw new Error((await resp.json().catch(()=>({}))).error||'Failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const win = window.open(url,'_blank');
      if (!win) { const a=document.createElement('a'); a.href=url; a.download=`FDA-3500A-${event.eventId}.pdf`; a.click(); }
      setTimeout(()=>URL.revokeObjectURL(url),300000);
    } catch (err) { alert('PDF failed: '+err.message); }
  };

  const exportCSV = (data, filename) => {
    if (!data.length) return;
    const rows = data.map(obj => {
      const flat={};
      for (const [k,v] of Object.entries(obj)) flat[k]=typeof v==='object'&&v!==null?JSON.stringify(v):(v??'');
      return flat;
    });
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','),...rows.map(r=>headers.map(h=>`"${r[h]}"`).join(','))].join('\n');
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download=filename; a.click();
  };

  const renderAIText = (text) => {
    if (!text) return null;
    return text.split('\n').map((line,i) => {
      if (/^#{1,3}\s/.test(line)||(/^\*\*/.test(line)&&line.endsWith('**')))
        return <div key={i} style={{fontWeight:700,color:'var(--text-primary)',marginTop:12,marginBottom:4,fontSize:13}}>{line.replace(/^#{1,3}\s*/,'').replace(/\*\*/g,'')}</div>;
      if (/^[-*]\s/.test(line))
        return <div key={i} style={{paddingLeft:16,fontSize:12,color:'var(--text-secondary)',marginBottom:3,lineHeight:1.6}}>{'• '}{line.slice(2).replace(/\*\*/g,'')}</div>;
      if (line.trim()==='') return <div key={i} style={{height:6}}/>;
      return <div key={i} style={{fontSize:12,color:'var(--text-secondary)',marginBottom:3,lineHeight:1.6}}>{line.replace(/\*\*/g,'')}</div>;
    });
  };

  const tabStyle = t => ({
    padding:'8px 16px', borderRadius:'var(--radius-sm)', cursor:'pointer',
    fontSize:13, fontWeight:600, border:'none',
    background: tab===t ? 'var(--accent-red)' : 'transparent',
    color: tab===t ? '#fff' : 'var(--text-secondary)',
  });

  const unnotifiedCount = lotResults.filter(r=>!notifiedIds.has(r.implantId)).length;
  const RECALL_CLASS_COLORS = { 'Class I':'badge-red', 'Class II':'badge-amber', 'Class III':'badge-blue' };

  return (
    <>
      <div className="page-header">
        <h2>🔬 Infection Control Portal</h2>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <p>Recall response, patient notification, adverse event monitoring</p>
          <span className={`badge ${isSystemLevel?'badge-blue':'badge-purple'}`} style={{fontSize:11}}>
            {isSystemLevel ? '🌐 System Level' : `🏥 ${user?.practiceId}`}
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{display:'flex',gap:4,marginBottom:20,background:'var(--bg-card)',
        padding:4,borderRadius:'var(--radius-md)',width:'fit-content',
        border:'1px solid var(--border)',flexWrap:'wrap'}}>
        <button style={tabStyle('recall')} onClick={()=>setTab('recall')}>
          ⚠ Active Recalls
          {recalledLots.length>0 && <span className="badge badge-red" style={{marginLeft:6}}>{recalledLots.length}</span>}
        </button>
        <button style={tabStyle('notify')} onClick={()=>setTab('notify')}>📢 Notification History</button>
        <button style={tabStyle('mdr')} onClick={()=>{ setTab('mdr'); if(!mdrLoaded) loadMDRDeadlines(); }}>
          ⏰ MDR Deadlines
          {mdrSummary.overdue > 0 && <span className="badge badge-red" style={{marginLeft:6}}>{mdrSummary.overdue}</span>}
          {mdrSummary.overdue === 0 && mdrSummary.critical > 0 && <span className="badge badge-amber" style={{marginLeft:6}}>{mdrSummary.critical}</span>}
        </button>
        <button style={tabStyle('patient')} onClick={()=>setTab('patient')}>👤 Patient Lookup</button>
        <button style={tabStyle('adverse')} onClick={()=>{ setTab('adverse'); if(!adverseLoaded) loadAdverseEvents(); }}>
          📋 Adverse Events
          {adverseEvents.length>0 && <span className="badge badge-red" style={{marginLeft:6}}>{adverseEvents.length}</span>}
        </button>
      </div>

      {/* MDR Modal */}
      {mdrModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1000,
          display:'flex',alignItems:'center',justifyContent:'center',padding:24}}
          onClick={()=>{ if(!mdrBusy) setMdrModal(null); }}>
          <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',
            borderRadius:'var(--radius-lg)',padding:28,width:'min(520px,100%)'}}
            onClick={e=>e.stopPropagation()}>
            <h3 style={{marginBottom:4}}>🤖 AI MDR Draft — {mdrModal.eventId}</h3>
            <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:16}}>
              {mdrModal.deviceName} · {mdrModal.eventType?.replace(/_/g,' ')} · {mdrModal.eventDate}
            </div>
            {mdrBusy
              ? <div style={{display:'flex',alignItems:'center',gap:12,padding:'24px 0',color:'var(--text-muted)'}}>
                  <span className="spinner" style={{width:20,height:20}}/> Generating FDA 3500A narrative…
                </div>
              : <>
                  <div className="alert alert-info" style={{marginBottom:16,fontSize:12}}>
                    ℹ AI pre-fills known fields. Opens in new tab — complete then print or save as PDF.
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button className="btn btn-primary" style={{flex:1}} onClick={()=>printMDR(mdrModal,mdrDraft)}>
                      ⬇ Download Pre-filled FDA 3500A PDF
                    </button>
                    <button className="btn btn-ghost" onClick={()=>setMdrModal(null)}>Close</button>
                  </div>
                </>
            }
          </div>
        </div>
      )}

      {/* ══ ACTIVE RECALLS TAB ══ */}
      {tab==='recall' && (
        <>
          <div className="card" style={{marginBottom:16}}>
            <div className="card-header">
              <span className="card-title">
                ⚠ Active Recalled Lots
                {lotsLoading && <span className="spinner" style={{width:14,height:14,marginLeft:8}}/>}
              </span>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <label className="checkbox-group" style={{fontSize:12}}>
                  <input type="checkbox" checked={activeOnly} onChange={e=>setActiveOnly(e.target.checked)}/>
                  <span>Active implants only</span>
                </label>
                <button className="btn btn-ghost btn-sm" onClick={loadRecalledLots}>↻ Refresh</button>
              </div>
            </div>
            {recalledLots.length === 0 && !lotsLoading
              ? <div className="empty-state"><div className="icon">✅</div><p>No active recalls</p></div>
              : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
                  {recalledLots.map(lot => (
                    <div key={lot.lotId}
                      style={{padding:'14px 16px',background:'rgba(239,68,68,0.06)',
                        borderRadius:'var(--radius-md)',border:'1px solid rgba(239,68,68,0.25)',
                        cursor:'pointer',transition:'all 0.15s'}}
                      onClick={()=>selectRecalledLot(lot)}
                      onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(239,68,68,0.6)'}
                      onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(239,68,68,0.25)'}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                        <div style={{fontWeight:700,fontSize:13,color:'var(--text-primary)'}}>{lot.deviceName}</div>
                        <span className={`badge ${RECALL_CLASS_COLORS[lot.recallClass]||'badge-red'}`} style={{fontSize:10,flexShrink:0,marginLeft:8}}>
                          {lot.recallClass || 'Recalled'}
                        </span>
                      </div>
                      <div style={{fontSize:11,color:'var(--text-muted)',fontFamily:'var(--font-mono)',marginBottom:6}}>
                        {lot.lotNumber} · {lot.lotId}
                      </div>
                      <div style={{fontSize:11,color:'var(--text-secondary)',marginBottom:8}}>{lot.recallReason}</div>
                      <button className="btn btn-sm btn-primary" style={{background:'var(--accent-red)',width:'100%',fontSize:11}}>
                        🔍 View Affected Patients
                      </button>
                    </div>
                  ))}
                </div>
            }
          </div>

          <div className="card" style={{borderColor:'rgba(239,68,68,0.3)'}}>
            <div className="card-header">
              <span className="card-title">🔍 Search by Lot Number</span>
              <span className="badge badge-blue" style={{fontSize:11}}>Manual search · Any lot</span>
            </div>
            <div style={{display:'flex',gap:12,marginBottom:12,alignItems:'flex-end',flexWrap:'wrap'}}>
              <div className="form-group" style={{flex:1,marginBottom:0,minWidth:280}}>
                <label>Lot Number</label>
                <input placeholder="e.g. 2024STKH001A"
                  value={lotSearch} onChange={e=>setLotSearch(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&searchByLot()}
                  style={{fontFamily:'var(--font-mono)'}}/>
              </div>
              <button className="btn btn-primary" style={{background:'var(--accent-red)'}}
                onClick={searchByLot} disabled={lotLoading||!lotSearch.trim()}>
                {lotLoading ? <><span className="spinner" style={{width:14,height:14}}/> Searching…</> : '🔍 Find Affected Patients'}
              </button>
            </div>

            {lotMsg && <div className={`alert alert-${lotMsg.type}`} style={{marginBottom:12}}>{lotMsg.text}</div>}

            {lotResults.length > 0 && (
              <>
                <div style={{padding:'16px',background:'rgba(239,68,68,0.04)',
                  borderRadius:'var(--radius-md)',border:'1px solid rgba(239,68,68,0.2)',marginBottom:16}}>
                  <div style={{fontSize:13,fontWeight:700,color:'var(--accent-red)',marginBottom:12}}>
                    📢 Record Patient Notifications
                    <span style={{fontSize:12,fontWeight:400,color:'var(--text-secondary)',marginLeft:8}}>
                      {notifiedIds.size} of {lotResults.length} notified
                      {unnotifiedCount>0 && <span style={{color:'var(--accent-amber)',marginLeft:6}}>· {unnotifiedCount} pending</span>}
                    </span>
                  </div>
                  <div style={{display:'flex',gap:12,alignItems:'flex-end',flexWrap:'wrap'}}>
                    <div className="form-group" style={{marginBottom:0}}>
                      <label>Method</label>
                      <select value={notifMethod} onChange={e=>setNotifMethod(e.target.value)} style={{minWidth:160}}>
                        {NOTIF_METHODS.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{flex:1,marginBottom:0}}>
                      <label>Notes <span style={{fontSize:10,color:'var(--text-muted)'}}>optional</span></label>
                      <input placeholder="e.g. Voicemail left, callback requested"
                        value={notifNotes} onChange={e=>setNotifNotes(e.target.value)}/>
                    </div>
                    <button className="btn btn-primary" style={{background:'var(--accent-red)',whiteSpace:'nowrap'}}
                      disabled={notifBusy||unnotifiedCount===0} onClick={notifyAll}>
                      {notifBusy
                        ? <><span className="spinner" style={{width:14,height:14}}/> Recording…</>
                        : unnotifiedCount>0 ? `📢 Notify All (${unnotifiedCount} pending)` : '✓ All Notified'}
                    </button>
                  </div>
                  {notifMsg && <div className={`alert alert-${notifMsg.type}`} style={{marginTop:10,marginBottom:0}}>{notifMsg.text}</div>}
                </div>

                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <div style={{fontSize:13,fontWeight:600,color:'var(--accent-red)'}}>
                    {lotResults.length} patient{lotResults.length>1?'s':''} — {user?.practiceId||'all practices'}
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button className="btn btn-ghost btn-sm"
                      style={{color:'var(--accent-purple)',borderColor:'var(--accent-purple)'}}
                      disabled={recallBusy} onClick={analyzeRecallImpact}>
                      {recallBusy ? <><span className="spinner" style={{width:12,height:12}}/> Analyzing…</> : '🤖 Analyze Impact'}
                    </button>
                    <button className="btn btn-ghost btn-sm"
                      onClick={()=>exportCSV(lotResults,`recall-${lotSearch}-${today()}.csv`)}>↓ Export CSV</button>
                    <button className="btn btn-ghost btn-sm"
                      style={{color:'var(--accent-blue)',borderColor:'var(--accent-blue)'}}
                      onClick={()=>{ setTab('notify'); loadNotificationHistory(lotSearch); }}>
                      📋 View History
                    </button>
                  </div>
                </div>

                <div className="table-wrap"><table>
                  <thead><tr>
                    <th>Status</th><th>Patient ID</th><th>Implant ID</th><th>Device</th>
                    <th>Body Location</th><th>Date</th><th>Practice</th><th>Action</th>
                  </tr></thead>
                  <tbody>{lotResults.map((r,i)=>{
                    const notified = notifiedIds.has(r.implantId);
                    return (
                      <tr key={i} style={{background:notified?'rgba(16,185,129,0.04)':'rgba(239,68,68,0.04)'}}>
                        <td>{notified
                          ? <span className="badge badge-green" style={{fontSize:10}}>✓ Notified</span>
                          : <span className="badge badge-amber" style={{fontSize:10}}>⏳ Pending</span>}
                        </td>
                        <td style={{fontWeight:600,color:notified?'var(--text-secondary)':'var(--accent-red)'}}>{r.patientId}</td>
                        <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{r.implantId}</td>
                        <td>
                          <div style={{fontWeight:600,fontSize:12}}>{r.deviceName}</div>
                          <div style={{fontSize:10,color:'var(--text-muted)'}}>{r.udiDI}</div>
                        </td>
                        <td style={{fontSize:11}}>{r.bodyLocation}</td>
                        <td style={{fontSize:11}}>{r.procedureDate}</td>
                        <td style={{fontSize:11}}>🏥 {r.practiceId}</td>
                        <td>{!notified && (
                          <button className="btn btn-ghost btn-sm"
                            style={{color:'var(--accent-red)',borderColor:'var(--accent-red)',fontSize:11}}
                            disabled={!!singleBusy[r.implantId]} onClick={()=>notifySingle(r)}>
                            {singleBusy[r.implantId]?<span className="spinner" style={{width:12,height:12}}/>:'📢 Notify'}
                          </button>
                        )}</td>
                      </tr>
                    );
                  })}</tbody>
                </table></div>

                {(recallAnalysis||recallBusy) && (
                  <div style={{marginTop:16,padding:'16px',background:'rgba(139,92,246,0.06)',
                    borderRadius:'var(--radius-md)',border:'1px solid rgba(139,92,246,0.2)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                      <div style={{fontSize:13,fontWeight:700,color:'var(--accent-purple)'}}>🤖 AI Recall Impact Analysis</div>
                      {recallAnalysis && <button className="btn btn-ghost btn-sm" onClick={()=>navigator.clipboard.writeText(recallAnalysis)}>📋 Copy</button>}
                    </div>
                    {recallBusy
                      ? <div style={{display:'flex',alignItems:'center',gap:10,color:'var(--text-muted)',fontSize:12}}>
                          <span className="spinner" style={{width:16,height:16}}/> Analyzing patient risk…
                        </div>
                      : <div>{renderAIText(recallAnalysis)}</div>
                    }
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* ══ NOTIFICATION HISTORY TAB ══ */}
      {tab==='notify' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">📢 Recall Notification History</span>
            <span className="badge badge-blue">Immutable blockchain audit trail</span>
          </div>
          {recalledLots.length > 0 && (
            <div style={{marginBottom:20}}>
              <div style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',marginBottom:10,
                textTransform:'uppercase',letterSpacing:'0.06em'}}>
                Select a recalled lot
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {recalledLots.map(lot => (
                  <button key={lot.lotId}
                    className={`btn ${histLot===lot.lotNumber?'btn-primary':'btn-ghost'}`}
                    style={{fontSize:12,padding:'6px 14px'}}
                    onClick={()=>loadNotificationHistory(lot.lotNumber)}>
                    {lot.deviceName} — <span style={{fontFamily:'var(--font-mono)',fontSize:11}}>{lot.lotNumber}</span>
                    {histLot===lot.lotNumber && notifications.length>0 &&
                      <span className="badge badge-green" style={{marginLeft:6,fontSize:10}}>{notifications.length}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{display:'flex',gap:12,marginBottom:12,alignItems:'flex-end'}}>
            <div className="form-group" style={{flex:1,marginBottom:0}}>
              <label>Lot Number</label>
              <input placeholder="e.g. 2024STKH001A" value={histLot}
                onChange={e=>setHistLot(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&loadNotificationHistory()}
                style={{fontFamily:'var(--font-mono)'}}/>
            </div>
            <button className="btn btn-primary" onClick={()=>loadNotificationHistory()}
              disabled={histLoading||!histLot.trim()}>
              {histLoading?<><span className="spinner" style={{width:14,height:14}}/> Loading…</>:'🔍 Load'}
            </button>
          </div>
          {histMsg && <div className={`alert alert-${histMsg.type}`} style={{marginBottom:12}}>{histMsg.text}</div>}
          {notifications.length > 0 && (
            <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:600}}>{notifications.length} notification{notifications.length!==1?'s':''} recorded</div>
                <button className="btn btn-ghost btn-sm"
                  onClick={()=>exportCSV(notifications,`notifications-${histLot}-${today()}.csv`)}>
                  ↓ Export CSV
                </button>
              </div>
              <div className="table-wrap"><table>
                <thead><tr>
                  <th>Notification ID</th><th>Implant ID</th><th>Method</th>
                  <th>Notified By</th><th>Practice</th><th>Notes</th><th>Timestamp</th>
                </tr></thead>
                <tbody>{notifications.map((n,i)=>(
                  <tr key={i}>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{n.notificationId}</td>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{n.implantId}</td>
                    <td><span className="badge badge-blue" style={{fontSize:10}}>
                      {NOTIF_METHODS.find(m=>m.value===n.notificationMethod)?.label||n.notificationMethod}
                    </span></td>
                    <td style={{fontSize:12}}>{n.notifiedBy||n.recordedBy}</td>
                    <td style={{fontSize:11}}>🏥 {n.practiceId}</td>
                    <td style={{fontSize:11,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={n.notes}>{n.notes||'—'}</td>
                    <td style={{fontSize:11}}>{n.timestamp?new Date(n.timestamp).toLocaleString():n.txTime||'—'}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            </>
          )}
        </div>
      )}

      {/* ══ MDR 30-DAY DEADLINE TRACKER TAB ══ */}
      {tab==='mdr' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              ⏰ MDR 30-Day Deadline Tracker
              {mdrSummary.overdue > 0 && <span className="badge badge-red" style={{marginLeft:8}}>{mdrSummary.overdue} overdue</span>}
              {mdrSummary.critical > 0 && <span className="badge badge-amber" style={{marginLeft:6}}>{mdrSummary.critical} critical</span>}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={loadMDRDeadlines}>
              {mdrLoading ? <span className="spinner" style={{width:12,height:12}}/> : '↻ Refresh'}
            </button>
          </div>
          <div className="alert alert-info" style={{marginBottom:12,fontSize:12}}>
            ℹ FDA 21 CFR Part 803 — mandatory reporting within <strong>30 days</strong> of
            device-related malfunction, serious injury, or death.
            {user?.practiceId && <span style={{marginLeft:8,color:'var(--accent-purple)'}}>Showing: 🏥 {user.practiceId}</span>}
          </div>

          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:16}}>
            <div style={{padding:'12px 16px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'var(--radius-md)',textAlign:'center'}}>
              <div style={{fontSize:24,fontWeight:700,color:'var(--accent-red)'}}>{mdrSummary.overdue}</div>
              <div style={{fontSize:11,color:'var(--text-secondary)',marginTop:2}}>Overdue</div>
            </div>
            <div style={{padding:'12px 16px',background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.3)',borderRadius:'var(--radius-md)',textAlign:'center'}}>
              <div style={{fontSize:24,fontWeight:700,color:'var(--accent-amber)'}}>{mdrSummary.critical}</div>
              <div style={{fontSize:11,color:'var(--text-secondary)',marginTop:2}}>Due ≤7 Days</div>
            </div>
            <div style={{padding:'12px 16px',background:'rgba(245,158,11,0.04)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:'var(--radius-md)',textAlign:'center'}}>
              <div style={{fontSize:24,fontWeight:700,color:'var(--accent-amber)'}}>{mdrSummary.warning}</div>
              <div style={{fontSize:11,color:'var(--text-secondary)',marginTop:2}}>Due ≤15 Days</div>
            </div>
            <div style={{padding:'12px 16px',background:'rgba(16,185,129,0.06)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:'var(--radius-md)',textAlign:'center'}}>
              <div style={{fontSize:24,fontWeight:700,color:'var(--accent-green)'}}>{mdrSummary.safe}</div>
              <div style={{fontSize:11,color:'var(--text-secondary)',marginTop:2}}>Safe</div>
            </div>
            <div style={{padding:'12px 16px',background:'var(--bg-secondary)',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',textAlign:'center'}}>
              <div style={{fontSize:24,fontWeight:700,color:'var(--text-muted)'}}>{mdrSummary.reported}</div>
              <div style={{fontSize:11,color:'var(--text-secondary)',marginTop:2}}>Reported ✓</div>
            </div>
          </div>

          {mdrLoading
            ? <div className="loading-overlay"><span className="spinner"/></div>
            : !mdrLoaded
              ? <div className="empty-state"><div className="icon">⏰</div><p>Click Refresh to load MDR deadlines</p></div>
              : mdrDeadlines.length === 0
                ? <div className="empty-state"><div className="icon">✅</div><p>No open adverse events — record an adverse event via Nurse Portal to test</p></div>
                : <div className="table-wrap"><table>
                    <thead><tr>
                      <th>Urgency</th><th>Event ID</th><th>Implant ID</th><th>Device</th>
                      <th>Event Type</th><th>Event Date</th><th>Deadline</th>
                      <th>Days Remaining</th><th>Practice</th><th>Actions</th>
                    </tr></thead>
                    <tbody>{mdrDeadlines.map(e=>{
                      const uc = URGENCY[e.urgency] || { badge:'badge-blue', bg:'transparent', label:e.urgency };
                      return (
                        <tr key={e.eventId} style={{background:uc.bg}}>
                          <td><span className={`badge ${uc.badge}`} style={{fontSize:10}}>{uc.label}</span></td>
                          <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{e.eventId}</td>
                          <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{e.implantId}</td>
                          <td style={{fontWeight:600,fontSize:12}}>{e.deviceName}</td>
                          <td>
                            <span className={`badge ${e.eventType==='death'?'badge-red':e.eventType==='serious_injury'?'badge-amber':'badge-blue'}`} style={{fontSize:10}}>
                              {e.eventType?.replace(/_/g,' ')}
                            </span>
                          </td>
                          <td style={{fontSize:11}}>{e.eventDate}</td>
                          <td style={{fontSize:11,fontWeight:600,
                            color:e.urgency==='overdue'?'var(--accent-red)':e.urgency==='critical'?'var(--accent-amber)':'inherit'}}>
                            {e.deadlineDate}
                          </td>
                          <td style={{fontSize:12,fontWeight:700,
                            color:e.daysRemaining<0?'var(--accent-red)':e.daysRemaining<7?'var(--accent-amber)':'var(--accent-green)'}}>
                            {e.reportedToFDA ? '✓ Filed'
                              : e.daysRemaining < 0 ? `${Math.abs(e.daysRemaining)}d overdue`
                              : e.daysRemaining === 0 ? 'Due today!'
                              : `${e.daysRemaining}d left`}
                          </td>
                          <td style={{fontSize:11}}>🏥 {e.practiceId}</td>
                          <td>
                            {!e.reportedToFDA && (
                              <button className="btn btn-ghost btn-sm"
                                style={{color:'var(--accent-purple)',borderColor:'var(--accent-purple)',fontSize:11,whiteSpace:'nowrap'}}
                                onClick={()=>draftMDR(e)}>
                                🤖 Draft MDR
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}</tbody>
                  </table></div>
          }
        </div>
      )}

      {/* ══ PATIENT LOOKUP TAB ══ */}
      {tab==='patient' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">👤 Patient Implant History</span>
            <span className="badge badge-blue">All implants for a single patient</span>
          </div>
          <div style={{display:'flex',gap:12,marginBottom:12,alignItems:'flex-end'}}>
            <div className="form-group" style={{flex:1,marginBottom:0}}>
              <label>Patient MRN</label>
              <input placeholder="e.g. MRN-123456" value={patientSearch}
                onChange={e=>setPatientSearch(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&searchByPatient()}/>
            </div>
            <button className="btn btn-primary" onClick={searchByPatient}
              disabled={patientLoading||!patientSearch.trim()}>
              {patientLoading?<><span className="spinner" style={{width:14,height:14}}/> Searching…</>:'🔍 Search'}
            </button>
          </div>
          {patientMsg && <div className={`alert alert-${patientMsg.type}`} style={{marginBottom:12}}>{patientMsg.text}</div>}
          {patientResults.length > 0 && (
            <>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                <span style={{fontSize:13,fontWeight:600}}>{patientResults.length} implant record{patientResults.length>1?'s':''}</span>
                <button className="btn btn-ghost btn-sm"
                  onClick={()=>exportCSV(patientResults,`patient-${patientSearch}-implants.csv`)}>↓ Export CSV</button>
              </div>
              <div className="table-wrap"><table>
                <thead><tr><th>Implant ID</th><th>Device</th><th>Category</th><th>Lot #</th><th>Procedure</th><th>Body Location</th><th>Date</th><th>Practice</th><th>Status</th></tr></thead>
                <tbody>{patientResults.map(i=>(
                  <tr key={i.implantId}>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{i.implantId}</td>
                    <td><div style={{fontWeight:600,fontSize:12}}>{i.deviceName}</div><div style={{fontSize:10,color:'var(--text-muted)'}}>{i.udiDI}</div></td>
                    <td><span className="badge badge-blue">{i.deviceCategory}</span></td>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{i.lotNumber}</td>
                    <td style={{fontSize:11}}>{i.procedureType}</td>
                    <td style={{fontSize:11}}>{i.bodyLocation}</td>
                    <td style={{fontSize:11}}>{i.procedureDate}</td>
                    <td style={{fontSize:11}}>🏥 {i.practiceId}</td>
                    <td><span className={`badge ${i.status==='implanted'?'badge-green':i.status==='explanted'?'badge-amber':'badge-red'}`}>{i.status}</span></td>
                  </tr>
                ))}</tbody>
              </table></div>
            </>
          )}
        </div>
      )}

      {/* ══ ADVERSE EVENTS TAB ══ */}
      {tab==='adverse' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              📋 Adverse Events (MDR)
              {adverseEvents.length>0 && <span className="badge badge-red" style={{marginLeft:8}}>{adverseEvents.length}</span>}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={loadAdverseEvents}>↻ Refresh</button>
          </div>
          <p style={{fontSize:12,color:'var(--text-secondary)',marginBottom:16}}>
            Device-related adverse events for {user?.practiceId||'all practices'}. Class I/II must be reported within 30 days (21 CFR Part 803).
          </p>
          {adverseLoading
            ? <div className="loading-overlay"><span className="spinner"/></div>
            : !adverseLoaded
              ? <div className="empty-state"><div className="icon">📋</div><p>Click Refresh to load adverse events</p></div>
              : adverseEvents.length===0
                ? <div className="empty-state"><div className="icon">✅</div><p>No adverse events recorded</p></div>
                : <>
                    <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
                      <button className="btn btn-ghost btn-sm"
                        onClick={()=>exportCSV(adverseEvents,`adverse-events-${today()}.csv`)}>↓ Export CSV</button>
                    </div>
                    <div className="table-wrap"><table>
                      <thead><tr><th>Event ID</th><th>Implant ID</th><th>Device</th><th>Type</th><th>Date</th><th>Practice</th><th>Reported to FDA</th><th>Status</th><th>Actions</th></tr></thead>
                      <tbody>{adverseEvents.map(e=>(
                        <tr key={e.eventId} style={{background:'rgba(239,68,68,0.03)'}}>
                          <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{e.eventId}</td>
                          <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{e.implantId}</td>
                          <td style={{fontWeight:600,fontSize:12}}>{e.deviceName}</td>
                          <td><span className={`badge ${e.eventType==='death'?'badge-red':e.eventType==='serious_injury'?'badge-amber':'badge-blue'}`}>{e.eventType?.replace(/_/g,' ')}</span></td>
                          <td style={{fontSize:11}}>{e.eventDate}</td>
                          <td style={{fontSize:11}}>🏥 {e.practiceId}</td>
                          <td><span className={`badge ${e.reportedToFDA?'badge-green':'badge-red'}`}>{e.reportedToFDA?'✓ Yes':'✕ No'}</span></td>
                          <td><span className={`badge ${e.status==='closed'?'badge-green':'badge-amber'}`}>{e.status}</span></td>
                          <td>
                            <button className="btn btn-ghost btn-sm"
                              style={{color:'var(--accent-purple)',borderColor:'var(--accent-purple)',fontSize:11,whiteSpace:'nowrap'}}
                              onClick={()=>draftMDR(e)}>🤖 Draft MDR</button>
                          </td>
                        </tr>
                      ))}</tbody>
                    </table></div>
                    {adverseEvents.some(e=>!e.reportedToFDA) && (
                      <div style={{marginTop:12,padding:'12px 16px',background:'rgba(239,68,68,0.06)',
                        borderRadius:'var(--radius-md)',border:'1px solid rgba(239,68,68,0.2)',fontSize:12}}>
                        <strong style={{color:'var(--accent-red)'}}>⚠ Action required:</strong>{' '}
                        {adverseEvents.filter(e=>!e.reportedToFDA).length} event{adverseEvents.filter(e=>!e.reportedToFDA).length>1?'s':''} unreported.
                        File at <a href="https://www.accessdata.fda.gov/scripts/medwatch" target="_blank" rel="noreferrer" style={{color:'var(--accent-blue)'}}>FDA MedWatch</a>.
                      </div>
                    )}
                  </>
          }
        </div>
      )}
    </>
  );
}

function today() { return new Date().toISOString().split('T')[0]; }
