import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import ExpiryAlertBanner from '../components/ExpiryAlertBanner';

const PROCEDURE_TYPES = ['Total Hip Arthroplasty','Total Knee Arthroplasty','Total Shoulder Arthroplasty','Spinal Fusion - Lumbar','Spinal Fusion - Cervical','Spinal Fusion - Thoracic','ALIF - Anterior Lumbar Interbody Fusion','TLIF - Transforaminal Lumbar Interbody Fusion','Coronary Artery Bypass Graft (CABG)','Pacemaker Implantation','Defibrillator Implantation','Cardiac Valve Replacement','Stent Placement','Craniotomy','Deep Brain Stimulation','Spinal Cord Stimulator Implantation','Ventricular Shunt Placement','Hernia Repair with Mesh','Breast Reconstruction','Other'];
const BODY_LOCATIONS = ['Left Hip','Right Hip','Left Knee','Right Knee','Left Shoulder','Right Shoulder','Left Ankle','Right Ankle','Cervical Spine (C1-C7)','Thoracic Spine (T1-T12)','Lumbar Spine (L1-L5)','L3/L4','L4/L5','L5/S1','Left Coronary Artery','Right Coronary Artery','Aortic Valve','Mitral Valve','Tricuspid Valve','Pulmonary Valve','Left Ventricle','Right Ventricle','Brain - Left Hemisphere','Brain - Right Hemisphere','Cranium','Abdomen','Pelvis','Left Breast','Right Breast','Other'];
const EXPLANT_REASONS = ['Revision - Component failure','Revision - Loosening','Revision - Instability','Revision - Wear','Infection','Recall','Malfunction','Patient request','Death','Other'];
const DISPOSITIONS = ['Returned to rep','Sent to lab for analysis','Destroyed','Retained by patient'];
const OPENED_NOT_IMPLANTED_REASONS = ['Wrong size','Contaminated','Procedure cancelled','Damaged packaging','Device defect identified','Other'];
const ADVERSE_EVENT_TYPES = ['malfunction','serious_injury','death'];

async function sha256(text) {
  try {
    const data = new TextEncoder().encode(text.trim().toUpperCase());
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
  } catch { return ''; }
}

const STATUS_CONFIG = {
  scheduled:   { badge:'badge-blue',  label:'📋 Scheduled',   bg:'rgba(59,130,246,0.06)' },
  in_progress: { badge:'badge-amber', label:'🔪 In Progress', bg:'rgba(245,158,11,0.06)' },
  completed:   { badge:'badge-green', label:'✓ Completed',    bg:'rgba(16,185,129,0.04)' },
  cancelled:   { badge:'badge-red',   label:'✕ Cancelled',    bg:'rgba(239,68,68,0.04)'  },
};

