import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

// ── SHA-256 hash (same as NursePage) ──────────────────────────────────────
async function sha256(text) {
  try {
    const data = new TextEncoder().encode(text.trim().toUpperCase());
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
  } catch { return ''; }
}

// ── CSV parser (no external deps) ─────────────────────────────────────────
function parseCSV(text) {
  const lines  = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    // Handle quoted fields with commas
    const vals = [];
    let cur = '', inQuote = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { vals.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    vals.push(cur.trim());
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
    rows.push(row);
  }
  return { headers, rows };
}

const REQUIRED = ['udiDI','deviceName','deviceCategory','deviceType',
                  'lotNumber','patientMRN','procedureDate','procedureType','bodyLocation'];

const DEVICE_CATEGORIES = ['orthopedic','cardiac','neurosurgery','general_surgery'];

const CSV_TEMPLATE_HEADERS = [
  'implantId','udiDI','deviceName','deviceCategory','deviceType',
  'lotNumber','serialNumber','patientMRN','surgeonId',
  'procedureDate','procedureType','bodyLocation','hospitalId','notes',
];

const CSV_EXAMPLE_ROW = [
  'MEM-IMP-LEGACY-001','00643169007234','Stryker Triathlon Knee System',
  'orthopedic','joint',
  'LOT-2023-001A','SN-12345','MRN-LEGACY-001','DR-JOHNSON-ORTH',
  '2023-06-15','Total Knee Arthroplasty','Left Knee','Memorial Hospital',
  'Pre-ImplantChain legacy record',
];

