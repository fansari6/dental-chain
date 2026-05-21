import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import ExpiryAlertBanner from '../components/ExpiryAlertBanner';

// ─── Constants ────────────────────────────────────────────────────
const DEVICE_CATEGORIES = ['cardiac', 'general_surgery', 'neurosurgery', 'orthopedic'];

const DEVICE_TYPES = {
  cardiac:         ['balloon_pump','catheter','defibrillator','pacemaker','recorder','stent','valve','vad'],
  general_surgery: ['collagen_product','mesh','other','tissue_expander'],
  neurosurgery:    ['cage','catheter','cranial_plate','drug_pump','plate','rod','screw','shunt_valve','stimulator'],
  orthopedic:      ['biologic','bone_cement','growth_factor','joint','plate','rod','screw','spacer'],
};

const MRI_OPTIONS = ['conditional', 'safe', 'unsafe'];

const BODY_LOCATIONS_BY_TYPE = {
  joint:           ['Left Hip','Right Hip','Left Knee','Right Knee','Left Shoulder','Right Shoulder','Left Ankle','Right Ankle'],
  pacemaker:       ['Left Ventricle','Right Ventricle','Left Atrium','Right Atrium'],
  defibrillator:   ['Left Ventricle','Right Ventricle'],
  valve:           ['Aortic Valve','Mitral Valve','Tricuspid Valve','Pulmonary Valve'],
  recorder:        ['Left Ventricle','Right Ventricle','Left Coronary Artery','Right Coronary Artery'],
  stent:           ['Left Coronary Artery','Right Coronary Artery','Aorta','Femoral Artery'],
  balloon_pump:    ['Aorta'],
  vad:             ['Left Ventricle','Right Ventricle'],
  catheter:        ['Left Coronary Artery','Right Coronary Artery','Left Ventricle','Right Ventricle'],
  cage:            ['Cervical Spine (C1-C7)','Thoracic Spine (T1-T12)','L3/L4','L4/L5','L5/S1'],
  rod:             ['Cervical Spine (C1-C7)','Thoracic Spine (T1-T12)','Lumbar Spine (L1-L5)','L3/L4','L4/L5','L5/S1'],
  spacer:          ['L3/L4','L4/L5','L5/S1','Cervical Spine (C1-C7)'],
  stimulator:      ['Lumbar Spine (L1-L5)','Thoracic Spine (T1-T12)','Cervical Spine (C1-C7)'],
  shunt_valve:     ['Brain - Left Hemisphere','Brain - Right Hemisphere','Cranium'],
  cranial_plate:   ['Cranium'],
  drug_pump:       ['Lumbar Spine (L1-L5)','Abdomen'],
  screw:           ['Left Hip','Right Hip','Cervical Spine (C1-C7)','Lumbar Spine (L1-L5)','L3/L4','L4/L5','L5/S1'],
  plate:           ['Left Hip','Right Hip','Cervical Spine (C1-C7)','Cranium'],
  biologic:        ['Left Knee','Right Knee','Left Hip','Right Hip','Left Shoulder','Right Shoulder'],
  bone_cement:     ['Left Hip','Right Hip','Left Knee','Right Knee'],
  growth_factor:   ['Left Knee','Right Knee','Left Hip','Right Hip','Lumbar Spine (L1-L5)'],
  mesh:            ['Abdomen','Pelvis','Groin - Left','Groin - Right'],
  tissue_expander: ['Left Breast','Right Breast'],
  collagen_product:['Abdomen','Left Knee','Right Knee'],
  other:           ['Other'],
};

const CERT_BODIES = ['BSI Group', 'TÜV SÜD', 'DNV', 'SGS', 'UL', 'Intertek', 'NSF International', 'Other'];

// ─── Component ────────────────────────────────────────────────────
// ── Inline editable model number ─────────────────────────────────────────
function EditableModelNumber({ udiDI, modelNumber, onSaved }) {
  const [editing, setEditing] = React.useState(false);
  const [value,   setValue]   = React.useState(modelNumber || '');
  const [saving,  setSaving]  = React.useState(false);

  React.useEffect(() => { setValue(modelNumber || ''); }, [modelNumber]);

  const save = async () => {
    setSaving(true);
    try {
      await api.updateDeviceModelNumber(udiDI, value);
      setEditing(false);
      onSaved();
    } catch(err) { console.error(err); }
    setSaving(false);
  };

  if (editing) return (
    <div style={{display:'flex',gap:4,alignItems:'center',minWidth:140}}>
      <input value={value} onChange={e=>setValue(e.target.value)} autoFocus
        onKeyDown={e=>{ if(e.key==='Enter') save(); if(e.key==='Escape') setEditing(false); }}
        style={{flex:1,fontSize:11,padding:'3px 6px',fontFamily:'var(--font-mono)'}}/>
      <button className="btn btn-primary btn-sm" disabled={saving} onClick={save}
        style={{padding:'3px 8px',fontSize:11}}>
        {saving ? <span className="spinner" style={{width:10,height:10}}/> : '✓'}
      </button>
      <button className="btn btn-ghost btn-sm" onClick={()=>setEditing(false)}
        style={{padding:'3px 6px',fontSize:11}}>✕</button>
    </div>
  );

  return (
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <span style={{fontSize:11,fontFamily:'var(--font-mono)',
        color: modelNumber ? 'var(--text-primary)' : 'var(--text-muted)'}}>
        {modelNumber || '—'}
      </span>
      <button className="btn btn-ghost btn-sm"
        style={{padding:'2px 6px',fontSize:10,opacity:0.7}}
        onClick={()=>{ setValue(modelNumber||''); setEditing(true); }}>
        ✏
      </button>
    </div>
  );
}