export default function NursePage() {
  const { user } = useAuth();

  const [tab, setTab] = useState('implant');
  const [consignments, setConsignments] = useState([]);
  const [implants, setImplants] = useState([]);
  const [mriData, setMriData] = useState({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [scanMode, setScanMode] = useState(false);
  const [dbDentists, setDbDentists] = useState([]);
  const [lookups, setLookups] = useState({});
  const [selectedDentist, setSelectedDentist] = useState(null);
  const [deviceCategory, setDeviceCategory] = useState('');
  const [deviceType, setDeviceType] = useState('');

  // Today's Cases
  const [todayCases, setTodayCases] = useState([]);
  const [casesLoading, setCasesLoading] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    implantId: '', consignmentId: '', udiPI: '', lotNumber: '', serialNumber: '',
    patientId: '', dentistId: '', procedureType: '', toothNumber: '',
    procedureDate: today, notes: '', caseId: '',
  });

  const [explantForm, setExplantForm] = useState({
    implantId: '', explantReason: '', explantDate: today, disposition: '', explantedBy: '',
  });

  const [openedForm, setOpenedForm] = useState({ consignmentId: '', quantity: '1', reason: '', disposition: '' });
  const [openedMsg, setOpenedMsg] = useState(null);
  const [openedBusy, setOpenedBusy] = useState(false);

  const [adverseForm, setAdverseForm] = useState({
    eventId: '', implantId: '', eventType: '', eventDate: today, description: '', reportedToFDA: false,
  });
  const [adverseBusy, setAdverseBusy] = useState(false);
  const [adverseMsg, setAdverseMsg] = useState(null);
  const [adverseEvents, setAdverseEvents] = useState([]);
  const [adverseEvtLoading, setAdverseEvtLoading] = useState(false);

  const [mdrModal, setMdrModal] = useState(null);
  const [mdrBusy, setMdrBusy] = useState(false);
  const [mdrDraft, setMdrDraft] = useState('');

  const [expandedImplant, setExpandedImplant] = useState(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchMsg, setSearchMsg] = useState(null);

  const set  = (k,v) => setForm(f=>({...f,[k]:v}));
  const setE = (k,v) => setExplantForm(f=>({...f,[k]:v}));
  const setO = (k,v) => setOpenedForm(f=>({...f,[k]:v}));
  const setAE= (k,v) => setAdverseForm(f=>({...f,[k]:v}));

  const generateImplantId = useCallback(async (practiceId) => {
    try {
      const hospId = practiceId || user?.practiceId || 'HOSP';
      const code = hospId.split(' ')[0].substring(0,3).toUpperCase();
      const all = await api.getImplantsByPractice(hospId);
      const num = (Array.isArray(all) ? all.length : 0) + 1;
      return `${code}-IMP-${String(num).padStart(4,'0')}`;
    } catch { return `IMP-${Date.now().toString(36).toUpperCase()}`; }
  }, [user]);

  const generateEventId = () => {
    const hospCode = (user?.practiceId||'HOSP').split(' ')[0].substring(0,3).toUpperCase();
    return `${hospCode}-AE-${Date.now().toString(36).toUpperCase()}`;
  };

  const loadTodayCases = useCallback(async () => {
    setCasesLoading(true);
    try {
      const data = await api.getCases({ date: today, practiceId: user?.practiceId });
      setTodayCases(Array.isArray(data) ? data : []);
    } catch {}
    finally { setCasesLoading(false); }
  }, [today, user]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [c, s, l] = await Promise.allSettled([
        api.getConsignments({}),
        api.getDentists(user?.practiceId),
        api.getLookupValues(),
      ]);
      if (c.status==='fulfilled') setConsignments((c.value||[]).filter(c=>c.status==='active'));
      if (s.status==='fulfilled') setDbDentists(s.value||[]);
      if (l.status==='fulfilled') {
        const rows = l.value || [];
        if (rows.length>0 && typeof rows[0]==='object' && rows[0].category) {
          const grouped = {};
          for (const item of rows) {
            if (!grouped[item.category]) grouped[item.category] = [];
            grouped[item.category].push(item.value);
          }
          setLookups(grouped);
        }
      }
    } catch {}
    setLoading(false);
  }, [user?.practiceId]);

  useEffect(() => {
    if (!user?.role) return;
    refresh();
    generateImplantId(user?.practiceId).then(id=>set('implantId',id));
    setAdverseForm(f=>({...f, eventId: generateEventId()}));
    loadTodayCases();
  }, [refresh, user?.practiceId, generateImplantId, loadTodayCases]);

  const handleCaseSelect = (caseId) => {
    set('caseId', caseId);
    if (!caseId) return;
    const cs = todayCases.find(c => c.case_id === caseId);
    if (!cs) return;

    // Parse required_devices
    const reqDevices = typeof cs.required_devices === 'string'
      ? JSON.parse(cs.required_devices || '[]')
      : (cs.required_devices || []);

    // Find consignment to auto-select (from pre-pull list or single match by category)
    let autoConsignment = null;
    if (reqDevices.length > 0) {
      const firstDevice = reqDevices[0];
      autoConsignment = consignments.find(c => c.udiDI === firstDevice.udiDI) || null;
    }
    if (!autoConsignment && cs.device_category) {
      const catCons = consignments.filter(c => c.deviceCategory === cs.device_category);
      if (catCons.length === 1) autoConsignment = catCons[0];
    }

    // Set ALL fields at once — do NOT call handleConsignmentSelect (it resets dentist/procedure)
    // Instead set form fields directly, preserving case-populated values
    setForm(f => ({
      ...f,
      caseId,
      dentistId:       cs.dentist_id     || f.dentistId,
      procedureType:   cs.procedure_type  || f.procedureType,
      procedureDate:   cs.procedure_date  || f.procedureDate,
      patientId:       cs.patient_mrn     || f.patientId,
      consignmentId:   autoConsignment?.consignmentId || f.consignmentId,
    }));

    // Set dentist detail card
    if (cs.dentist_id) {
      const found = dbDentists.find(s => s.dentist_id === cs.dentist_id);
      setSelectedDentist(found || null);
    }

    // Set device category + type for consignment filtering
    const cat = autoConsignment?.deviceCategory || cs.device_category || '';
    const typ = autoConsignment?.deviceType || '';
    if (cat) setDeviceCategory(cat);
    if (typ) setDeviceType(typ);
  };

  const handleConsignmentSelect = (consignmentId) => {
    set('consignmentId', consignmentId);
    set('procedureType', ''); set('toothNumber', ''); set('dentistId', '');
    setSelectedDentist(null);
    const c = consignments.find(c=>c.consignmentId===consignmentId);
    if (c) {
      setDeviceCategory(c.deviceCategory||'');
      setDeviceType(c.deviceType||'');
      if (c.lotNumber) set('lotNumber', c.lotNumber);
    } else {
      setDeviceCategory(''); setDeviceType('');
    }
  };

  const parseUDI = (raw) => {
    const lot    = raw.match(/\(10\)([^(]+)/)?.[1] || '';
    const serial = raw.match(/\(21\)([^(]+)/)?.[1] || '';
    if (lot||serial) {
      if (lot) set('lotNumber', lot.trim());
      if (serial) set('serialNumber', serial.trim());
      set('udiPI', raw);
      setMsg({ type:'success', text:`UDI parsed — Lot: ${lot||'—'} · Serial: ${serial||'—'}` });
      setTimeout(()=>setMsg(null), 3000);
    } else { set('udiPI', raw); }
  };

  const submitImplant = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const patientIdHash = await sha256(form.patientId);
      await api.recordImplant({ ...form, patientIdHash });
      setMsg({ type:'success', text:`Implant recorded on blockchain — ID: ${form.implantId}` });
      setTimeout(()=>setMsg(null), 3000);
      if (form.caseId) {
        try { await api.linkImplantToCase(form.caseId, form.implantId); loadTodayCases(); } catch {}
      }
      const nextId = await generateImplantId(user?.practiceId);
      setSelectedDentist(null); setDeviceCategory(''); setDeviceType('');
      setForm({ implantId:nextId, consignmentId:'', udiPI:'', lotNumber:'', serialNumber:'',
        patientId:'', dentistId:'', procedureType:'', toothNumber:'', procedureDate:today, notes:'', caseId:'' });
      refresh();
    } catch (err) { setMsg({ type:'error', text:err.message }); }
    finally { setBusy(false); }
  };

  const submitExplant = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      await api.recordExplant(explantForm.implantId, {
        explantReason:explantForm.explantReason, explantDate:explantForm.explantDate,
        disposition:explantForm.disposition, explantedBy:explantForm.explantedBy,
      });
      setMsg({ type:'success', text:`Explant recorded — Implant ID: ${explantForm.implantId}` });
      setTimeout(()=>setMsg(null), 3000);
      setExplantForm({ implantId:'', explantReason:'', explantDate:today, disposition:'', explantedBy:'' });
    } catch (err) { setMsg({ type:'error', text:err.message }); }
    finally { setBusy(false); }
  };

  const submitOpened = async (e) => {
    e.preventDefault(); setOpenedBusy(true); setOpenedMsg(null);
    try {
      await api.openedNotImplanted(openedForm.consignmentId, {
        quantity:parseInt(openedForm.quantity), reason:openedForm.reason, disposition:openedForm.disposition,
      });
      setOpenedMsg({ type:'success', text:`Recorded ${openedForm.quantity} opened-not-implanted unit(s).` });
      setTimeout(()=>setOpenedMsg(null), 3000);
      setOpenedForm({ consignmentId:'', quantity:'1', reason:'', disposition:'' });
      refresh();
    } catch (err) { setOpenedMsg({ type:'error', text:err.message }); }
    finally { setOpenedBusy(false); }
  };

  const submitAdverseEvent = async (e) => {
    e.preventDefault(); setAdverseBusy(true); setAdverseMsg(null);
    try {
      await api.recordAdverseEvent({
        eventId:adverseForm.eventId, implantId:adverseForm.implantId, eventType:adverseForm.eventType,
        eventDate:adverseForm.eventDate, description:adverseForm.description, reportedToFDA:adverseForm.reportedToFDA,
      });
      setAdverseMsg({ type:'success', text:`Adverse event recorded on blockchain — ID: ${adverseForm.eventId}` });
      setTimeout(()=>setAdverseMsg(null), 3000);
      setAdverseForm({ eventId:generateEventId(), implantId:'', eventType:'', eventDate:today, description:'', reportedToFDA:false });
    } catch (err) { setAdverseMsg({ type:'error', text:err.message }); }
    finally { setAdverseBusy(false); }
  };

  const loadAdverseEvents = async () => {
    setAdverseEvtLoading(true);
    try { setAdverseEvents(await api.getAdverseEvents() || []); } catch {}
    setAdverseEvtLoading(false);
  };

  const draftMDR = async (event) => {
    setMdrModal(event); setMdrDraft(''); setMdrBusy(true);
    try {
      let enriched = { ...event };
      try {
        const history = await api.getImplantHistory(event.implantId);
        if (history?.length>0) {
          const implant = history.find(h=>h.value)?.value || {};
          enriched = { ...enriched, serialNumber:implant.serialNumber||'', procedureDate:implant.procedureDate||'',
            dentistId:implant.dentistId||'', toothNumber:implant.toothNumber||'',
            procedureType:implant.procedureType||'', udiDI:implant.udiDI||event.udiDI||'' };
        }
      } catch {}
      setMdrModal(enriched);
      const resp = await fetch('/api/ai/complete', {
        method:'POST', credentials:'include', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ prompt:`Write ONLY the clinical narrative for Section B.5 of FDA Form 3500A. 150-250 words, factual, third person past tense. Device: ${enriched.deviceName}, Event: ${enriched.eventType}, Date: ${enriched.eventDate}, Practice: ${enriched.practiceId}. Description: ${enriched.description||'N/A'}`, maxTokens:400 }),
      });
      const data = await resp.json();
      setMdrDraft(data.text||'');
    } catch { setMdrDraft(''); }
    finally { setMdrBusy(false); }
  };

  const printMDR = async (event, narrative) => {
    if (!event) return;
    try {
      const resp = await fetch('/api/ai/mdr-pdf', {
        method:'POST', credentials:'include', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ narrative, eventDate:event.eventDate, today:new Date().toISOString().split('T')[0],
          deviceName:event.deviceName, lotNumber:event.lotNumber, practiceId:event.practiceId,
          eventId:event.eventId, eventType:event.eventType, reportedToFDA:event.reportedToFDA,
          implantId:event.implantId, description:event.description,
          manufacturerId:event.manufacturerId||'', udiDI:event.udiDI||'',
          serialNumber:event.serialNumber||'', expiryDate:event.expiryDate||'',
          procedureDate:event.procedureDate||'', modelNum:event.modelNum||'' }),
      });
      if (!resp.ok) throw new Error((await resp.json().catch(()=>({}))).error||'PDF failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const win = window.open(url,'_blank');
      if (!win) { const a=document.createElement('a'); a.href=url; a.download=`FDA-3500A-${event.eventId}.pdf`; a.click(); }
      setTimeout(()=>URL.revokeObjectURL(url), 300000);
    } catch (err) { alert('Could not generate PDF: '+err.message); }
  };

  const searchPatient = async () => {
    if (!patientSearch.trim()) return;
    setSearchMsg(null); setLoading(true);
    try {
      const hash = await sha256(patientSearch.trim());
      const results = await api.getImplantsByPatientHash(hash);
      setImplants(results||[]);
      setSearchMsg({
        type: results?.length>0 ? 'success' : 'amber',
        text: results?.length>0
          ? `Found ${results.length} implant post${results.length!==1?'s':''} for ${patientSearch}`
          : `No implant posts found for ${patientSearch}`,
      });
      if (results?.length>0) {
        const uniqueUDIs = [...new Set(results.map(i=>i.udiDI).filter(Boolean))];
        const mriMap = {};
        await Promise.all(uniqueUDIs.map(async udiDI => {
          try { const device = await api.getDevice(encodeURIComponent(udiDI)); mriMap[udiDI]=device?.mriSafe||'conditional'; }
          catch { mriMap[udiDI]='conditional'; }
        }));
        setMriData(mriMap);
      } else { setMriData({}); }
    } catch (err) { setSearchMsg({ type:'error', text:err.message }); }
    finally { setLoading(false); }
  };

  const generateImplantCard = (patientId, implantList, mriMap={}) => {
    const filtered = implantList.filter(i=>(!dateFrom||i.procedureDate>=dateFrom)&&(!dateTo||i.procedureDate<=dateTo));
    if (!filtered.length) return;
    const verifyBase = window.location.origin+'/verify';
    const generatedDate = new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
    let mriAlertHtml = '';
    const activeImplants = filtered.filter(i=>i.status==='implanted');
    if (activeImplants.length>0 && Object.keys(mriMap).length>0) {
      const statuses = activeImplants.map(i=>mriMap[i.udiDI]||'conditional');
      const worst = statuses.includes('unsafe')?'unsafe':statuses.includes('conditional')?'conditional':'safe';
      const mriCfg = {
        unsafe:      {bg:'#fee2e2',border:'#ef4444',color:'#991b1b',icon:'🔴',title:'MRI UNSAFE',sub:'⚠ ONE OR MORE IMPLANTS ARE MRI UNSAFE.'},
        conditional: {bg:'#fef9c3',border:'#f59e0b',color:'#854d0e',icon:'🟡',title:'MRI CONDITIONAL',sub:'Verify device-specific MRI conditions before scanning.'},
        safe:        {bg:'#dcfce7',border:'#10b981',color:'#166534',icon:'✅',title:'MRI SAFE',sub:'All active implants are MRI safe.'},
      }[worst];
      const pills = activeImplants.map(i=>{
        const mri=mriMap[i.udiDI]||'conditional';
        return `<div style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:#fff;border-radius:20px;border:1px solid #e0e0e0;font-size:12px;margin:3px"><span>${i.deviceName}</span><span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:${mri==='unsafe'?'#fee2e2':mri==='conditional'?'#fef9c3':'#dcfce7'};color:${mri==='unsafe'?'#991b1b':mri==='conditional'?'#854d0e':'#166534'}">${mri.toUpperCase()}</span></div>`;
      }).join('');
      mriAlertHtml = `<div style="border-radius:8px;padding:16px 20px;margin-bottom:24px;border:2px solid ${mriCfg.border};background:${mriCfg.bg}"><div style="font-size:20px;font-weight:800;color:${mriCfg.color};margin-bottom:6px">${mriCfg.icon} ${mriCfg.title}</div><div style="font-size:13px;color:${mriCfg.color};margin-bottom:10px">${mriCfg.sub}</div><div>${pills}</div></div>`;
    }
    const deviceRows = filtered.map(i=>`<div style="border:1px solid #e0e0e0;border-radius:8px;padding:16px;margin-bottom:16px;border-left:4px solid #ff8000"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div style="font-size:15px;font-weight:700">${i.deviceName}</div><span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:99px;background:${i.status==='implanted'?'#dcfce7':'#fef9c3'};color:${i.status==='implanted'?'#166534':'#854d0e'}">${i.status.toUpperCase()}</span></div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px 16px"><div><div style="font-size:10px;text-transform:uppercase;color:#999;margin-bottom:2px">UDI-DI</div><div style="font-family:monospace;font-size:12px">${i.udiDI||'—'}</div></div><div><div style="font-size:10px;text-transform:uppercase;color:#999;margin-bottom:2px">Lot Number</div><div style="font-family:monospace;font-size:12px">${i.lotNumber||'—'}</div></div><div><div style="font-size:10px;text-transform:uppercase;color:#999;margin-bottom:2px">Tooth Number</div><div style="font-size:13px">${i.toothNumber}</div></div><div><div style="font-size:10px;text-transform:uppercase;color:#999;margin-bottom:2px">Procedure Date</div><div style="font-size:13px">${i.procedureDate}</div></div><div><div style="font-size:10px;text-transform:uppercase;color:#999;margin-bottom:2px">Practice</div><div style="font-size:13px">${i.practiceId}</div></div><div><div style="font-size:10px;text-transform:uppercase;color:#999;margin-bottom:2px">Dentist</div><div style="font-size:13px">${i.dentistId||'—'}</div></div></div><div style="margin-top:10px;font-size:10px;color:#999;font-family:monospace">Verify: ${verifyBase}?di=${encodeURIComponent(i.udiDI||'')}</div></div>`).join('');
    const html = `<!DOCTYPE html><html><head><title>Implant Card — ${patientId}</title><style>body{font-family:system-ui,sans-serif;padding:32px;max-width:800px;margin:0 auto}@media print{.no-print{display:none}}</style><script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script></head><body><button class="no-print" onclick="window.print()" style="margin-bottom:24px;padding:10px 20px;background:#ff8000;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer">🖨 Print / Save as PDF</button><h2 style="margin-bottom:4px">ImplantChain — Patient Implant Card</h2><div style="color:#666;font-size:12px;margin-bottom:20px">Generated: ${generatedDate} · Patient MRN: ${patientId} · ${filtered.length} record(s)</div>${mriAlertHtml}${deviceRows}<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e0e0e0;font-size:11px;color:#999">All records immutably stored on Hyperledger Fabric blockchain · implantchain.dapparchitects.com</div></body></html>`;
    const blob = new Blob([html],{type:'text/html'});
    const url = URL.createObjectURL(blob);
    window.open(url,'_blank');
  };

  const switchTab = (t) => {
    setTab(t); setMsg(null);
    if (t==='adverse' && adverseEvents.length===0) loadAdverseEvents();
    if (t==='cases') loadTodayCases();
  };

  const tabStyle = t => ({
    padding:'8px 18px', borderRadius:'var(--radius-sm)', cursor:'pointer',
    fontSize:13, fontWeight:600, border:'none',
    background: tab===t ? 'var(--accent-amber)' : 'transparent',
    color: tab===t ? '#fff' : 'var(--text-secondary)',
  });

  const selectedConsignment = consignments.find(c=>c.consignmentId===form.consignmentId);
  const getAvailable = c => c.quantity-(c.usedQuantity||0)-(c.openedNotUsed||0)-(c.returnedQuantity||0);

  return (
    <>
      <div className="page-header">
        <h2>🩺 Dental Assistant Portal</h2>
        <p>Record implants at point of use — scan UDI barcode or enter manually</p>
      </div>

      <ExpiryAlertBanner />

      <div style={{display:'flex',gap:4,marginBottom:20,background:'var(--bg-card)',
        padding:4,borderRadius:'var(--radius-md)',width:'fit-content',
        border:'1px solid var(--border)',flexWrap:'wrap'}}>
        <button style={tabStyle('implant')}   onClick={()=>switchTab('implant')}>💊 Record Implant Post</button>
        <button style={tabStyle('explant')}   onClick={()=>switchTab('explant')}>↩ Record Explant</button>
        <button style={tabStyle('opened')}    onClick={()=>switchTab('opened')}>📋 Opened/Not Used</button>
        <button style={tabStyle('adverse')}   onClick={()=>switchTab('adverse')}>⚠ Adverse Event</button>
        <button style={tabStyle('patient')}   onClick={()=>switchTab('patient')}>👤 Patient Lookup</button>
        <button style={tabStyle('inventory')} onClick={()=>switchTab('inventory')}>📦 Inventory</button>
        <button style={tabStyle('cases')} onClick={()=>switchTab('cases')}>
          📅 Today's Cases
          {todayCases.filter(c=>c.status==='scheduled'||c.status==='in_progress').length>0 &&
            <span className="badge badge-amber" style={{marginLeft:6}}>
              {todayCases.filter(c=>c.status==='scheduled'||c.status==='in_progress').length}
            </span>}
        </button>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type}`} style={{marginBottom:12}}>
          {msg.type==='error'?'⚠':msg.type==='success'?'✓':'ℹ'} {msg.text}
        </div>
      )}

      {/* ══ RECORD IMPLANT ══ */}
      {tab==='implant' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">💊 Record Implant Post</span>
            <button onClick={()=>setScanMode(s=>!s)} className={`btn btn-sm ${scanMode?'btn-primary':'btn-ghost'}`}>
              {scanMode ? '📷 Scan Mode ON' : '📷 Scan Mode'}
            </button>
          </div>

          {scanMode && (
            <div style={{padding:'14px 16px',background:'var(--bg-secondary)',borderRadius:'var(--radius-md)',
              border:'1px solid var(--accent-amber)',marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:600,color:'var(--accent-amber)',marginBottom:8}}>📷 UDI Barcode Scanner</div>
              <input autoFocus placeholder="Scan or type UDI-PI: (10)LOT123(21)SN456(17)261231"
                style={{width:'100%',fontFamily:'var(--font-mono)',fontSize:13}}
                onKeyDown={e=>{ if(e.key==='Enter'){ parseUDI(e.target.value); e.target.value=''; } }}/>
              <div style={{fontSize:11,color:'var(--text-muted)',marginTop:6}}>Press Enter after scanning · GS1 format auto-parses</div>
            </div>
          )}

          <form onSubmit={submitImplant}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:16,marginBottom:14}}>

              {/* Case selector — top of form */}
              <div className="form-group" style={{gridColumn:'span 10'}}>
                <label style={{fontSize:13,fontWeight:700,color:'var(--accent-amber)'}}>
                  📅 Link to OR Case
                  <span style={{fontSize:11,fontWeight:400,color:'var(--text-muted)',marginLeft:8}}>
                    optional — auto-populates dentist, procedure, date and patient MRN
                  </span>
                </label>
                <select value={form.caseId} onChange={e=>handleCaseSelect(e.target.value)}
                  style={{borderColor:form.caseId?'var(--accent-amber)':'var(--border)'}}>
                  <option value="">— No case / fill manually —</option>
                  {todayCases.filter(cs=>cs.status!=='completed'&&cs.status!=='cancelled').map(cs=>(
                    <option key={cs.case_id} value={cs.case_id}>
                      {cs.case_id} · {cs.procedure_type||'—'} · {cs.dentist_id||'—'}{cs.or_room?' · OR '+cs.or_room:''}
                    </option>
                  ))}
                </select>
                {form.caseId && (() => {
                  const cs = todayCases.find(c=>c.case_id===form.caseId);
                  return cs ? (
                    <div style={{marginTop:6,padding:'8px 12px',background:'rgba(245,158,11,0.08)',
                      borderRadius:'var(--radius-sm)',border:'1px solid rgba(245,158,11,0.3)',
                      fontSize:12,color:'var(--text-secondary)',display:'flex',gap:16,flexWrap:'wrap'}}>
                      <span>📅 {cs.procedure_date}</span>
                      {cs.or_room && <span>🚪 OR {cs.or_room}</span>}
                      {cs.procedure_type && <span>🔬 {cs.procedure_type}</span>}
                      {cs.dentist_id && <span>👨‍⚕️ {cs.dentist_id}</span>}
                      {cs.patient_mrn && <span>🏷 Pre-filled MRN: {cs.patient_mrn}</span>}
                    </div>
                  ) : null;
                })()}
              </div>

              <div className="form-group" style={{gridColumn:'span 2'}}>
                <label>Implant Record ID</label>
                <input value={form.implantId} onChange={e=>set('implantId',e.target.value)} required style={{fontFamily:'var(--font-mono)'}}/>
              </div>
              <div className="form-group" style={{gridColumn:'span 8'}}>
                <label>Consignment (Device at this Practice)</label>
                <select value={form.consignmentId} onChange={e=>handleConsignmentSelect(e.target.value)} required>
                  <option value="">— Select consignment —</option>
                  {consignments.map(c=>(
                    <option key={c.consignmentId} value={c.consignmentId}>
                      {c.consignmentId} · {c.deviceName} · avail: {getAvailable(c)}
                    </option>
                  ))}
                </select>
                {selectedConsignment && (
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:3}}>
                    {selectedConsignment.deviceCategory} · {selectedConsignment.deviceType} · Lot: {selectedConsignment.lotNumber} · Sterile exp: {selectedConsignment.sterileExpiryDate} · 📍 {selectedConsignment.location}
                  </div>
                )}
              </div>

              <div className="form-group" style={{gridColumn:'span 4'}}>
                <label>UDI-PI (Production Identifier)</label>
                <input placeholder="(10)LOT123(21)SN456(17)261231" value={form.udiPI}
                  onChange={e=>set('udiPI',e.target.value)}
                  onBlur={e=>{ if(e.target.value) parseUDI(e.target.value); }}
                  style={{fontFamily:'var(--font-mono)',fontSize:12}}/>
                <span style={{fontSize:10,color:'var(--text-muted)'}}>Scan or type — lot/serial auto-fill on tab</span>
              </div>
              <div className="form-group" style={{gridColumn:'span 3'}}>
                <label>Lot Number</label>
                <input placeholder="e.g. 2024LOT001A" value={form.lotNumber} onChange={e=>set('lotNumber',e.target.value)} style={{fontFamily:'var(--font-mono)'}}/>
              </div>
              <div className="form-group" style={{gridColumn:'span 3'}}>
                <label>Serial Number <span style={{fontSize:10,color:'var(--text-muted)'}}>if tracked</span></label>
                <input placeholder="e.g. SN98765" value={form.serialNumber} onChange={e=>set('serialNumber',e.target.value)} style={{fontFamily:'var(--font-mono)'}}/>
              </div>

              <div className="form-group" style={{gridColumn:'span 3'}}>
                <label>Patient MRN</label>
                <input placeholder="e.g. MRN-123456" value={form.patientId} onChange={e=>set('patientId',e.target.value)} required/>
                <span style={{fontSize:10,color:'var(--text-muted)'}}>Hashed before storing on ledger</span>
              </div>
              <div className="form-group" style={{gridColumn:'span 3'}}>
                <label>Dentist</label>
                <input list="dentist-list" placeholder="Type dentist ID..." value={form.dentistId}
                  onChange={e=>{ set('dentistId',e.target.value); const found=dbDentists.find(s=>s.dentist_id===e.target.value); setSelectedDentist(found||null); }}/>
                <datalist id="dentist-list">
                  {dbDentists.filter(s=>{
                    if (!deviceCategory||!s.specialty) return true;
                    const cat=deviceCategory.toLowerCase(), spec=s.specialty.toLowerCase();
                    if (cat==='orthopedic') return spec.includes('orthopedic');
                    if (cat==='cardiac') return spec.includes('cardiac');
                    if (cat==='neurosurgery') return spec.includes('neuro');
                    if (cat==='general_surgery') return spec.includes('general');
                    return true;
                  }).map(s=><option key={s.dentist_id} value={s.dentist_id}/>)}
                </datalist>
                {selectedDentist && (
                  <div style={{marginTop:6,padding:'8px 12px',background:'var(--bg-secondary)',
                    borderRadius:'var(--radius-sm)',border:'1px solid var(--accent-blue)',
                    fontSize:12,color:'var(--text-secondary)',display:'flex',gap:16,flexWrap:'wrap'}}>
                    <span>👤 <strong style={{color:'var(--text-primary)'}}>{selectedDentist.full_name}</strong></span>
                    <span>🏥 {(selectedDentist.practices||[]).join(', ')||'—'}</span>
                    <span>🔬 {selectedDentist.specialty||'—'}</span>
                    {selectedDentist.npi && <span>NPI: {selectedDentist.npi}</span>}
                  </div>
                )}
              </div>
              <div className="form-group" style={{gridColumn:'span 4'}}>
                <label>Procedure Date</label>
                <input type="date" max={today} value={form.procedureDate} onChange={e=>set('procedureDate',e.target.value)} required/>
              </div>

              <div className="form-group" style={{gridColumn:'span 5'}}>
                <label>Procedure Type</label>
                <input list="procedure-list" value={form.procedureType} onChange={e=>set('procedureType',e.target.value)}
                  placeholder={deviceCategory?'Select procedure…':'Select consignment first…'} required/>
                <datalist id="procedure-list">
                  {(deviceCategory&&lookups[`procedure_${deviceCategory}`]?lookups[`procedure_${deviceCategory}`]:PROCEDURE_TYPES).map(p=><option key={p} value={p}/>)}
                </datalist>
              </div>
              <div className="form-group" style={{gridColumn:'span 5'}}>
                <label>Tooth Number</label>
                <input list="location-list" value={form.toothNumber} onChange={e=>set('toothNumber',e.target.value)}
                  placeholder={deviceCategory?'Select location…':'Select consignment first…'} required/>
                <datalist id="location-list">
                  {(()=>{
                    const cons=consignments.find(c=>c.consignmentId===form.consignmentId);
                    const deviceLocs=cons?.toothNumbers?.length>0?cons.toothNumbers:null;
                    const typeKey=`location_type_${deviceType}`, catKey=`location_${deviceCategory}`;
                    const list=deviceLocs?deviceLocs:deviceType&&lookups[typeKey]?lookups[typeKey]:deviceCategory&&lookups[catKey]?lookups[catKey]:BODY_LOCATIONS;
                    return list.map(l=><option key={l} value={l}/>);
                  })()}
                </datalist>
              </div>


              <div className="form-group" style={{gridColumn:'span 10'}}>
                <label>Surgical Notes <span style={{fontSize:10,color:'var(--text-muted)'}}>optional</span></label>
                <textarea value={form.notes} onChange={e=>set('notes',e.target.value)}
                  placeholder="e.g. Patient tolerated procedure well. No complications noted."
                  rows={2} style={{width:'100%',background:'var(--bg-secondary)',border:'1px solid var(--border)',
                    borderRadius:'var(--radius-sm)',color:'var(--text-primary)',padding:'10px 12px',
                    fontSize:13,fontFamily:'inherit',resize:'vertical'}}/>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{background:'var(--accent-amber)'}}
              disabled={busy||!form.consignmentId||!form.patientId||!form.procedureType||!form.toothNumber}>
              {busy?<><span className="spinner" style={{width:14,height:14}}/> Recording…</>:'✓ Record Implant Post on Blockchain'}
            </button>
          </form>
        </div>
      )}

      {/* ══ RECORD EXPLANT ══ */}
      {tab==='explant' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">↩ Record Explant</span>
            <span className="badge badge-amber">Device removed from patient</span>
          </div>
          <form onSubmit={submitExplant}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:16,marginBottom:14}}>
              <div className="form-group" style={{gridColumn:'span 4'}}>
                <label>Implant Record ID</label>
                <input placeholder="e.g. MEM-IMP-0001" value={explantForm.implantId} onChange={e=>setE('implantId',e.target.value)} required style={{fontFamily:'var(--font-mono)'}}/>
              </div>
              <div className="form-group" style={{gridColumn:'span 3'}}>
                <label>Explanting Dentist</label>
                <input list="explant-dentist-list" placeholder="Type dentist ID..." value={explantForm.explantedBy} onChange={e=>setE('explantedBy',e.target.value)}/>
                <datalist id="explant-dentist-list">{dbDentists.map(s=><option key={s.dentist_id} value={s.dentist_id}/>)}</datalist>
              </div>
              <div className="form-group" style={{gridColumn:'span 3'}}>
                <label>Explant Date</label>
                <input type="date" max={today} value={explantForm.explantDate} onChange={e=>setE('explantDate',e.target.value)} required/>
              </div>
              <div className="form-group" style={{gridColumn:'span 3'}}>
                <label>Device Disposition</label>
                <select value={explantForm.disposition} onChange={e=>setE('disposition',e.target.value)} required>
                  <option value="">— Select —</option>
                  {(lookups['disposition']||DISPOSITIONS).map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group" style={{gridColumn:'span 10'}}>
                <label>Explant Reason</label>
                <input list="reason-list" value={explantForm.explantReason} onChange={e=>setE('explantReason',e.target.value)} placeholder="Type or select reason..." required/>
                <datalist id="reason-list">{(lookups['explant_reason']||EXPLANT_REASONS).map(r=><option key={r} value={r}/>)}</datalist>
              </div>
            </div>
            <button type="submit" className="btn btn-primary"
              disabled={busy||!explantForm.implantId||!explantForm.explantReason||!explantForm.disposition}>
              {busy?<><span className="spinner" style={{width:14,height:14}}/> Recording…</>:'↩ Record Explant on Blockchain'}
            </button>
          </form>
        </div>
      )}

      {/* ══ OPENED/NOT IMPLANTED ══ */}
      {tab==='opened' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">📋 Device Opened / Not Implanted</span>
            <span className="badge badge-amber">Sterility compromised — cannot return to inventory</span>
          </div>
          {openedMsg && <div className={`alert alert-${openedMsg.type}`} style={{marginBottom:12}}>{openedMsg.type==='error'?'⚠':'✓'} {openedMsg.text}</div>}
          <form onSubmit={submitOpened}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:16,marginBottom:14}}>
              <div className="form-group" style={{gridColumn:'span 6'}}>
                <label>Consignment</label>
                <select value={openedForm.consignmentId} onChange={e=>setO('consignmentId',e.target.value)} required>
                  <option value="">— Select consignment —</option>
                  {consignments.map(c=><option key={c.consignmentId} value={c.consignmentId}>{c.consignmentId} · {c.deviceName} · avail: {getAvailable(c)}</option>)}
                </select>
              </div>
              <div className="form-group" style={{gridColumn:'span 2'}}>
                <label>Quantity</label>
                <input type="number" min="1" value={openedForm.quantity} onChange={e=>setO('quantity',e.target.value)} required/>
              </div>
              <div className="form-group" style={{gridColumn:'span 2'}}>
                <label>Disposition</label>
                <select value={openedForm.disposition} onChange={e=>setO('disposition',e.target.value)} required>
                  <option value="">— Select —</option>
                  <option value="destroyed">Destroyed</option>
                  <option value="returned_to_rep_for_analysis">Returned to rep for analysis</option>
                </select>
              </div>
              <div className="form-group" style={{gridColumn:'span 10'}}>
                <label>Reason</label>
                <input list="opened-reason-list" value={openedForm.reason} onChange={e=>setO('reason',e.target.value)} placeholder="Type or select reason..." required/>
                <datalist id="opened-reason-list">{(lookups['opened_not_implanted_reason']||OPENED_NOT_IMPLANTED_REASONS).map(r=><option key={r} value={r}/>)}</datalist>
              </div>
            </div>
            <button type="submit" className="btn btn-primary"
              disabled={openedBusy||!openedForm.consignmentId||!openedForm.reason||!openedForm.disposition}>
              {openedBusy?<><span className="spinner" style={{width:14,height:14}}/> Recording…</>:'📋 Record Opened/Not Implanted'}
            </button>
          </form>
        </div>
      )}

      {/* ══ ADVERSE EVENT ══ */}
      {tab==='adverse' && (
        <>
          <div className="card">
            <div className="card-header">
              <span className="card-title">⚠ Adverse Event Report (MDR)</span>
              <span className="badge badge-red">FDA 21 CFR Part 803</span>
            </div>
            <div className="alert alert-info" style={{marginBottom:16}}>
              ℹ Record device-related adverse events. FDA requires mandatory reporting within 30 days.
            </div>
            {adverseMsg && <div className={`alert alert-${adverseMsg.type}`} style={{marginBottom:12}}>{adverseMsg.type==='error'?'⚠':'✓'} {adverseMsg.text}</div>}
            <form onSubmit={submitAdverseEvent}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:16,marginBottom:14}}>
                <div className="form-group" style={{gridColumn:'span 3'}}>
                  <label>Event ID</label>
                  <input value={adverseForm.eventId} onChange={e=>setAE('eventId',e.target.value)} required style={{fontFamily:'var(--font-mono)'}}/>
                </div>
                <div className="form-group" style={{gridColumn:'span 4'}}>
                  <label>Implant Record ID</label>
                  <input placeholder="e.g. MEM-IMP-0001" value={adverseForm.implantId} onChange={e=>setAE('implantId',e.target.value)} required style={{fontFamily:'var(--font-mono)'}}/>
                </div>
                <div className="form-group" style={{gridColumn:'span 3'}}>
                  <label>Event Date</label>
                  <input type="date" max={today} value={adverseForm.eventDate} onChange={e=>setAE('eventDate',e.target.value)} required/>
                </div>
                <div className="form-group" style={{gridColumn:'span 4'}}>
                  <label>Event Type</label>
                  <select value={adverseForm.eventType} onChange={e=>setAE('eventType',e.target.value)} required>
                    <option value="">— Select event type —</option>
                    <option value="malfunction">⚙ Malfunction</option>
                    <option value="serious_injury">🚨 Serious Injury</option>
                    <option value="death">💀 Death</option>
                  </select>
                </div>
                <div className="form-group" style={{gridColumn:'span 6'}}>
                  <label>Reported to FDA</label>
                  <div style={{display:'flex',gap:16,marginTop:8}}>
                    <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:13}}>
                      <input type="radio" name="reportedToFDA" checked={adverseForm.reportedToFDA===true} onChange={()=>setAE('reportedToFDA',true)}/>
                      Yes — MedWatch report filed
                    </label>
                    <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:13}}>
                      <input type="radio" name="reportedToFDA" checked={adverseForm.reportedToFDA===false} onChange={()=>setAE('reportedToFDA',false)}/>
                      No — not yet reported
                    </label>
                  </div>
                </div>
                <div className="form-group" style={{gridColumn:'span 10'}}>
                  <label>Event Description</label>
                  <textarea value={adverseForm.description} onChange={e=>setAE('description',e.target.value)}
                    placeholder="Describe the adverse event in detail..." rows={4} required
                    style={{width:'100%',background:'var(--bg-secondary)',border:'1px solid var(--border)',
                      borderRadius:'var(--radius-sm)',color:'var(--text-primary)',padding:'10px 12px',fontSize:13,fontFamily:'inherit',resize:'vertical'}}/>
                </div>
              </div>
              <button type="submit" className="btn btn-danger"
                disabled={adverseBusy||!adverseForm.implantId||!adverseForm.eventType||!adverseForm.description}>
                {adverseBusy?<><span className="spinner" style={{width:14,height:14}}/> Recording…</>:'⚠ Record Adverse Event on Blockchain'}
              </button>
            </form>
          </div>

          {/* MDR Modal */}
          {mdrModal && (
            <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:24}} onClick={()=>{ if(!mdrBusy) setMdrModal(null); }}>
              <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:28,width:'min(520px,100%)'}} onClick={e=>e.stopPropagation()}>
                <h3 style={{marginBottom:4}}>🤖 AI MDR Draft — {mdrModal.eventId}</h3>
                <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:16}}>{mdrModal.deviceName} · {mdrModal.eventType?.replace(/_/g,' ')} · {mdrModal.eventDate}</div>
                {mdrBusy
                  ? <div style={{display:'flex',alignItems:'center',gap:12,padding:'24px 0',color:'var(--text-muted)'}}><span className="spinner" style={{width:20,height:20}}/> Generating FDA 3500A narrative…</div>
                  : <>
                      <div className="alert alert-info" style={{marginBottom:16,fontSize:12}}>ℹ AI pre-fills known fields. Opens in new tab — complete and print/save as PDF.</div>
                      <div style={{display:'flex',gap:8}}>
                        <button className="btn btn-primary" style={{flex:1}} onClick={()=>printMDR(mdrModal,mdrDraft)}>⬇ Download Pre-filled FDA 3500A PDF</button>
                        <button className="btn btn-ghost" onClick={()=>setMdrModal(null)}>Close</button>
                      </div>
                    </>
                }
              </div>
            </div>
          )}

          <div className="card" style={{marginTop:16}}>
            <div className="card-header">
              <span className="card-title">📋 Recorded Adverse Events <span className="badge badge-red" style={{marginLeft:8}}>{adverseEvents.length}</span></span>
              <button className="btn btn-ghost btn-sm" onClick={loadAdverseEvents}>{adverseEvtLoading?<span className="spinner" style={{width:12,height:12}}/>:'↻ Refresh'}</button>
            </div>
            {adverseEvents.length===0
              ? <div className="empty-state" style={{padding:'16px 0'}}><div className="icon">📋</div><p>No adverse events recorded for your practice yet</p></div>
              : <div className="table-wrap"><table>
                  <thead><tr><th>Event ID</th><th>Implant ID</th><th>Device</th><th>Type</th><th>Date</th><th>Practice</th><th>Reported to FDA</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>{adverseEvents.map(e=>(
                    <tr key={e.eventId}>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{e.eventId}</td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{e.implantId}</td>
                      <td style={{fontWeight:600,fontSize:12}}>{e.deviceName}</td>
                      <td><span className={`badge ${e.eventType==='death'?'badge-red':e.eventType==='serious_injury'?'badge-amber':'badge-blue'}`}>{e.eventType?.replace(/_/g,' ')}</span></td>
                      <td style={{fontSize:11}}>{e.eventDate}</td>
                      <td style={{fontSize:11}}>🏥 {e.practiceId}</td>
                      <td><span className={`badge ${e.reportedToFDA?'badge-green':'badge-red'}`}>{e.reportedToFDA?'✓ Yes':'✕ No'}</span></td>
                      <td><span className={`badge ${e.status==='open'?'badge-amber':'badge-green'}`}>{e.status}</span></td>
                      <td><button className="btn btn-ghost btn-sm" style={{color:'var(--accent-purple)',borderColor:'var(--accent-purple)',whiteSpace:'nowrap'}} onClick={()=>draftMDR(e)}>🤖 Draft MDR</button></td>
                    </tr>
                  ))}</tbody>
                </table></div>
            }
          </div>
        </>
      )}

      {/* ══ PATIENT LOOKUP ══ */}
      {tab==='patient' && (
        <div className="card">
          <div className="card-header"><span className="card-title">👤 Patient Implant Lookup</span></div>
          <div style={{display:'flex',gap:12,marginBottom:16,alignItems:'flex-end'}}>
            <div className="form-group" style={{flex:1,marginBottom:0}}>
              <label>Patient MRN</label>
              <input placeholder="e.g. MRN-123456" value={patientSearch} onChange={e=>setPatientSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&searchPatient()}/>
            </div>
            <button className="btn btn-primary" onClick={searchPatient} disabled={loading||!patientSearch.trim()}>
              {loading?<span className="spinner" style={{width:14,height:14}}/>:'🔍 Search'}
            </button>
          </div>
          {searchMsg && <div className={`alert alert-${searchMsg.type}`} style={{marginBottom:12}}>{searchMsg.text}</div>}

          {implants.length>0 && Object.keys(mriData).length>0 && (()=>{
            const statuses=Object.values(mriData);
            const worst=statuses.includes('unsafe')?'unsafe':statuses.includes('conditional')?'conditional':'safe';
            const cfg={
              unsafe:      {bg:'rgba(239,68,68,0.12)',border:'rgba(239,68,68,0.4)',icon:'🔴',color:'var(--accent-red)',title:'MRI UNSAFE',sub:'One or more implants must NEVER be placed in an MRI scanner.'},
              conditional: {bg:'rgba(245,158,11,0.10)',border:'rgba(245,158,11,0.4)',icon:'🟡',color:'var(--accent-amber)',title:'MRI CONDITIONAL',sub:'One or more implants have MRI conditions. Verify before scanning.'},
              safe:        {bg:'rgba(16,185,129,0.08)',border:'rgba(16,185,129,0.3)',icon:'✅',color:'var(--accent-green)',title:'MRI SAFE',sub:'All implants are MRI safe.'},
            }[worst];
            return (
              <div style={{padding:'14px 18px',background:cfg.bg,border:`2px solid ${cfg.border}`,borderRadius:'var(--radius-md)',marginBottom:14}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                  <span style={{fontSize:22}}>{cfg.icon}</span>
                  <span style={{fontSize:16,fontWeight:800,color:cfg.color}}>{cfg.title}</span>
                </div>
                <div style={{fontSize:13,color:'var(--text-primary)',marginBottom:8}}>{cfg.sub}</div>
              </div>
            );
          })()}

          {implants.length>0 && (
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div style={{display:'flex',gap:10,alignItems:'center'}}>
                <span style={{fontSize:12,color:'var(--text-muted)'}}>Filter by date:</span>
                <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{width:140,fontSize:12}}/>
                <span style={{color:'var(--text-muted)'}}>—</span>
                <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{width:140,fontSize:12}}/>
                {(dateFrom||dateTo) && <button className="btn btn-ghost btn-sm" onClick={()=>{setDateFrom('');setDateTo('');}}>✕ Clear</button>}
              </div>
              <button className="btn btn-ghost btn-sm" style={{color:'var(--accent-cyan)',borderColor:'var(--accent-cyan)'}}
                onClick={()=>generateImplantCard(patientSearch,implants,mriData)}>
                📄 Print Implant Card
              </button>
            </div>
          )}

          {implants.filter(i=>(!dateFrom||i.procedureDate>=dateFrom)&&(!dateTo||i.procedureDate<=dateTo)).length>0 && (
            <div className="table-wrap"><table>
              <thead><tr><th>Implant ID</th><th>Device</th><th>Category</th><th>Lot #</th><th>Serial #</th><th>Procedure</th><th>Tooth Number</th><th>Date</th><th>Practice</th><th>Status</th><th></th></tr></thead>
              <tbody>{implants.filter(i=>(!dateFrom||i.procedureDate>=dateFrom)&&(!dateTo||i.procedureDate<=dateTo)).map(i=>(
                <>
                  <tr key={i.implantId} style={{cursor:'pointer',background:expandedImplant===i.implantId?'var(--bg-secondary)':'transparent'}}
                    onClick={()=>setExpandedImplant(expandedImplant===i.implantId?null:i.implantId)}>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{i.implantId}</td>
                    <td><div style={{fontWeight:600,fontSize:12}}>{i.deviceName}</div><div style={{fontSize:10,color:'var(--text-muted)'}}>{i.udiDI}</div></td>
                    <td><span className="badge badge-blue">{i.deviceCategory}</span></td>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{i.lotNumber}</td>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{i.serialNumber||'—'}</td>
                    <td style={{fontSize:11}}>{i.procedureType}</td>
                    <td style={{fontSize:11}}>{i.toothNumber}</td>
                    <td style={{fontSize:11}}>{i.procedureDate}</td>
                    <td style={{fontSize:11}}>{i.practiceId}</td>
                    <td><span className={`badge ${i.status==='implanted'?'badge-green':i.status==='explanted'?'badge-amber':'badge-red'}`}>{i.status}</span></td>
                    <td style={{fontSize:12,color:'var(--text-muted)'}}>{expandedImplant===i.implantId?'▲':'▼'}</td>
                  </tr>
                  {expandedImplant===i.implantId && (
                    <tr key={i.implantId+'-detail'}>
                      <td colSpan={11} style={{padding:0,background:'var(--bg-secondary)'}}>
                        <div style={{padding:'16px 20px',borderLeft:'3px solid var(--accent-amber)'}}>
                          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px 24px'}}>
                            {[['Implant ID',i.implantId,true],['UDI-DI',i.udiDI,true],['Lot #',i.lotNumber,true],['Serial #',i.serialNumber||'—',true],
                              ['Procedure',i.procedureType,false],['Tooth Number',i.toothNumber,false],['Dentist',i.dentistId||'—',false],['Practice',i.practiceId,false]].map(([label,val,mono])=>(
                              <div key={label}>
                                <div style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:2}}>{label}</div>
                                <div style={{fontSize:12,fontFamily:mono?'var(--font-mono)':'inherit',color:'var(--text-primary)'}}>{val}</div>
                              </div>
                            ))}
                          </div>
                          {i.notes && <div style={{marginTop:12,padding:'10px 14px',background:'var(--bg-card)',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)'}}><div style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',marginBottom:4}}>📝 Notes</div><div style={{fontSize:13}}>{i.notes}</div></div>}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}</tbody>
            </table></div>
          )}
        </div>
      )}

      {/* ══ INVENTORY ══ */}
      {tab==='inventory' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">📦 Available Consignment Inventory</span>
            <button className="btn btn-ghost btn-sm" onClick={refresh}>↻ Refresh</button>
          </div>
          {loading
            ? <div className="loading-overlay"><span className="spinner"/></div>
            : consignments.length===0
              ? <div className="empty-state"><div className="icon">📦</div><p>No active consignment inventory</p></div>
              : <div className="table-wrap"><table>
                  <thead><tr><th>Consignment ID</th><th>Device</th><th>Category</th><th>Practice</th><th>Location</th><th>Lot #</th><th>Total</th><th>Used</th><th>Available</th><th>Sterile Expiry</th></tr></thead>
                  <tbody>{[...consignments].sort((a,b)=>(a.deviceCategory||'').localeCompare(b.deviceCategory||'')||(a.deviceName||'').localeCompare(b.deviceName||'')).map(c=>{
                    const avail=getAvailable(c);
                    const CC={'cardiac':{bg:'rgba(59,130,246,0.06)',border:'rgba(59,130,246,0.15)',badge:'badge-blue',label:'🫀 Cardiac'},'general_surgery':{bg:'rgba(16,185,129,0.06)',border:'rgba(16,185,129,0.15)',badge:'badge-green',label:'🟢 General Surgery'},'neurosurgery':{bg:'rgba(139,92,246,0.06)',border:'rgba(139,92,246,0.15)',badge:'badge-purple',label:'🧠 Neurosurgery'},'orthopedic':{bg:'rgba(245,158,11,0.06)',border:'rgba(245,158,11,0.15)',badge:'badge-amber',label:'🦴 Orthopedic'}};
                    const cat=CC[c.deviceCategory||'']||{bg:'transparent',badge:'badge-blue',label:c.deviceCategory||'Device'};
                    return (
                      <tr key={c.consignmentId} style={{cursor:'pointer',background:cat.bg}}
                        onClick={()=>{ setTab('implant'); handleConsignmentSelect(c.consignmentId); }}>
                        <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{c.consignmentId}</td>
                        <td><div style={{fontWeight:600,fontSize:12}}>{c.deviceName}</div><div style={{fontSize:10,color:'var(--text-muted)'}}>{c.deviceType}</div></td>
                        <td><span className={`badge ${cat.badge}`}>{(c.deviceCategory||'device').replace(/_/g,' ')}</span></td>
                        <td style={{fontSize:11}}>🏥 {c.practiceId}</td>
                        <td style={{fontSize:11}}>{c.location}</td>
                        <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{c.lotNumber}</td>
                        <td>{c.quantity}</td>
                        <td style={{color:'var(--text-muted)'}}>{c.usedQuantity||0}</td>
                        <td style={{fontWeight:600,color:avail>5?'var(--accent-green)':avail>0?'var(--accent-amber)':'var(--accent-red)'}}>{avail}</td>
                        <td style={{fontSize:11,color:c.sterileExpiryDate<today?'var(--accent-red)':'inherit'}}>{c.sterileExpiryDate}</td>
                      </tr>
                    );
                  })}</tbody>
                </table></div>
          }
          <p style={{fontSize:11,color:'var(--text-muted)',marginTop:8}}>Click any row to pre-select that consignment in Record Implant Post</p>
        </div>
      )}

      {/* ══ TODAY'S CASES ══ */}
      {tab==='cases' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              📅 Today's Cases
              <span className="badge badge-amber" style={{marginLeft:8}}>{todayCases.length}</span>
            </span>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-ghost btn-sm" onClick={loadTodayCases}>
                {casesLoading?<span className="spinner" style={{width:12,height:12}}/>:'↻ Refresh'}
              </button>
              <a href="/cases" className="btn btn-ghost btn-sm" style={{color:'var(--accent-amber)',borderColor:'var(--accent-amber)'}}>
                Full Schedule →
              </a>
            </div>
          </div>
          <div className="alert alert-info" style={{marginBottom:12,fontSize:12}}>
            ℹ Click "Record Implant Post" on a case to pre-select it — the implant will automatically link to the case when recorded.
          </div>
          {casesLoading
            ? <div className="loading-overlay"><span className="spinner"/></div>
            : todayCases.length===0
              ? <div className="empty-state"><div className="icon">📅</div><p>No cases scheduled for today</p><a href="/cases" className="btn btn-primary" style={{marginTop:12,background:'var(--accent-amber)'}}>+ Schedule a Case</a></div>
              : <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {todayCases.map(cs=>{
                    const reqDevices=typeof cs.required_devices==='string'?JSON.parse(cs.required_devices):(cs.required_devices||[]);
                    const sc=STATUS_CONFIG[cs.status]||STATUS_CONFIG.scheduled;
                    return (
                      <div key={cs.case_id} style={{padding:'14px 16px',background:sc.bg,borderRadius:'var(--radius-md)',border:'1px solid var(--border)'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                          <div>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                              <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-muted)'}}>{cs.case_id}</span>
                              <span className={`badge ${sc.badge}`} style={{fontSize:10}}>{sc.label}</span>
                              {cs.procedure_time && <span style={{fontSize:11,color:'var(--text-secondary)'}}>🕐 {cs.procedure_time}</span>}
                              {cs.or_room && <span style={{fontSize:11,color:'var(--text-secondary)'}}>🚪 OR {cs.or_room}</span>}
                            </div>
                            <div style={{fontSize:14,fontWeight:700,color:'var(--text-primary)',marginBottom:4}}>{cs.procedure_type||'—'}</div>
                            <div style={{fontSize:12,color:'var(--text-secondary)',display:'flex',gap:12}}>
                              {cs.dentist_id && <span>👨‍⚕️ {cs.dentist_id}</span>}
                              {cs.patient_mrn && <span>🏷 {cs.patient_mrn}</span>}
                            </div>
                          </div>
                          {cs.status!=='completed'&&cs.status!=='cancelled' && (
                            <button className="btn btn-primary btn-sm" style={{background:'var(--accent-amber)',flexShrink:0}}
                              onClick={()=>{ set('caseId',cs.case_id); switchTab('implant'); }}>
                              + Record Implant Post
                            </button>
                          )}
                        </div>
                        {reqDevices.length>0 && (
                          <div style={{marginTop:10,paddingTop:8,borderTop:'1px solid rgba(0,0,0,0.06)'}}>
                            <div style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>📦 Pre-Pull Required</div>
                            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                              {reqDevices.map((d,i)=>(
                                <div key={i} style={{padding:'3px 10px',background:'var(--bg-card)',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)',fontSize:12,display:'flex',gap:6,alignItems:'center'}}>
                                  <span>{d.deviceName}</span>
                                  <span className="badge badge-amber" style={{fontSize:10}}>x{d.quantity}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {cs.implant_ids?.length>0 && (
                          <div style={{marginTop:8,fontSize:11,color:'var(--accent-green)'}}>
                            ✓ {cs.implant_ids.length} implant{cs.implant_ids.length!==1?'s':''} recorded
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
          }
        </div>
      )}
    </>
  );
}