function downloadTemplate() {
  const csv = [CSV_TEMPLATE_HEADERS.join(','), CSV_EXAMPLE_ROW.join(',')].join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'implantchain-bulk-import-template.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function BulkImportPage() {
  const { user } = useAuth();
  const fileRef  = useRef();

  const [step,      setStep]      = useState('upload'); // upload | preview | importing | done
  const [fileName,  setFileName]  = useState('');
  const [rows,      setRows]      = useState([]);
  const [errors,    setErrors]    = useState({}); // rowIndex → error string
  const [progress,  setProgress]  = useState({ done:0, total:0 });
  const [results,   setResults]   = useState(null);
  const [importMsg, setImportMsg] = useState(null);

  const hospLock = user?.role === 'supply_chain' ? user?.hospitalId : null;

  // ── Parse uploaded CSV ──────────────────────────────────────────
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    try {
      const { rows: parsed } = parseCSV(text);

      // Validate each row
      const errs = {};
      const processed = parsed.map((row, i) => {
        const missing = REQUIRED.filter(f => !row[f]?.trim());
        if (missing.length) errs[i] = `Missing: ${missing.join(', ')}`;
        else if (hospLock && row.hospitalId && row.hospitalId !== hospLock) {
          errs[i] = `Hospital must be "${hospLock}"`;
        } else if (row.deviceCategory && !DEVICE_CATEGORIES.includes(row.deviceCategory)) {
          errs[i] = `deviceCategory must be one of: ${DEVICE_CATEGORIES.join(', ')}`;
        } else if (row.procedureDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.procedureDate)) {
          errs[i] = 'procedureDate must be YYYY-MM-DD';
        }
        return {
          ...row,
          hospitalId: row.hospitalId || hospLock || '',
          _rowNum: i + 2, // 1-indexed + header
        };
      });

      setErrors(errs);
      setRows(processed);
      setStep('preview');
    } catch (err) {
      setImportMsg({ type:'error', text:'Failed to parse CSV: ' + err.message });
    }
    e.target.value = '';
  };

  // ── Run import ──────────────────────────────────────────────────
  const runImport = async () => {
    const valid = rows.filter((_, i) => !errors[i]);
    if (!valid.length) return;

    setStep('importing');
    setProgress({ done: 0, total: valid.length });

    // Hash patient MRNs and build records
    const BATCH = 10; // process in batches of 10
    const allResults = [];

    for (let b = 0; b < valid.length; b += BATCH) {
      const batch = valid.slice(b, b + BATCH);

      // Hash MRNs for this batch
      const hashed = await Promise.all(batch.map(async row => {
        // Auto-generate implantId if blank
        const implantId = row.implantId?.trim() ||
          `${(row.hospitalId||'HOSP').split(' ')[0].substring(0,3).toUpperCase()}-IMP-LEGACY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2,5).toUpperCase()}`;
        const patientIdHash = await sha256(row.patientMRN);
        return { ...row, implantId, patientIdHash };
      }));

      try {
        const resp = await api.bulkImport(hashed);
        allResults.push(...(resp.results || []));
        setProgress(p => ({ ...p, done: Math.min(b + BATCH, valid.length) }));
      } catch (err) {
        // Mark all in batch as failed
        hashed.forEach(row => allResults.push({
          implantId: row.implantId, status:'error', error: err.message
        }));
        setProgress(p => ({ ...p, done: Math.min(b + BATCH, valid.length) }));
      }
    }

    setResults({
      total:     valid.length,
      succeeded: allResults.filter(r => r.status==='success').length,
      failed:    allResults.filter(r => r.status==='error').length,
      rows:      allResults,
      skipped:   rows.length - valid.length,
    });
    setStep('done');
  };

  const reset = () => {
    setStep('upload'); setFileName(''); setRows([]); setErrors({});
    setResults(null); setImportMsg(null); setProgress({done:0,total:0});
  };

  const validCount   = rows.filter((_,i) => !errors[i]).length;
  const invalidCount = rows.filter((_,i) =>  errors[i]).length;

  return (
    <>
      <div className="page-header">
        <h2>📥 Bulk Import</h2>
        <p>Brownfield hospital onboarding — import historical implant records via CSV</p>
      </div>

      {importMsg && (
        <div className={`alert alert-${importMsg.type}`} style={{marginBottom:12}}>
          {importMsg.text}
        </div>
      )}

      {/* ── STEP 1: UPLOAD ── */}
      {step === 'upload' && (
        <>
          <div className="card">
            <div className="card-header">
              <span className="card-title">📋 Import Instructions</span>
            </div>
            <div style={{fontSize:13,lineHeight:1.8,color:'var(--text-secondary)',marginBottom:16}}>
              <p>Use this tool to bulk import historical implant records from your existing hospital system (Epic, Meditech, etc.) into ImplantChain.</p>
              <br/>
              <p><strong style={{color:'var(--text-primary)'}}>Before importing:</strong></p>
              <ul style={{paddingLeft:20,marginTop:4}}>
                <li>All devices (<code>udiDI</code>) must already be registered on the blockchain</li>
                <li>Patient MRNs are hashed automatically before being stored — never stored in plain text</li>
                <li>Records are marked as <code>legacy: true</code> and use a placeholder consignment</li>
                <li>Maximum 500 records per import</li>
                {hospLock && <li>Records will be locked to your hospital: <strong style={{color:'var(--accent-amber)'}}>{hospLock}</strong></li>}
              </ul>
            </div>
            <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
              <button className="btn btn-ghost btn-sm" onClick={downloadTemplate}
                style={{color:'var(--accent-cyan)',borderColor:'var(--accent-cyan)'}}>
                ⬇ Download CSV Template
              </button>
              <span style={{fontSize:12,color:'var(--text-muted)'}}>
                Contains required headers and one example row
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">📂 Upload CSV File</span>
            </div>
            <div
              style={{border:'2px dashed var(--border)',borderRadius:'var(--radius-md)',
                padding:'48px 24px',textAlign:'center',cursor:'pointer',
                transition:'border-color 0.2s'}}
              onClick={()=>fileRef.current?.click()}
              onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor='var(--accent-blue)'}}
              onDragLeave={e=>{e.currentTarget.style.borderColor='var(--border)'}}
              onDrop={e=>{
                e.preventDefault();
                e.currentTarget.style.borderColor='var(--border)';
                const file=e.dataTransfer.files[0];
                if(file) handleFile({target:{files:[file],value:''}});
              }}>
              <div style={{fontSize:32,marginBottom:12}}>📂</div>
              <div style={{fontSize:15,fontWeight:600,color:'var(--text-primary)',marginBottom:4}}>
                Click to upload or drag and drop
              </div>
              <div style={{fontSize:13,color:'var(--text-muted)'}}>CSV files only · Max 500 rows</div>
              <input ref={fileRef} type="file" accept=".csv" style={{display:'none'}}
                onChange={handleFile}/>
            </div>
          </div>
        </>
      )}

      {/* ── STEP 2: PREVIEW ── */}
      {step === 'preview' && (
        <>
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                👁 Preview — {fileName}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={reset}>✕ Start Over</button>
            </div>

            {/* Summary */}
            <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap'}}>
              <div style={{padding:'10px 16px',background:'rgba(16,185,129,0.08)',
                border:'1px solid rgba(16,185,129,0.2)',borderRadius:'var(--radius-md)',
                textAlign:'center',minWidth:120}}>
                <div style={{fontSize:22,fontWeight:800,color:'var(--accent-green)'}}>{validCount}</div>
                <div style={{fontSize:11,color:'var(--text-muted)'}}>Ready to import</div>
              </div>
              {invalidCount > 0 && (
                <div style={{padding:'10px 16px',background:'rgba(239,68,68,0.08)',
                  border:'1px solid rgba(239,68,68,0.2)',borderRadius:'var(--radius-md)',
                  textAlign:'center',minWidth:120}}>
                  <div style={{fontSize:22,fontWeight:800,color:'var(--accent-red)'}}>{invalidCount}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>Rows with errors</div>
                </div>
              )}
              <div style={{padding:'10px 16px',background:'rgba(99,102,241,0.08)',
                border:'1px solid rgba(99,102,241,0.2)',borderRadius:'var(--radius-md)',
                textAlign:'center',minWidth:120}}>
                <div style={{fontSize:22,fontWeight:800,color:'var(--accent-purple)'}}>{rows.length}</div>
                <div style={{fontSize:11,color:'var(--text-muted)'}}>Total rows</div>
              </div>
            </div>

            {invalidCount > 0 && (
              <div className="alert alert-amber" style={{marginBottom:12,fontSize:12}}>
                ⚠ {invalidCount} row{invalidCount>1?'s':''} have errors and will be skipped.
                Fix your CSV and re-upload to include them.
              </div>
            )}

            {/* Preview table */}
            <div className="table-wrap" style={{maxHeight:400,overflowY:'auto'}}>
              <table>
                <thead><tr>
                  <th>Row</th><th>Status</th><th>Implant ID</th><th>UDI-DI</th>
                  <th>Device</th><th>Category</th><th>Lot #</th>
                  <th>Patient MRN</th><th>Surgeon</th><th>Procedure Date</th>
                  <th>Procedure Type</th><th>Body Location</th><th>Hospital</th>
                </tr></thead>
                <tbody>{rows.map((row, i) => {
                  const hasErr = !!errors[i];
                  return (
                    <tr key={i} style={{background:hasErr?'rgba(239,68,68,0.05)':'transparent',
                      opacity:hasErr?0.7:1}}>
                      <td style={{fontSize:11,color:'var(--text-muted)'}}>{row._rowNum}</td>
                      <td>
                        {hasErr
                          ? <span title={errors[i]} style={{color:'var(--accent-red)',fontSize:11,cursor:'help'}}>
                              ⚠ Error
                            </span>
                          : <span style={{color:'var(--accent-green)',fontSize:11}}>✓ Ready</span>}
                        {hasErr && <div style={{fontSize:10,color:'var(--accent-red)',marginTop:2}}>{errors[i]}</div>}
                      </td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>
                        {row.implantId || <em style={{color:'var(--text-muted)'}}>auto-generate</em>}
                      </td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{row.udiDI}</td>
                      <td style={{fontWeight:600,fontSize:12}}>{row.deviceName}</td>
                      <td><span className="badge badge-blue" style={{fontSize:10}}>{row.deviceCategory}</span></td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:10}}>{row.lotNumber}</td>
                      <td style={{fontSize:11,color:'var(--text-muted)'}}>
                        {row.patientMRN ? '●●●●●●' : '—'}
                        <span style={{fontSize:9,display:'block',color:'var(--text-muted)'}}>will be hashed</span>
                      </td>
                      <td style={{fontSize:11}}>{row.surgeonId||'—'}</td>
                      <td style={{fontSize:11}}>{row.procedureDate}</td>
                      <td style={{fontSize:11}}>{row.procedureType}</td>
                      <td style={{fontSize:11}}>{row.bodyLocation}</td>
                      <td style={{fontSize:11}}>🏥 {row.hospitalId||hospLock||'—'}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>

            <div style={{display:'flex',gap:12,marginTop:16}}>
              <button className="btn btn-primary" style={{minWidth:180}}
                disabled={validCount===0}
                onClick={runImport}>
                ⬆ Import {validCount} Record{validCount!==1?'s':''}
              </button>
              <button className="btn btn-ghost" onClick={reset}>✕ Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* ── STEP 3: IMPORTING ── */}
      {step === 'importing' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">⏳ Importing Records…</span>
          </div>
          <div style={{padding:'32px 0',textAlign:'center'}}>
            <div style={{fontSize:32,marginBottom:16}}>⛓</div>
            <div style={{fontSize:15,fontWeight:600,marginBottom:8}}>
              Writing to Hyperledger Fabric…
            </div>
            <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:24}}>
              {progress.done} of {progress.total} records submitted
            </div>
            <div style={{maxWidth:400,margin:'0 auto',height:8,background:'var(--border)',
              borderRadius:4,overflow:'hidden'}}>
              <div style={{
                width:`${progress.total>0?(progress.done/progress.total)*100:0}%`,
                height:'100%',background:'var(--accent-blue)',borderRadius:4,
                transition:'width 0.3s'
              }}/>
            </div>
            <div style={{fontSize:12,color:'var(--text-muted)',marginTop:8}}>
              {progress.total>0?Math.round((progress.done/progress.total)*100):0}%
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 4: RESULTS ── */}
      {step === 'done' && results && (
        <>
          <div className="card" style={{borderColor:
            results.failed===0?'rgba(16,185,129,0.3)':'rgba(245,158,11,0.3)'}}>
            <div className="card-header">
              <span className="card-title">
                {results.failed===0 ? '✅ Import Complete' : '⚠ Import Complete with Errors'}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={reset}>↩ Import Another File</button>
            </div>

            <div style={{display:'flex',gap:16,marginBottom:20,flexWrap:'wrap'}}>
              <div style={{padding:'12px 20px',background:'rgba(16,185,129,0.08)',
                border:'1px solid rgba(16,185,129,0.2)',borderRadius:'var(--radius-md)',textAlign:'center'}}>
                <div style={{fontSize:28,fontWeight:800,color:'var(--accent-green)'}}>{results.succeeded}</div>
                <div style={{fontSize:12,color:'var(--text-muted)'}}>Successfully imported</div>
              </div>
              {results.failed > 0 && (
                <div style={{padding:'12px 20px',background:'rgba(239,68,68,0.08)',
                  border:'1px solid rgba(239,68,68,0.2)',borderRadius:'var(--radius-md)',textAlign:'center'}}>
                  <div style={{fontSize:28,fontWeight:800,color:'var(--accent-red)'}}>{results.failed}</div>
                  <div style={{fontSize:12,color:'var(--text-muted)'}}>Failed</div>
                </div>
              )}
              {results.skipped > 0 && (
                <div style={{padding:'12px 20px',background:'rgba(99,102,241,0.08)',
                  border:'1px solid rgba(99,102,241,0.2)',borderRadius:'var(--radius-md)',textAlign:'center'}}>
                  <div style={{fontSize:28,fontWeight:800,color:'var(--accent-purple)'}}>{results.skipped}</div>
                  <div style={{fontSize:12,color:'var(--text-muted)'}}>Skipped (validation errors)</div>
                </div>
              )}
            </div>

            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>Row</th><th>Implant ID</th><th>Status</th><th>Details</th>
                </tr></thead>
                <tbody>{results.rows.map((r,i)=>(
                  <tr key={i} style={{background:r.status==='success'
                    ?'rgba(16,185,129,0.03)':'rgba(239,68,68,0.04)'}}>
                    <td style={{fontSize:11,color:'var(--text-muted)'}}>{r.row}</td>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{r.implantId}</td>
                    <td>
                      <span className={`badge ${r.status==='success'?'badge-green':'badge-red'}`}>
                        {r.status==='success'?'✓ Imported':'✕ Failed'}
                      </span>
                    </td>
                    <td style={{fontSize:11,color:r.status==='success'
                      ?'var(--accent-green)':'var(--accent-red)'}}>
                      {r.status==='success'?'Written to blockchain':r.error}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