export default function ManufacturerPage() {
  const { user } = useAuth();

  // Data
  const [lots,             setLots]             = useState([]);
  const [devices,          setDevices]          = useState([]);
  const [clearances,       setClearances]       = useState([]);
  const [certs,            setCerts]            = useState([]);
  const [submissions,      setSubmissions]      = useState([]);
  const [myOrg,            setMyOrg]            = useState(null);
  const [storageConditions,setStorageConditions]= useState([
    'Store at room temperature (15-30°C)', 'Store below 25°C',
    'Store below 8°C (refrigerate)', 'Store away from light',
    'Store in a dry place', 'Do not freeze',
  ]);

  // UI
  const [loading,      setLoading]      = useState(true);
  const [msg,          setMsg]          = useState(null);
  const [busy,         setBusy]         = useState(false);
  const [releaseBusy,  setReleaseBusy]  = useState({});
  const [backorderMsg, setBackorderMsg] = useState(null);
  const [backorderBusy,setBackorderBusy]= useState(false);
  const [isoMsg,       setIsoMsg]       = useState(null);
  const [isoBusy,      setIsoBusy]      = useState(false);
  const [devSubMsg,    setDevSubMsg]    = useState(null);
  const [devSubBusy,   setDevSubBusy]   = useState(false);
  const [bfMsg,        setBfMsg]        = useState(null);
  const [bfBusy,       setBfBusy]       = useState(false);
  const [qcModal,      setQcModal]      = useState(null);
  const [qcNotes,      setQcNotes]      = useState('');
  const [tab,          setTab]          = useState('devices');
  const [submissionSearch, setSubmissionSearch] = useState('');
  const [lotSearch,        setLotSearch]        = useState('');

  const today = new Date().toISOString().split('T')[0];

  // ── GUDID lookup state ──────────────────────────────────────────
  const [dsGudidBusy, setDsGudidBusy] = useState(false);
  const [dsGudidMsg,  setDsGudidMsg]  = useState(null); // {type, text, data}
  const [bfGudidBusy, setBfGudidBusy] = useState(false);
  const [bfGudidMsg,  setBfGudidMsg]  = useState(null);

  // Shared GUDID lookup — returns parsed fields or throws
  const lookupGUDID = async (udiDI) => {
    if (!udiDI.trim()) throw new Error('Enter a UDI-DI first');
    // Strip GS1 application identifier wrapper if present: (01)XXXXX → XXXXX
    const di = udiDI.replace(/^\(01\)/, '').trim();
    const url = `https://accessgudid.nlm.nih.gov/api/v2/devices/lookup.json?di=${encodeURIComponent(di)}`;
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) throw new Error(`UDI-DI "${udiDI}" not found in FDA GUDID database`);
      throw new Error(`GUDID lookup failed (HTTP ${res.status})`);
    }
    const json = await res.json();
    const device = json?.gudid?.device;
    if (!device) throw new Error('Unexpected GUDID response format');

    // Map MRI safety status
    const mriMap = {
      'MR Safe':        'safe',
      'MR Conditional': 'conditional',
      'MR Unsafe':      'unsafe',
    };
    const mriRaw = device.MRISafetyStatus || '';
    const mriSafe = mriMap[mriRaw] || 'conditional';

    // Latex — GUDID uses string "Yes"/"No" or boolean
    const latexRaw = device.labelContainsLatexIndicator;
    const containsLatex = latexRaw === 'Yes' || latexRaw === true ||
                          latexRaw === 'Contains Natural Rubber Latex';

    return {
      deviceName:     device.brandName || device.deviceDescription || '',
      singleUse:      device.singleUse === true || device.singleUse === 'true',
      sterile:        device.sterilization?.deviceSterile === true ||
                      device.sterilization?.deviceSterile === 'true',
      containsLatex,
      mriSafe,
      companyName:    device.companyName || '',
      mriRaw,
      distributionStatus: device.deviceCommDistributionStatus || '',
    };
  };

  // ── Forms ─────────────────────────────────────────────────────
  const [devSubForm, setDevSubForm] = useState({
    udiDI:'', deviceName:'', deviceCategory:'', deviceType:'',
    singleUse:false, sterile:true, containsLatex:false, mriSafe:'conditional',
    bodyLocations:[], indications:'', modelNumber:'',
  });
  const setDS = (k,v) => setDevSubForm(f=>({...f,[k]:v}));

  // ── Brownfield form ───────────────────────────────────────────
  const [bfForm, setBfForm] = useState({
    udiDI:'', deviceName:'', deviceCategory:'', deviceType:'',
    singleUse:false, sterile:true, containsLatex:false, mriSafe:'conditional',
    bodyLocations:[], clearanceNumber:'', clearanceType:'', clearanceDate:'',
    gudidVerified:false, modelNumber:'',
  });
  const setBF = (k,v) => setBfForm(f=>({...f,[k]:v}));

  const [isoForm, setIsoForm] = useState({
    certId:'', facilityName:'', facilityAddress:'', scope:'',
    certBody:'', issueDate:'', expiryDate:'',
  });
  const setIF = (k,v) => setIsoForm(f=>({...f,[k]:v}));

  const [lotForm, setLotForm] = useState({
    lotId:'', udiDI:'', clearanceNumber:'', certId:'', lotNumber:'',
    manufacturingDate:'', expiryDate:'', sterileExpiryDate:'',
    quantity:'', storageConditions:'Store at room temperature (15-30°C)',
  });
  const setL = (k,v) => setLotForm(f=>({...f,[k]:v}));

  const [backorderForm, setBackorderForm] = useState({
    lotId:'', reason:'', estimatedResupplyDate:'',
  });
  const setB = (k,v) => setBackorderForm(f=>({...f,[k]:v}));

  // ── Data loading ────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setLoading(true);
    api.getLookupValues('storage_conditions')
      .then(vals => { if (vals?.length) setStorageConditions(vals); })
      .catch(()=>{});
    api.getDeviceSubmissions()
      .then(subs => setSubmissions(subs || []))
      .catch(()=>{});
    api.getOrganizations()
      .then(orgs => {
        const org = (orgs||[]).find(o =>
          o.name.toLowerCase().trim() === (user?.organization || '').toLowerCase().trim()
        );
        if (org) setMyOrg(org);
      })
      .catch(()=>{});
    try {
      const [l, d, c, i] = await Promise.allSettled([
        api.getLots(), api.getDevices(), api.getClearances(), api.getISO13485(),
      ]);
      if (l.status==='fulfilled') setLots(l.value || []);
      if (d.status==='fulfilled') setDevices((d.value || []).filter(dev => dev.manufacturerId === user?.username));
      if (c.status==='fulfilled') setClearances((c.value || []).filter(cl =>
        cl.manufacturerId === user?.username && cl.status === 'active'
      ));
      if (i.status==='fulfilled') setCerts((i.value || []).filter(cert =>
        cert.manufacturerId === user?.username &&
        cert.status === 'active' && cert.expiryDate >= today
      ));
    } catch {}
    setLoading(false);
  }, [user, today]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDeviceSelect = (udiDI) => {
    setL('udiDI', udiDI);
    setL('clearanceNumber', '');
    if (!udiDI) return;
    const match = clearances.find(c => c.udiDI === udiDI);
    if (match) setL('clearanceNumber', match.clearanceNumber);
  };

  useEffect(() => {
    if (certs.length === 1) setL('certId', certs[0].certId);
  }, [certs]);

  useEffect(() => {
    if (!myOrg) return;
    setIsoForm(f => ({
      ...f,
      facilityName:    myOrg.name    || '',
      facilityAddress: myOrg.address || '',
    }));
  }, [myOrg]);

  const myLots = lots.filter(l => l.manufacturerId === user?.username);
  const qcLots = myLots.filter(l => l.status === 'quarantine');

  // ── Submit device for FDA review ────────────────────────────────

  const submitDeviceSub = async (e) => {
    e.preventDefault(); setDevSubBusy(true); setDevSubMsg(null);
    try {
      await api.submitDevice(devSubForm);
      setDevSubMsg({ type:'success', text:`"${devSubForm.deviceName}" submitted to FDA for review.` });
      setTimeout(() => setDevSubMsg(null), 3000);
      setDevSubForm({ udiDI:'', deviceName:'', deviceCategory:'', deviceType:'',
        singleUse:false, sterile:true, containsLatex:false, mriSafe:'conditional',
        bodyLocations:[], indications:'', modelNumber:'' });
      api.getDeviceSubmissions().then(subs => setSubmissions(subs||[])).catch(()=>{});
    } catch (err) { setDevSubMsg({ type:'error', text: err.message }); }
    finally { setDevSubBusy(false); }
  };

  // ── Submit brownfield onboarding request ────────────────────────

  const submitBrownfield = async (e) => {
    e.preventDefault(); setBfBusy(true); setBfMsg(null);
    try {
      await api.createOnboardingRequest({
        ...bfForm,
        manufacturerId: user.username,
      });
      setBfMsg({ type:'success', text:`"${bfForm.deviceName}" submitted for fast-track onboarding. Government will review shortly.` });
      setTimeout(() => setBfMsg(null), 3000);
      setBfForm({ udiDI:'', deviceName:'', deviceCategory:'', deviceType:'',
        singleUse:false, sterile:true, containsLatex:false, mriSafe:'conditional',
        bodyLocations:[], clearanceNumber:'', clearanceType:'', clearanceDate:'',
        gudidVerified:false, modelNumber:'' });
    } catch (err) { setBfMsg({ type:'error', text: err.message }); }
    finally { setBfBusy(false); }
  };

  // ── Upload ISO 13485 certificate ────────────────────────────────

  const submitISO = async (e) => {
    e.preventDefault(); setIsoBusy(true); setIsoMsg(null);
    try {
      await api.uploadISO13485({
        ...isoForm,
        manufacturerId: user.username,
        facilityAddress: isoForm.facilityAddress || '',
        scope: isoForm.scope || '',
      });
      setIsoMsg({ type:'success', text:`Certificate "${isoForm.certId}" recorded on blockchain.` });
      setTimeout(() => setIsoMsg(null), 3000);
      setIsoForm({ certId:'', facilityName:'', facilityAddress:'', scope:'', certBody:'', issueDate:'', expiryDate:'' });
      refresh();
    } catch (err) { setIsoMsg({ type:'error', text: err.message }); }
    finally { setIsoBusy(false); }
  };

  // ── Create lot ──────────────────────────────────────────────────

  const submitLot = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      await api.createLot(lotForm);
      setMsg({ type:'success', text:`Lot "${lotForm.lotId}" created — status: Quarantine (pending QC release).` });
      setTimeout(() => setMsg(null), 3000);
      setLotForm({ lotId:'', udiDI:'', clearanceNumber:'', certId:'', lotNumber:'',
        manufacturingDate:'', expiryDate:'', sterileExpiryDate:'',
        quantity:'', storageConditions:'Store at room temperature (15-30°C)' });
      refresh();
    } catch (err) { setMsg({ type:'error', text: err.message }); }
    finally { setBusy(false); }
  };

  // ── QC Release with notes ───────────────────────────────────────

  const handleRelease = async () => {
    if (!qcModal) return;
    setReleaseBusy(b=>({...b,[qcModal]:true}));
    try {
      await api.releaseLot(qcModal, { qcNotes });
      setMsg({ type:'success', text:`Lot "${qcModal}" QC released — now active and available for consignment.` });
      setTimeout(() => setMsg(null), 3000);
      setQcModal(null); setQcNotes('');
      refresh();
    } catch (err) { setMsg({ type:'error', text: err.message }); }
    finally { setReleaseBusy(b=>({...b,[qcModal]:false})); }
  };

  // ── Flag backorder ──────────────────────────────────────────────

  const submitBackorder = async (e) => {
    e.preventDefault(); setBackorderBusy(true); setBackorderMsg(null);
    try {
      await api.flagBackorder(backorderForm.lotId, {
        reason: backorderForm.reason,
        estimatedResupplyDate: backorderForm.estimatedResupplyDate,
      });
      setBackorderMsg({ type:'success', text:`Lot "${backorderForm.lotId}" flagged as backordered.` });
      setTimeout(() => setBackorderMsg(null), 3000);
      setBackorderForm({ lotId:'', reason:'', estimatedResupplyDate:'' });
      refresh();
    } catch (err) { setBackorderMsg({ type:'error', text: err.message }); }
    finally { setBackorderBusy(false); }
  };

  const statusBadge = s => {
    const m = { active:'badge-green', quarantine:'badge-amber', recalled:'badge-red', depleted:'badge-blue' };
    return <span className={`badge ${m[s]||'badge-blue'}`}>{s}</span>;
  };

  // ── Search filters ─────────────────────────────────────────────────
  const filteredSubmissions = submissions.filter(s => {
    if (!submissionSearch.trim()) return true;
    const q = submissionSearch.toLowerCase();
    return (s.device_name||'').toLowerCase().includes(q) ||
           (s.udi_di||'').toLowerCase().includes(q) ||
           (s.device_category||'').toLowerCase().includes(q) ||
           (s.device_type||'').toLowerCase().includes(q) ||
           (s.status||'').toLowerCase().includes(q);
  });
  const filteredMyLots = myLots.filter(l => {
    if (!lotSearch.trim()) return true;
    const q = lotSearch.toLowerCase();
    return (l.lotId||'').toLowerCase().includes(q) ||
           (l.deviceName||'').toLowerCase().includes(q) ||
           (l.lotNumber||'').toLowerCase().includes(q) ||
           (l.status||'').toLowerCase().includes(q) ||
           (l.udiDI||'').toLowerCase().includes(q);
  });

  // ── Helpers ─────────────────────────────────────────────────────

  const tabStyle = (t) => ({
    padding:'8px 16px', borderRadius:'var(--radius-sm)', cursor:'pointer',
    fontSize:13, fontWeight:600, border:'none',
    background: tab===t ? 'var(--accent-green)' : 'transparent',
    color: tab===t ? '#fff' : 'var(--text-secondary)',
  });

  // ── Render ──────────────────────────────────────────────────────

  return (
    <>
      <div className="page-header">
        <h2>🏭 Manufacturer Portal</h2>
        <p>Register devices, upload ISO 13485 certificates, create lots, perform QC release</p>
      </div>

      <ExpiryAlertBanner />

      <div style={{display:'flex',gap:4,marginBottom:20,background:'var(--bg-card)',
        padding:4,borderRadius:'var(--radius-md)',width:'fit-content',
        border:'1px solid var(--border)',flexWrap:'wrap'}}>
        <button style={tabStyle('devices')}    onClick={()=>setTab('devices')}>
          📋 Submit Device
          {submissions.filter(s=>s.status==='pending').length > 0 && (
            <span className="badge badge-amber" style={{marginLeft:6,fontSize:10}}>
              {submissions.filter(s=>s.status==='pending').length}
            </span>
          )}
        </button>
        <button style={tabStyle('brownfield')} onClick={()=>setTab('brownfield')}>🏥 Brownfield</button>
        <button style={tabStyle('iso')}        onClick={()=>setTab('iso')}>🏭 ISO 13485</button>
        <button style={tabStyle('lots')}       onClick={()=>setTab('lots')}>
          🔬 Lots
          {qcLots.length > 0 && (
            <span className="badge badge-amber" style={{marginLeft:6,fontSize:10}}>{qcLots.length} QC</span>
          )}
        </button>
        <button style={tabStyle('backorder')}  onClick={()=>setTab('backorder')}>⚠ Backorder</button>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type}`} style={{marginBottom:12}}>
          {msg.type==='error'?'⚠':'✓'} {msg.text}
        </div>
      )}

      {/* ── QC Release Modal ── */}
      {qcModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1000,
          display:'flex',alignItems:'center',justifyContent:'center'}}
          onClick={()=>{ setQcModal(null); setQcNotes(''); }}>
          <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',
            borderRadius:'var(--radius-lg)',padding:28,width:420}}
            onClick={e=>e.stopPropagation()}>
            <h3 style={{marginBottom:4}}>✅ QC Release — {qcModal}</h3>
            <p style={{fontSize:12,color:'var(--text-secondary)',marginBottom:16}}>
              Confirm all quality control checks have passed. This action moves the lot
              to active status and makes it available for consignment to hospitals.
            </p>
            <div className="form-group" style={{marginBottom:16}}>
              <label>QC Notes <span style={{fontSize:10,color:'var(--text-muted)'}}>optional</span></label>
              <textarea value={qcNotes} onChange={e=>setQcNotes(e.target.value)}
                placeholder="e.g. Sterility testing passed. Released by QA Manager J. Smith."
                rows={3} style={{width:'100%',background:'var(--bg-secondary)',
                  border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',
                  color:'var(--text-primary)',padding:'10px 12px',fontSize:13,resize:'vertical'}}/>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-primary" style={{flex:1}}
                disabled={releaseBusy[qcModal]} onClick={handleRelease}>
                {releaseBusy[qcModal]
                  ? <><span className="spinner" style={{width:14,height:14}}/> Releasing…</>
                  : '✅ Confirm QC Release'}
              </button>
              <button className="btn btn-ghost" onClick={()=>{ setQcModal(null); setQcNotes(''); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          DEVICES TAB — Greenfield submission + my submissions + registered devices
      ══════════════════════════════════════════════════ */}
      {tab==='devices' && <>

      {/* ══════════════════════════════════════════════════
          1. REGISTER NEW DEVICE — Greenfield (new submission)
      ══════════════════════════════════════════════════ */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">🦾 Submit Device for FDA Registration</span>
          <span className="badge badge-blue">Pending FDA review before going live</span>
        </div>
        <p style={{fontSize:12,color:'var(--text-secondary)',marginBottom:16}}>
          Submit new device details to the FDA for GUDID registration review. Once approved,
          the device will be registered on the blockchain and available for lot creation.
        </p>
        {devSubMsg && (
          <div className={`alert alert-${devSubMsg.type}`} style={{marginBottom:12}}>
            {devSubMsg.type==='error'?'⚠':'✓'} {devSubMsg.text}
          </div>
        )}
        <form onSubmit={submitDeviceSub}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:16,marginBottom:14}}>
            <div className="form-group" style={{gridColumn:'span 3'}}>
              <label>UDI-DI (Device Identifier)</label>
              <div style={{display:'flex',gap:8}}>
                <input placeholder="e.g. (01)00643169007234" value={devSubForm.udiDI}
                  onChange={e=>{ setDS('udiDI',e.target.value); setDsGudidMsg(null); }} required
                  style={{flex:1}}/>
                <button type="button" className="btn btn-ghost btn-sm"
                  style={{whiteSpace:'nowrap',color:'var(--accent-cyan)',borderColor:'var(--accent-cyan)'}}
                  disabled={dsGudidBusy||!devSubForm.udiDI.trim()}
                  onClick={async()=>{
                    setDsGudidBusy(true); setDsGudidMsg(null);
                    try {
                      const d = await lookupGUDID(devSubForm.udiDI);
                      if (d.deviceName) setDS('deviceName', d.deviceName);
                      setDS('singleUse',     d.singleUse);
                      setDS('sterile',       d.sterile);
                      setDS('containsLatex', d.containsLatex);
                      setDS('mriSafe',       d.mriSafe);
                      setDsGudidMsg({ type:'success', data:d });
                    } catch(err) {
                      setDsGudidMsg({ type:'error', text: err.message });
                    } finally { setDsGudidBusy(false); }
                  }}>
                  {dsGudidBusy
                    ? <span className="spinner" style={{width:12,height:12}}/>
                    : '🔍 GUDID'}
                </button>
              </div>
              <span style={{fontSize:10,color:'var(--text-muted)'}}>GS1 format preferred</span>
              {dsGudidMsg?.type==='success' && (
                <div style={{marginTop:6,padding:'8px 10px',background:'rgba(16,185,129,0.08)',
                  border:'1px solid rgba(16,185,129,0.25)',borderRadius:'var(--radius-sm)',fontSize:11}}>
                  <div style={{color:'var(--accent-green)',fontWeight:600,marginBottom:4}}>
                    ✓ GUDID Verified — fields auto-populated
                  </div>
                  <div style={{color:'var(--text-secondary)'}}>
                    {dsGudidMsg.data.companyName && <span>Company: {dsGudidMsg.data.companyName} · </span>}
                    MRI: {dsGudidMsg.data.mriRaw||dsGudidMsg.data.mriSafe} ·{' '}
                    {dsGudidMsg.data.singleUse?'Single Use':'Reusable'} ·{' '}
                    {dsGudidMsg.data.sterile?'Sterile':'Non-sterile'} ·{' '}
                    {dsGudidMsg.data.distributionStatus}
                  </div>
                </div>
              )}
              {dsGudidMsg?.type==='error' && (
                <div style={{marginTop:6,fontSize:11,color:'var(--accent-amber)'}}>
                  ⚠ {dsGudidMsg.text}
                </div>
              )}
            </div>
            <div className="form-group" style={{gridColumn:'span 3'}}>
              <label>Device Name</label>
              <input placeholder="e.g. Stryker Triathlon Total Knee System"
                value={devSubForm.deviceName} onChange={e=>setDS('deviceName',e.target.value)} required/>
            </div>
            <div className="form-group" style={{gridColumn:'span 1'}}>
              <label>Model # <span style={{fontSize:10,color:'var(--text-muted)'}}>optional</span></label>
              <input placeholder="e.g. TRIATHLON-PS-6"
                value={devSubForm.modelNumber} onChange={e=>setDS('modelNumber',e.target.value)}
                style={{fontFamily:'var(--font-mono)',fontSize:12}}/>
            </div>
            <div className="form-group" style={{gridColumn:'span 3'}}>
              <label>MRI Safety</label>
              <select value={devSubForm.mriSafe} onChange={e=>setDS('mriSafe',e.target.value)} required>
                {MRI_OPTIONS.map(o=><option key={o} value={o}>{o.charAt(0).toUpperCase()+o.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group" style={{gridColumn:'span 3'}}>
              <label>Device Category</label>
              <select value={devSubForm.deviceCategory}
                onChange={e=>{ setDS('deviceCategory',e.target.value); setDS('deviceType',''); setDS('bodyLocations',[]); }}
                required>
                <option value="">— Select category —</option>
                {DEVICE_CATEGORIES.map(c=>(
                  <option key={c} value={c}>{c.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{gridColumn:'span 3'}}>
              <label>Device Type</label>
              <select value={devSubForm.deviceType}
                onChange={e=>{ setDS('deviceType',e.target.value); setDS('bodyLocations',[]); }}
                required>
                <option value="">— Select type —</option>
                {(DEVICE_TYPES[devSubForm.deviceCategory]||[]).map(t=>(
                  <option key={t} value={t}>{t.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{gridColumn:'span 4'}}>
              <label>Attributes</label>
              <div style={{display:'flex',gap:16,paddingTop:8}}>
                <label className="checkbox-group">
                  <input type="checkbox" checked={devSubForm.singleUse} onChange={e=>setDS('singleUse',e.target.checked)}/>
                  <span>Single Use</span>
                </label>
                <label className="checkbox-group">
                  <input type="checkbox" checked={devSubForm.sterile} onChange={e=>setDS('sterile',e.target.checked)}/>
                  <span>Sterile</span>
                </label>
                <label className="checkbox-group">
                  <input type="checkbox" checked={devSubForm.containsLatex} onChange={e=>setDS('containsLatex',e.target.checked)}/>
                  <span>Contains Latex</span>
                </label>
              </div>
            </div>
            <div className="form-group" style={{gridColumn:'span 10'}}>
              <label>Indications for Use</label>
              <input placeholder="e.g. Intended for total knee arthroplasty in skeletally mature patients with knee joint disease"
                value={devSubForm.indications} onChange={e=>setDS('indications',e.target.value)} required/>
            </div>
            {devSubForm.deviceType && BODY_LOCATIONS_BY_TYPE[devSubForm.deviceType] && (
              <div className="form-group" style={{gridColumn:'span 10'}}>
                <label>Valid Body Locations <span style={{fontSize:10,color:'var(--text-muted)'}}>select all applicable</span></label>
                <div style={{display:'flex',flexWrap:'wrap',gap:8,padding:'10px 12px',
                  background:'var(--bg-secondary)',borderRadius:'var(--radius-sm)',
                  border:`1px solid ${devSubForm.bodyLocations.length===0?'var(--accent-amber)':'var(--border)'}`}}>
                  {BODY_LOCATIONS_BY_TYPE[devSubForm.deviceType].map(loc=>(
                    <label key={loc} className="checkbox-group" style={{margin:0}}>
                      <input type="checkbox"
                        checked={devSubForm.bodyLocations.includes(loc)}
                        onChange={e=>{
                          const locs = e.target.checked
                            ? [...devSubForm.bodyLocations, loc]
                            : devSubForm.bodyLocations.filter(l=>l!==loc);
                          setDS('bodyLocations', locs);
                        }}/>
                      <span style={{fontSize:12}}>{loc}</span>
                    </label>
                  ))}
                </div>
                {devSubForm.bodyLocations.length===0 && (
                  <span style={{fontSize:11,color:'var(--accent-amber)'}}>⚠ Select at least one body location</span>
                )}
              </div>
            )}
          </div>
          <button type="submit" className="btn btn-primary"
            disabled={devSubBusy || !devSubForm.deviceCategory || !devSubForm.deviceType || devSubForm.bodyLocations.length===0}>
            {devSubBusy
              ? <><span className="spinner" style={{width:14,height:14}}/> Submitting…</>
              : '📋 Submit to FDA for Approval'}
          </button>
        </form>
      </div>

      {/* My Submissions */}
      {submissions.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              📋 My Device Submissions
              <span className="badge badge-blue" style={{marginLeft:8}}>{submissions.length}</span>
            </span>
            <button className="btn btn-ghost btn-sm" onClick={()=>api.getDeviceSubmissions().then(s=>setSubmissions(s||[])).catch(()=>{})}>↻ Refresh</button>
          </div>
          <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center'}}>
            <input placeholder="🔍 Search by name, UDI, category, status..."
              value={submissionSearch} onChange={e=>setSubmissionSearch(e.target.value)}
              style={{flex:1,maxWidth:360}}/>
            {submissionSearch && <>
              <button className="btn btn-ghost btn-sm" onClick={()=>setSubmissionSearch('')}>✕ Clear</button>
              <span style={{fontSize:12,color:'var(--text-muted)',whiteSpace:'nowrap'}}>
                {filteredSubmissions.length} of {submissions.length}
              </span>
            </>}
          </div>
          <div className="table-wrap"><table>
            <thead><tr>
              <th>UDI-DI</th><th>Device Name</th><th>Model #</th><th>Category</th><th>Type</th>
              <th>Body Locations</th><th>Submitted</th><th>Status</th><th>FDA Notes</th>
            </tr></thead>
            <tbody>{filteredSubmissions.map(s=>(
              <tr key={s.id}>
                <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{s.udi_di}</td>
                <td style={{fontWeight:600}}>{s.device_name}</td>
                <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{s.model_number||'—'}</td>
                <td><span className="badge badge-blue">{s.device_category}</span></td>
                <td style={{fontSize:12}}>{s.device_type}</td>
                <td style={{fontSize:11,maxWidth:200,wordBreak:'break-word'}}>{s.body_locations||'—'}</td>
                <td style={{fontSize:11}}>{new Date(s.submitted_at).toLocaleDateString()}</td>
                <td>
                  <span className={`badge ${s.status==='approved'?'badge-green':s.status==='rejected'?'badge-red':'badge-amber'}`}>
                    {s.status}
                  </span>
                </td>
                <td style={{fontSize:11,color:'var(--accent-red)'}}>{s.reject_reason||'—'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      )}

      {/* My Registered Devices — approved and on blockchain */}
      {devices.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              🦾 My Registered Devices
              <span className="badge badge-green" style={{marginLeft:8}}>{devices.length}</span>
            </span>
          </div>
          <div className="table-wrap"><table>
            <thead><tr>
              <th>UDI-DI</th><th>Device Name</th><th>Model #</th><th>Category</th><th>Type</th>
              <th>Body Locations</th><th>MRI Safe</th><th>Single Use</th><th>Source</th>
            </tr></thead>
            <tbody>{devices.map(d=>(
              <tr key={d.udiDI}>
                <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{d.udiDI}</td>
                <td style={{fontWeight:600}}>{d.deviceName}</td>
                <td><EditableModelNumber udiDI={d.udiDI} modelNumber={d.modelNumber} onSaved={refresh}/></td>
                <td><span className="badge badge-blue">{d.deviceCategory}</span></td>
                <td style={{fontSize:12}}>{d.deviceType}</td>
                <td style={{fontSize:11,maxWidth:200,wordBreak:'break-word'}}>
                  {Array.isArray(d.bodyLocations)&&d.bodyLocations.length>0
                    ? d.bodyLocations.join(', ') : '—'}
                </td>
                <td><span className={`badge ${d.mriSafe==='safe'?'badge-green':d.mriSafe==='conditional'?'badge-amber':'badge-red'}`}>{d.mriSafe}</span></td>
                <td><span className={`badge ${d.singleUse?'badge-amber':'badge-green'}`}>{d.singleUse?'Yes':'No'}</span></td>
                <td>
                  <span className={`badge ${d.gudidVerified?'badge-green':'badge-blue'}`} style={{fontSize:10}}>
                    {d.gudidVerified?'✓ GUDID':d.onboardingType==='brownfield'?'Brownfield':'Standard'}
                  </span>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      )}



      </>} {/* end devices tab */}

      {/* ══════════════════════════════════════════════════
          BROWNFIELD TAB
      ══════════════════════════════════════════════════ */}
      {tab==='brownfield' && <>

      {/* ══════════════════════════════════════════════════
          1b. BROWNFIELD ONBOARDING REQUEST
          For existing FDA-cleared devices already in use.
      ══════════════════════════════════════════════════ */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">🏥 Brownfield Onboarding Request</span>
          <span className="badge badge-cyan">Fast-track · Existing FDA-cleared device</span>
        </div>
        <p style={{fontSize:12,color:'var(--text-secondary)',marginBottom:16}}>
          Already have an FDA-cleared device in use at hospitals? Submit it for fast-track onboarding
          to the blockchain. Government reviews and approves in hours, not weeks.
          Include the clearance number for automatic clearance registration on approval.
        </p>
        {bfMsg && (
          <div className={`alert alert-${bfMsg.type}`} style={{marginBottom:12}}>
            {bfMsg.type==='error'?'⚠':'✓'} {bfMsg.text}
          </div>
        )}
        <form onSubmit={submitBrownfield}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:16,marginBottom:14}}>
            <div className="form-group" style={{gridColumn:'span 3'}}>
              <label>UDI-DI (Device Identifier)</label>
              <div style={{display:'flex',gap:8}}>
                <input placeholder="e.g. (01)00643169007234" value={bfForm.udiDI}
                  onChange={e=>{ setBF('udiDI',e.target.value); setBfGudidMsg(null); }} required
                  style={{flex:1}}/>
                <button type="button" className="btn btn-ghost btn-sm"
                  style={{whiteSpace:'nowrap',color:'var(--accent-cyan)',borderColor:'var(--accent-cyan)'}}
                  disabled={bfGudidBusy||!bfForm.udiDI.trim()}
                  onClick={async()=>{
                    setBfGudidBusy(true); setBfGudidMsg(null);
                    try {
                      const d = await lookupGUDID(bfForm.udiDI);
                      if (d.deviceName) setBF('deviceName', d.deviceName);
                      setBF('singleUse',     d.singleUse);
                      setBF('sterile',       d.sterile);
                      setBF('containsLatex', d.containsLatex);
                      setBF('mriSafe',       d.mriSafe);
                      setBF('gudidVerified', true);
                      setBfGudidMsg({ type:'success', data:d });
                    } catch(err) {
                      setBfGudidMsg({ type:'error', text: err.message });
                    } finally { setBfGudidBusy(false); }
                  }}>
                  {bfGudidBusy
                    ? <span className="spinner" style={{width:12,height:12}}/>
                    : '🔍 GUDID'}
                </button>
              </div>
              <span style={{fontSize:10,color:'var(--text-muted)'}}>From FDA GUDID or device label</span>
              {bfGudidMsg?.type==='success' && (
                <div style={{marginTop:6,padding:'8px 10px',background:'rgba(16,185,129,0.08)',
                  border:'1px solid rgba(16,185,129,0.25)',borderRadius:'var(--radius-sm)',fontSize:11}}>
                  <div style={{color:'var(--accent-green)',fontWeight:600,marginBottom:4}}>
                    ✓ GUDID Verified — fields auto-populated · GUDID Verified checkbox set
                  </div>
                  <div style={{color:'var(--text-secondary)'}}>
                    {bfGudidMsg.data.companyName && <span>Company: {bfGudidMsg.data.companyName} · </span>}
                    MRI: {bfGudidMsg.data.mriRaw||bfGudidMsg.data.mriSafe} ·{' '}
                    {bfGudidMsg.data.singleUse?'Single Use':'Reusable'} ·{' '}
                    {bfGudidMsg.data.sterile?'Sterile':'Non-sterile'}
                  </div>
                </div>
              )}
              {bfGudidMsg?.type==='error' && (
                <div style={{marginTop:6,fontSize:11,color:'var(--accent-amber)'}}>
                  ⚠ {bfGudidMsg.text}
                </div>
              )}
            </div>
            <div className="form-group" style={{gridColumn:'span 3'}}>
              <label>Device Name</label>
              <input placeholder="e.g. Stryker Triathlon Total Knee System"
                value={bfForm.deviceName} onChange={e=>setBF('deviceName',e.target.value)} required/>
            </div>
            <div className="form-group" style={{gridColumn:'span 1'}}>
              <label>Model # <span style={{fontSize:10,color:'var(--text-muted)'}}>optional</span></label>
              <input placeholder="e.g. TRIATHLON-PS-6"
                value={bfForm.modelNumber} onChange={e=>setBF('modelNumber',e.target.value)}
                style={{fontFamily:'var(--font-mono)',fontSize:12}}/>
            </div>
            <div className="form-group" style={{gridColumn:'span 3'}}>
              <label>MRI Safety</label>
              <select value={bfForm.mriSafe} onChange={e=>setBF('mriSafe',e.target.value)}>
                {MRI_OPTIONS.map(o=><option key={o} value={o}>{o.charAt(0).toUpperCase()+o.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group" style={{gridColumn:'span 3'}}>
              <label>Device Category</label>
              <select value={bfForm.deviceCategory}
                onChange={e=>{ setBF('deviceCategory',e.target.value); setBF('deviceType',''); setBF('bodyLocations',[]); }}
                required>
                <option value="">— Select category —</option>
                {DEVICE_CATEGORIES.map(c=>(
                  <option key={c} value={c}>{c.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{gridColumn:'span 3'}}>
              <label>Device Type</label>
              <select value={bfForm.deviceType}
                onChange={e=>{ setBF('deviceType',e.target.value); setBF('bodyLocations',[]); }}
                required>
                <option value="">— Select type —</option>
                {(DEVICE_TYPES[bfForm.deviceCategory]||[]).map(t=>(
                  <option key={t} value={t}>{t.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{gridColumn:'span 4'}}>
              <label>Attributes</label>
              <div style={{display:'flex',gap:16,paddingTop:8}}>
                <label className="checkbox-group">
                  <input type="checkbox" checked={bfForm.singleUse} onChange={e=>setBF('singleUse',e.target.checked)}/>
                  <span>Single Use</span>
                </label>
                <label className="checkbox-group">
                  <input type="checkbox" checked={bfForm.sterile} onChange={e=>setBF('sterile',e.target.checked)}/>
                  <span>Sterile</span>
                </label>
                <label className="checkbox-group">
                  <input type="checkbox" checked={bfForm.containsLatex} onChange={e=>setBF('containsLatex',e.target.checked)}/>
                  <span>Contains Latex</span>
                </label>
              </div>
            </div>
            <div className="form-group" style={{gridColumn:'span 3'}}>
              <label>Existing Clearance # <span style={{fontSize:10,color:'var(--text-muted)'}}>optional</span></label>
              <input placeholder="e.g. K193629" value={bfForm.clearanceNumber}
                onChange={e=>setBF('clearanceNumber',e.target.value)}
                style={{fontFamily:'var(--font-mono)'}}/>
              <span style={{fontSize:10,color:'var(--text-muted)'}}>Auto-registered on approval</span>
            </div>
            <div className="form-group" style={{gridColumn:'span 2'}}>
              <label>Clearance Type</label>
              <select value={bfForm.clearanceType} onChange={e=>setBF('clearanceType',e.target.value)}>
                <option value="">— Select —</option>
                {['510k','PMA','HDE','De_Novo'].map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group" style={{gridColumn:'span 2'}}>
              <label>Clearance Date</label>
              <input type="date" value={bfForm.clearanceDate} onChange={e=>setBF('clearanceDate',e.target.value)}/>
            </div>
            <div className="form-group" style={{gridColumn:'span 3'}}>
              <label style={{display:'flex',alignItems:'center',gap:8}}>
                <input type="checkbox" checked={bfForm.gudidVerified}
                  onChange={e=>setBF('gudidVerified',e.target.checked)}/>
                GUDID Verified — data confirmed against FDA GUDID database
              </label>
            </div>
            {bfForm.deviceType && BODY_LOCATIONS_BY_TYPE[bfForm.deviceType] && (
              <div className="form-group" style={{gridColumn:'span 10'}}>
                <label>Valid Body Locations</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:8,padding:'10px 12px',
                  background:'var(--bg-secondary)',borderRadius:'var(--radius-sm)',
                  border:`1px solid ${bfForm.bodyLocations.length===0?'var(--accent-amber)':'var(--border)'}`}}>
                  {BODY_LOCATIONS_BY_TYPE[bfForm.deviceType].map(loc=>(
                    <label key={loc} className="checkbox-group" style={{margin:0}}>
                      <input type="checkbox"
                        checked={bfForm.bodyLocations.includes(loc)}
                        onChange={e=>{
                          const locs = e.target.checked
                            ? [...bfForm.bodyLocations, loc]
                            : bfForm.bodyLocations.filter(l=>l!==loc);
                          setBF('bodyLocations', locs);
                        }}/>
                      <span style={{fontSize:12}}>{loc}</span>
                    </label>
                  ))}
                </div>
                {bfForm.bodyLocations.length===0 && (
                  <span style={{fontSize:11,color:'var(--accent-amber)'}}>⚠ Select at least one body location</span>
                )}
              </div>
            )}
          </div>
          <button type="submit" className="btn btn-primary"
            style={{background:'var(--accent-cyan)'}}
            disabled={bfBusy || !bfForm.deviceCategory || !bfForm.deviceType || bfForm.bodyLocations.length===0}>
            {bfBusy
              ? <><span className="spinner" style={{width:14,height:14}}/> Submitting…</>
              : '🏥 Submit Brownfield Onboarding Request'}
          </button>
        </form>
      </div>

      {/* My Registered Devices — shown in brownfield tab for context */}
      {devices.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              🦾 My Registered Devices
              <span className="badge badge-green" style={{marginLeft:8}}>{devices.length}</span>
            </span>
          </div>
          <div className="table-wrap"><table>
            <thead><tr>
              <th>UDI-DI</th><th>Device Name</th><th>Model #</th><th>Category</th><th>Type</th>
              <th>Body Locations</th><th>MRI Safe</th><th>Single Use</th><th>Source</th>
            </tr></thead>
            <tbody>{devices.map(d=>(
              <tr key={d.udiDI}>
                <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{d.udiDI}</td>
                <td style={{fontWeight:600}}>{d.deviceName}</td>
                <td><EditableModelNumber udiDI={d.udiDI} modelNumber={d.modelNumber} onSaved={refresh}/></td>
                <td><span className="badge badge-blue">{d.deviceCategory}</span></td>
                <td style={{fontSize:12}}>{d.deviceType}</td>
                <td style={{fontSize:11,maxWidth:200,wordBreak:'break-word'}}>
                  {Array.isArray(d.bodyLocations)&&d.bodyLocations.length>0
                    ? d.bodyLocations.join(', ') : '—'}
                </td>
                <td><span className={`badge ${d.mriSafe==='safe'?'badge-green':d.mriSafe==='conditional'?'badge-amber':'badge-red'}`}>{d.mriSafe}</span></td>
                <td><span className={`badge ${d.singleUse?'badge-amber':'badge-green'}`}>{d.singleUse?'Yes':'No'}</span></td>
                <td>
                  <span className={`badge ${d.gudidVerified?'badge-green':'badge-blue'}`} style={{fontSize:10}}>
                    {d.gudidVerified?'✓ GUDID':d.onboardingType==='brownfield'?'Brownfield':'Standard'}
                  </span>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      )}

      </>} {/* end brownfield tab */}

      {/* ══════════════════════════════════════════════════
          ISO TAB
      ══════════════════════════════════════════════════ */}
      {tab==='iso' && <>

      {/* ══════════════════════════════════════════════════
          2. ISO 13485 CERTIFICATE UPLOAD
      ══════════════════════════════════════════════════ */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">🏭 Upload ISO 13485 Certificate</span>
          <span className="badge badge-green">Issued by accredited certification body</span>
        </div>
        <p style={{fontSize:12,color:'var(--text-secondary)',marginBottom:16}}>
          Upload your ISO 13485 QMS certificate issued by an accredited certification body
          (BSI Group, TÜV SÜD, DNV, etc.). This is required before creating device lots.
        </p>
        {isoMsg && (
          <div className={`alert alert-${isoMsg.type}`} style={{marginBottom:12}}>
            {isoMsg.type==='error'?'⚠':'✓'} {isoMsg.text}
          </div>
        )}
        <form onSubmit={submitISO}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:14}}>
            <div className="form-group"><label>Certificate ID</label>
              <input placeholder="e.g. ISO13485-BSI-2024-001" value={isoForm.certId}
                onChange={e=>setIF('certId',e.target.value)} required/>
            </div>
            <div className="form-group"><label>Certification Body</label>
              <input list="cert-body-list" placeholder="e.g. BSI Group" value={isoForm.certBody}
                onChange={e=>setIF('certBody',e.target.value)} required/>
              <datalist id="cert-body-list">
                {CERT_BODIES.map(b=><option key={b} value={b}/>)}
              </datalist>
            </div>
            <div className="form-group"><label>Certified Facility Name</label>
              <input value={isoForm.facilityName}
                onChange={e=>setIF('facilityName',e.target.value)}
                placeholder="e.g. Stryker Kalamazoo Manufacturing" required/>
            </div>
            <div className="form-group"><label>Facility Address</label>
              <input value={isoForm.facilityAddress}
                onChange={e=>setIF('facilityAddress',e.target.value)}
                placeholder="e.g. 2825 Airview Blvd, Kalamazoo, MI 49002"/>
            </div>
            <div className="form-group" style={{gridColumn:'1/-1'}}><label>Scope of Certification</label>
              <input placeholder="e.g. Design, manufacture, and distribution of orthopedic implants and instruments"
                value={isoForm.scope} onChange={e=>setIF('scope',e.target.value)} required/>
            </div>
            <div className="form-group"><label>Issue Date</label>
              <input type="date" value={isoForm.issueDate} onChange={e=>setIF('issueDate',e.target.value)} required/>
            </div>
            <div className="form-group">
              <label>Expiry Date <span style={{fontSize:10,color:'var(--text-muted)'}}>typically 3 years from issue</span></label>
              <input type="date" min={today} value={isoForm.expiryDate}
                onChange={e=>setIF('expiryDate',e.target.value)} required/>
            </div>
          </div>
          <button type="submit" className="btn btn-primary"
            disabled={isoBusy||!isoForm.certId||!isoForm.certBody||!isoForm.facilityName}>
            {isoBusy
              ? <><span className="spinner" style={{width:14,height:14}}/> Uploading…</>
              : '🏭 Upload Certificate to Blockchain'}
          </button>
        </form>
      </div>

      {/* My ISO Certs */}
      {certs.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              My ISO 13485 Certificates
              <span className="badge badge-green" style={{marginLeft:8}}>{certs.length} active</span>
            </span>
          </div>
          <div className="table-wrap"><table>
            <thead><tr>
              <th>Cert ID</th><th>Cert Body</th><th>Facility</th><th>Scope</th><th>Issue</th><th>Expiry</th>
            </tr></thead>
            <tbody>{certs.map(c=>(
              <tr key={c.certId}>
                <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{c.certId}</td>
                <td style={{fontWeight:600}}>{c.certBody}</td>
                <td style={{fontSize:12}}>{c.facilityName}</td>
                <td style={{fontSize:11,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}
                  title={c.scope}>{c.scope}</td>
                <td style={{fontSize:11}}>{c.issueDate}</td>
                <td style={{fontSize:11,color:c.expiryDate<today?'var(--accent-red)':'inherit'}}>{c.expiryDate}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      )}

      </>} {/* end iso tab */}

      {/* ══════════════════════════════════════════════════
          LOTS TAB — Create lot + QC release + all lots
      ══════════════════════════════════════════════════ */}
      {tab==='lots' && <>

      {/* ══════════════════════════════════════════════════
          3. CREATE DEVICE LOT
      ══════════════════════════════════════════════════ */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">🔬 Create Device Lot</span>
          <span className="badge badge-amber">New lots start in Quarantine — pending QC release</span>
        </div>
        <form onSubmit={submitLot}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:16,marginBottom:14}}>
            <div className="form-group" style={{gridColumn:'span 2'}}><label>Lot ID (internal)</label>
              <input placeholder="e.g. LOT-STK-2024-001" value={lotForm.lotId}
                onChange={e=>setL('lotId',e.target.value)} required/>
            </div>
            <div className="form-group" style={{gridColumn:'span 6'}}><label>Medical Device</label>
              <select value={lotForm.udiDI} onChange={e=>handleDeviceSelect(e.target.value)} required>
                <option value="">— Select device —</option>
                {devices.map(d=><option key={d.udiDI} value={d.udiDI}>{d.deviceName} ({d.udiDI})</option>)}
              </select>
              {devices.length===0 && (
                <span style={{fontSize:11,color:'var(--accent-amber)'}}>⚠ No approved devices — submit a device for FDA approval first</span>
              )}
            </div>
            <div className="form-group" style={{gridColumn:'span 2'}}><label>Lot Number (on label)</label>
              <input placeholder="e.g. 2024LOT001A" value={lotForm.lotNumber}
                onChange={e=>setL('lotNumber',e.target.value)} required/>
            </div>
            <div className="form-group" style={{gridColumn:'span 2'}}><label>Regulatory Clearance</label>
              <select value={lotForm.clearanceNumber} onChange={e=>setL('clearanceNumber',e.target.value)} required>
                <option value="">— Select —</option>
                {clearances.filter(c=>!lotForm.udiDI||c.udiDI===lotForm.udiDI)
                  .map(c=><option key={c.clearanceNumber} value={c.clearanceNumber}>{c.clearanceNumber} ({c.clearanceType})</option>)}
              </select>
            </div>
            <div className="form-group" style={{gridColumn:'span 8'}}><label>ISO 13485 Certificate</label>
              <select value={lotForm.certId} onChange={e=>setL('certId',e.target.value)} required>
                <option value="">— Select —</option>
                {certs.map(c=><option key={c.certId} value={c.certId}>{c.certId} — {c.facilityName} ({c.certBody})</option>)}
              </select>
            </div>
            <div className="form-group" style={{gridColumn:'span 2'}}><label>Manufacturing Date</label>
              <input type="date" max={today} value={lotForm.manufacturingDate}
                onChange={e=>setL('manufacturingDate',e.target.value)} required/>
            </div>
            <div className="form-group" style={{gridColumn:'span 2'}}><label>Expiry Date</label>
              <input type="date" min={today} value={lotForm.expiryDate}
                onChange={e=>setL('expiryDate',e.target.value)} required/>
            </div>
            <div className="form-group" style={{gridColumn:'span 2'}}>
              <label>Sterile Expiry <span style={{fontSize:10,color:'var(--text-muted)'}}>blank = same as expiry</span></label>
              <input type="date" min={today} value={lotForm.sterileExpiryDate}
                onChange={e=>setL('sterileExpiryDate',e.target.value)}/>
            </div>
            <div className="form-group" style={{gridColumn:'span 1'}}><label>Quantity</label>
              <input type="number" min="1" placeholder="e.g. 100" value={lotForm.quantity}
                onChange={e=>setL('quantity',e.target.value)} required/>
            </div>
            <div className="form-group" style={{gridColumn:'span 3'}}><label>Storage Conditions</label>
              <select value={lotForm.storageConditions} onChange={e=>setL('storageConditions',e.target.value)}>
                {storageConditions.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary"
            disabled={busy||!lotForm.clearanceNumber||!lotForm.certId||!lotForm.udiDI}>
            {busy
              ? <><span className="spinner" style={{width:14,height:14}}/> Submitting…</>
              : '+ Create Lot'}
          </button>
        </form>
      </div>

      {/* QC Release — pending lots */}
      {qcLots.length > 0 && (
        <div className="card" style={{borderColor:'rgba(245,158,11,0.4)'}}>
          <div className="card-header">
            <span className="card-title">✅ QC Release</span>
            <span className="badge badge-amber">{qcLots.length} pending</span>
          </div>
          <p style={{fontSize:12,color:'var(--text-secondary)',marginBottom:12}}>
            Lots in quarantine must be released by an authorized QA person before they can be
            consigned to hospitals.
          </p>
          <div className="table-wrap"><table>
            <thead><tr>
              <th>Lot ID</th><th>Device</th><th>Lot #</th><th>Qty</th>
              <th>Expiry</th><th>Sterile Expiry</th><th>Actions</th>
            </tr></thead>
            <tbody>{qcLots.map(l=>(
              <tr key={l.lotId}>
                <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{l.lotId}</td>
                <td>{l.deviceName}</td>
                <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{l.lotNumber}</td>
                <td>{l.quantity}</td>
                <td style={{fontSize:11}}>{l.expiryDate}</td>
                <td style={{fontSize:11}}>{l.sterileExpiryDate}</td>
                <td>
                  <button className="btn btn-primary btn-sm"
                    disabled={releaseBusy[l.lotId]}
                    onClick={()=>{ setQcModal(l.lotId); setQcNotes(''); }}>
                    {releaseBusy[l.lotId]
                      ? <span className="spinner" style={{width:12,height:12}}/>
                      : '✅ QC Release'}
                  </button>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      )}

      </>} {/* end lots tab */}

      {/* ══════════════════════════════════════════════════
          BACKORDER TAB
      ══════════════════════════════════════════════════ */}
      {tab==='backorder' && <>

      {/* ══════════════════════════════════════════════════
          4. FLAG BACKORDER
      ══════════════════════════════════════════════════ */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">⚠ Flag Backorder</span>
          <span className="badge badge-amber">Alerts distributors and hospital supply chain</span>
        </div>
        {backorderMsg && (
          <div className={`alert alert-${backorderMsg.type}`} style={{marginBottom:12}}>
            {backorderMsg.type==='error'?'⚠':'✓'} {backorderMsg.text}
          </div>
        )}
        <form onSubmit={submitBackorder}>
          <div className="form-grid">
            <div className="form-group"><label>Lot</label>
              <select value={backorderForm.lotId} onChange={e=>setB('lotId',e.target.value)} required>
                <option value="">— Select active lot —</option>
                {myLots.filter(l=>l.status==='active').map(l=>(
                  <option key={l.lotId} value={l.lotId}>
                    {l.lotId} — {l.deviceName} (remaining: {l.remainingQuantity})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group"><label>Reason</label>
              <input placeholder="e.g. Raw material shortage — titanium supply disruption"
                value={backorderForm.reason} onChange={e=>setB('reason',e.target.value)} required/>
            </div>
            <div className="form-group">
              <label>Estimated Resupply Date <span style={{fontSize:10,color:'var(--text-muted)'}}>optional</span></label>
              <input type="date" min={today} value={backorderForm.estimatedResupplyDate}
                onChange={e=>setB('estimatedResupplyDate',e.target.value)}/>
            </div>
          </div>
          <button type="submit" className="btn btn-primary"
            disabled={backorderBusy||!backorderForm.lotId||!backorderForm.reason}>
            {backorderBusy
              ? <><span className="spinner" style={{width:14,height:14}}/> Flagging…</>
              : '⚠ Flag Backorder'}
          </button>
        </form>
      </div>

      {/* ══════════════════════════════════════════════════
          5. ALL MY LOTS
      ══════════════════════════════════════════════════ */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            My Lots <span className="badge badge-purple">{myLots.length}</span>
          </span>
          <button className="btn btn-ghost btn-sm" onClick={refresh}>↻ Refresh</button>
        </div>
        <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center'}}>
          <input placeholder="🔍 Search by lot ID, device, lot number, status..."
            value={lotSearch} onChange={e=>setLotSearch(e.target.value)}
            style={{flex:1,maxWidth:360}}/>
          {lotSearch && <>
            <button className="btn btn-ghost btn-sm" onClick={()=>setLotSearch('')}>✕ Clear</button>
            <span style={{fontSize:12,color:'var(--text-muted)',whiteSpace:'nowrap'}}>
              {filteredMyLots.length} of {myLots.length}
            </span>
          </>}
        </div>
        {loading
          ? <div className="loading-overlay"><span className="spinner"/></div>
          : myLots.length===0
            ? <div className="empty-state"><div className="icon">🔬</div><p>No lots created yet</p></div>
            : filteredMyLots.length===0
              ? <div className="empty-state"><div className="icon">🔍</div><p>No lots match "{lotSearch}"</p></div>
            : <div className="table-wrap"><table>
                <thead><tr>
                  <th>Lot ID</th><th>Device</th><th>Lot #</th><th>Qty</th>
                  <th>Remaining</th><th>Mfr Date</th><th>Expiry</th>
                  <th>Sterile Expiry</th><th>Status</th><th>Backorder</th>
                </tr></thead>
                <tbody>{filteredMyLots.map(l=>(
                  <tr key={l.lotId}>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{l.lotId}</td>
                    <td>
                      <div style={{fontWeight:600,fontSize:12}}>{l.deviceName}</div>
                      <div style={{fontSize:10,color:'var(--text-muted)'}}>{l.udiDI}</div>
                    </td>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{l.lotNumber}</td>
                    <td>{l.quantity}</td>
                    <td style={{color:l.remainingQuantity===0?'var(--text-muted)':'var(--accent-green)',fontWeight:600}}>
                      {l.remainingQuantity}
                    </td>
                    <td style={{fontSize:11}}>{l.manufacturingDate}</td>
                    <td style={{fontSize:11,color:l.expiryDate<today?'var(--accent-red)':'inherit'}}>{l.expiryDate}</td>
                    <td style={{fontSize:11}}>{l.sterileExpiryDate}</td>
                    <td>{statusBadge(l.status)}</td>
                    <td>
                      {l.backorder
                        ? <span className="badge badge-amber" title={l.backorderReason}>⚠ Backordered</span>
                        : <span style={{fontSize:11,color:'var(--text-muted)'}}>—</span>}
                    </td>
                  </tr>
                ))}</tbody>
              </table></div>
        }
      </div>

      </>} {/* end backorder tab */}
    </>
  );
}
