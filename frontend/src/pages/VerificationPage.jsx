import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function VerifyPage() {
  const [tab,     setTab]     = useState('device');
  const [input,   setInput]   = useState('');
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // ── Auto-search from QR code URL params ──────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const di  = params.get('di');
    const lot = params.get('lot');
    if (di) {
      setTab('device');
      setInput(di);
      doSearch('device', di);
    } else if (lot) {
      setTab('lot');
      setInput(lot);
      doSearch('lot', lot);
    }
  }, []); // eslint-disable-line

  const doSearch = async (searchTab, searchInput) => {
    if (!searchInput?.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const data = searchTab === 'device'
        ? await api.verifyDevice(searchInput.trim())
        : await api.verifyLot(searchInput.trim());
      if (data?.found) {
        setResult(data);
      } else {
        setError(`No ${searchTab === 'device' ? 'device' : 'lot'} found for "${searchInput}"`);
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const search = () => doSearch(tab, input);

  const switchTab = (t) => { setTab(t); setResult(null); setError(''); setInput(''); };


  // ── Style helpers ─────────────────────────────────────────────

  const tabStyle = (t) => ({
    padding:'8px 20px', borderRadius:'var(--radius-sm)', cursor:'pointer',
    fontSize:13, fontWeight:600, border:'none',
    background: tab===t ? 'var(--accent-cyan)' : 'transparent',
    color: tab===t ? '#fff' : 'var(--text-secondary)',
  });

  const statusColor = s => ({
    active:    'var(--accent-green)',
    cleared:   'var(--accent-green)',
    recalled:  'var(--accent-red)',
    quarantine:'var(--accent-amber)',
    depleted:  'var(--text-muted)',
    revoked:   'var(--accent-red)',
  }[s] || 'var(--accent-blue)');

  const eventIcon = t => ({
    commission:     '🌱',
    quality_release:'✅',
    consign:        '📦',
    ship:           '🚚',
    receive:        '📥',
    implant:        '💊',
    explant:        '↩',
    quarantine:     '🔒',
    recall:         '⚠️',
  }[t] || '→');

  const eventColor = t => ({
    commission:     'var(--accent-green)',
    quality_release:'var(--accent-cyan)',
    consign:        'var(--accent-blue)',
    ship:           'var(--accent-blue)',
    receive:        'var(--accent-blue)',
    implant:        'var(--accent-amber)',
    explant:        'var(--accent-purple)',
    quarantine:     'var(--accent-amber)',
    recall:         'var(--accent-red)',
  }[t] || 'var(--accent-blue)');

  const FieldGrid = ({ fields }) => (
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:16}}>
      {fields.map(({label,value})=>(
        <div key={label} style={{padding:'10px 12px',
          background:'var(--bg-secondary)',borderRadius:'var(--radius-sm)'}}>
          <div style={{fontSize:10,color:'var(--text-muted)',fontFamily:'var(--font-mono)',
            marginBottom:3,textTransform:'uppercase',letterSpacing:'0.05em'}}>{label}</div>
          <div style={{fontSize:13,
            color: label==='Status' ? statusColor(String(value)) : 'var(--text-primary)',
            fontWeight: label==='Status' ? 700 : 500}}>
            {value ?? '—'}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{minHeight:'100vh', background:'var(--bg-primary)', padding:'40px 24px'}}>
      <div style={{maxWidth:860, margin:'0 auto'}}>

        <div style={{textAlign:'center', marginBottom:32}}>
          <div style={{fontSize:28,fontWeight:700,color:'var(--accent-cyan)',
            fontFamily:'var(--font-mono)',letterSpacing:'-0.5px',marginBottom:6}}>
            ImplantChain
          </div>
          <div style={{fontSize:20,fontWeight:600,color:'var(--text-primary)',marginBottom:8}}>
            🔍 Device & Lot Verification
          </div>
          <div style={{fontSize:13,color:'var(--text-muted)'}}>
            Public verification — no login required · Powered by Hyperledger Fabric
          </div>
          <div style={{display:'flex',gap:8,justifyContent:'center',marginTop:10,flexWrap:'wrap'}}>
            {['FDA UDI','EU MDR','ISO 13485','EPCIS 2.0','Tamper-proof'].map(t=>(
              <span key={t} style={{fontSize:10,padding:'2px 8px',borderRadius:99,
                background:'var(--bg-card)',color:'var(--text-muted)',
                border:'1px solid var(--border)',fontFamily:'var(--font-mono)'}}>
                {t}
              </span>
            ))}
          </div>
        </div>

        <div style={{display:'flex',gap:4,marginBottom:24,background:'var(--bg-card)',
          padding:4,borderRadius:'var(--radius-md)',width:'fit-content',margin:'0 auto 24px',
          border:'1px solid var(--border)'}}>
          <button style={tabStyle('device')} onClick={()=>switchTab('device')}>🦾 Verify Device (UDI-DI)</button>
          <button style={tabStyle('lot')}    onClick={()=>switchTab('lot')}>🔬 Verify Lot</button>
        </div>

        <div className="card" style={{marginBottom:20}}>
          <div style={{display:'flex',gap:12,alignItems:'flex-end'}}>
            <div className="form-group" style={{flex:1,marginBottom:0}}>
              <label>
                {tab==='device'
                  ? 'UDI-DI (Device Identifier) — from device label, packaging, or QR code scan'
                  : 'Lot ID or Lot Number — from device label or surgical record'}
              </label>
              <input placeholder={tab==='device'
                  ? 'e.g. (01)00643169007234'
                  : 'e.g. LOT-STK-2024-001 or 2024LOT001A'}
                value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&search()}
                style={{fontFamily:'var(--font-mono)',fontSize:13}}
                autoFocus/>
            </div>
            <button className="btn btn-primary" onClick={search}
              disabled={loading||!input.trim()}
              style={{background:'var(--accent-cyan)',minWidth:120}}>
              {loading
                ? <><span className="spinner" style={{width:14,height:14}}/> Verifying…</>
                : '🔍 Verify'}
            </button>
          </div>
          {error && <div className="alert alert-error" style={{marginTop:12}}>⚠ {error}</div>}
        </div>

        {result?.found && tab==='device' && (
          <div className="card" style={{marginBottom:16,
            borderColor:'rgba(16,185,129,0.4)',borderWidth:2}}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
              <div style={{width:40,height:40,borderRadius:'50%',
                background:'rgba(16,185,129,0.15)',
                display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>✅</div>
              <div>
                <div style={{fontSize:18,fontWeight:700,color:'var(--accent-green)'}}>
                  Authentic Device — Registered on Blockchain
                </div>
                <div style={{fontSize:12,color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>
                  {result.udiDI}
                </div>
              </div>
            </div>

            <FieldGrid fields={[
              {label:'Device Name',    value:result.deviceName},
              {label:'Manufacturer',   value:result.manufacturerId},
              {label:'Category',       value:result.deviceCategory?.replace(/_/g,' ')},
              {label:'Device Type',    value:result.deviceType?.replace(/_/g,' ')},
              {label:'MRI Safety',     value:result.mriSafe},
              {label:'Single Use',     value:result.singleUse?'Yes':'No'},
              {label:'Sterile',        value:result.sterile?'Yes':'No'},
              {label:'Contains Latex', value:result.containsLatex?'Yes':'No'},
            ]}/>

            {result.bodyLocations?.length > 0 && (
              <div style={{marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',
                  marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>
                  Approved Body Locations
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {result.bodyLocations.map(loc=>(
                    <span key={loc} style={{fontSize:12,padding:'4px 10px',borderRadius:99,
                      background:'var(--bg-secondary)',border:'1px solid var(--border)',
                      color:'var(--text-secondary)'}}>
                      {loc}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.clearances?.length > 0 && (
              <div style={{marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',
                  marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>
                  Regulatory Clearances
                </div>
                {result.clearances.map(c=>(
                  <div key={c.clearanceNumber} style={{display:'flex',alignItems:'center',
                    gap:12,padding:'8px 12px',background:'var(--bg-secondary)',
                    borderRadius:'var(--radius-sm)',marginBottom:6}}>
                    <span className={`badge ${c.status==='active'?'badge-green':'badge-red'}`}>
                      {c.clearanceType}
                    </span>
                    <span style={{fontFamily:'var(--font-mono)',fontSize:12}}>{c.clearanceNumber}</span>
                    <span style={{fontSize:12,color:'var(--text-muted)',flex:1}}>{c.indicationsForUse}</span>
                    <span style={{fontSize:11,color:statusColor(c.status)}}>{c.status}</span>
                  </div>
                ))}
              </div>
            )}

            {result.lots?.length > 0 && (
              <div>
                <div style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',
                  marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>
                  Production Lots ({result.lots.length})
                </div>
                {result.lots.map(l=>(
                  <div key={l.lotId} style={{display:'flex',alignItems:'center',
                    gap:12,padding:'8px 12px',background:'var(--bg-secondary)',
                    borderRadius:'var(--radius-sm)',marginBottom:6,
                    borderLeft:`3px solid ${statusColor(l.status)}`}}>
                    <span style={{fontFamily:'var(--font-mono)',fontSize:11}}>{l.lotNumber}</span>
                    <span style={{fontSize:11,color:'var(--text-muted)'}}>Exp: {l.expiryDate}</span>
                    <span style={{fontSize:11,color:'var(--text-muted)'}}>
                      {l.remaining}/{l.quantity} remaining
                    </span>
                    <span className={`badge ${l.status==='active'?'badge-green':l.status==='recalled'?'badge-red':'badge-blue'}`}>
                      {l.status}
                    </span>
                    {l.recallClass && (
                      <span style={{fontSize:11,color:'var(--accent-red)'}}>
                        Class {l.recallClass}: {l.recallReason}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {result?.found && tab==='lot' && (
          <div className="card" style={{marginBottom:16,
            borderColor: result.status==='recalled'?'rgba(239,68,68,0.5)':'rgba(16,185,129,0.4)',
            borderWidth:2}}>

            {result.status==='recalled' && (
              <div style={{padding:'12px 16px',background:'rgba(239,68,68,0.1)',
                borderRadius:'var(--radius-sm)',marginBottom:16,
                border:'1px solid rgba(239,68,68,0.3)'}}>
                <div style={{fontSize:15,fontWeight:700,color:'var(--accent-red)',marginBottom:4}}>
                  ⚠ THIS LOT HAS BEEN RECALLED
                </div>
                <div style={{fontSize:13,color:'var(--accent-red)'}}>
                  Class {result.recallClass}: {result.recallReason}
                </div>
              </div>
            )}

            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
              <div style={{width:40,height:40,borderRadius:'50%',
                background: result.status==='recalled'?'rgba(239,68,68,0.15)':'rgba(16,185,129,0.15)',
                display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>
                {result.status==='recalled'?'⚠️':'✅'}
              </div>
              <div>
                <div style={{fontSize:18,fontWeight:700,
                  color:result.status==='recalled'?'var(--accent-red)':'var(--accent-green)'}}>
                  {result.status==='recalled'?'Recalled Lot':'Authentic Lot — Verified'}
                </div>
                <div style={{fontSize:12,color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>
                  {result.lotId} · Lot# {result.lotNumber}
                </div>
              </div>
            </div>

            <FieldGrid fields={[
              {label:'Device',             value:result.deviceName},
              {label:'Manufacturing Date', value:result.manufacturingDate},
              {label:'Expiry Date',        value:result.expiryDate},
              {label:'Sterile Expiry',     value:result.sterileExpiryDate},
              {label:'QC Released',        value:result.qualityReleaseDate
                ? new Date(result.qualityReleaseDate).toLocaleDateString() : 'Pending'},
              {label:'Storage',            value:result.storageConditions},
              {label:'Total Quantity',     value:result.quantity},
              {label:'Remaining',          value:result.remainingQuantity},
              {label:'Status',             value:result.status},
            ]}/>

            {result.epcisEvents?.length > 0 && (
              <div>
                <div style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)',
                  marginBottom:10,textTransform:'uppercase',letterSpacing:'0.05em'}}>
                  EPCIS Event Chain
                  <span className="badge badge-blue" style={{marginLeft:8}}>
                    {result.epcisEvents.length} events
                  </span>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {result.epcisEvents.map((e,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'flex-start',gap:12,
                      padding:'10px 14px',background:'var(--bg-secondary)',
                      borderRadius:'var(--radius-sm)',
                      borderLeft:`3px solid ${eventColor(e.eventType)}`}}>
                      <span style={{fontSize:16,flexShrink:0}}>{eventIcon(e.eventType)}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,color:eventColor(e.eventType),
                          fontFamily:'var(--font-mono)',fontWeight:600,
                          textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:2}}>
                          {e.eventType?.replace(/_/g,' ')}
                        </div>
                        <div style={{fontSize:13,color:'var(--text-primary)'}}>
                          {e.eventType==='commission'      && <><strong>{e.from}</strong> → <strong>{e.to}</strong> · {e.quantity} units</>}
                          {e.eventType==='quality_release' && <>QC released by <strong>{e.performedBy}</strong></>}
                          {e.eventType==='consign'         && <><strong>{e.repId}</strong> → 🏥 <strong>{e.hospitalId}</strong> · {e.quantity} units</>}
                          {e.eventType==='ship'            && <><strong>{e.from}</strong> → <strong>{e.to}</strong> · {e.quantity} units</>}
                          {e.eventType==='receive'         && <>Received by <strong>{e.receivedBy}</strong> · {e.quantity} units</>}
                          {e.eventType==='implant'         && <>{e.procedureType} · {e.bodyLocation} · 🏥 {e.hospitalId}</>}
                          {e.eventType==='explant'         && <>Explanted · {e.reason} · {e.explantDisposition}</>}
                          {e.eventType==='recall'          && <>Recalled Class <strong>{e.recallClass}</strong>: {e.reason}</>}
                          {e.eventType==='quarantine'      && <>Quarantined: {e.reason}</>}
                        </div>
                        <div style={{fontSize:10,color:'var(--text-muted)',
                          fontFamily:'var(--font-mono)',marginTop:4}}>
                          {e.eventTime ? new Date(e.eventTime).toLocaleString() : '—'}
                        </div>
                        <div style={{fontSize:10,color:'var(--accent-cyan)',
                          fontFamily:'var(--font-mono)',marginTop:2,wordBreak:'break-all'}}>
                          Tx: {e.txId}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{textAlign:'center',marginTop:24,fontSize:11,color:'var(--text-muted)'}}>
          <a href="/login" style={{color:'var(--accent-cyan)'}}>Staff Login</a>
          &nbsp;·&nbsp;
          Powered by Hyperledger Fabric · DApp Architects
        </div>
      </div>
    </div>
  );
}
