import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function CompliancePage() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setError('');
    try {
      const d = await api.getUDICompliance();
      setData(d);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  const implants      = data?.implants      || [];
  const summary       = data?.summary       || {};
  const byCheck       = data?.byCheck       || {};
  const complianceRate= data?.complianceRate ?? null;

  const scoreColor = s => s >= 100 ? 'var(--accent-green)' : s >= 75 ? 'var(--accent-amber)' : 'var(--accent-red)';

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">✅ UDI Compliance Report</h1>
          <p className="page-subtitle">21 CFR Part 830 · ISO 13485 · EU MDR · HIPAA</p>
        </div>
        <button className="btn btn-secondary" onClick={load}>↻ Refresh</button>
      </div>

      {error && (
        <div className="alert alert-amber" style={{marginBottom:12}}>
          ℹ {error} — Fabric may not be running. Compliance data requires blockchain access.
        </div>
      )}

      {loading ? (
        <div className="loading-overlay"><span className="spinner"/> Loading compliance data…</div>
      ) : (
        <>
          {/* Summary */}
          <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:16}}>
            {[
              { label:'Compliance Rate',  value: complianceRate !== null ? `${complianceRate}%` : '—', color: complianceRate >= 80 ? 'green' : 'red' },
              { label:'Total Implants',   value: summary.total      || 0, color:'blue'   },
              { label:'Compliant',        value: summary.compliant  || 0, color:'green'  },
              { label:'Issues Found',     value: summary.issues     || 0, color:'red'    },
            ].map(k=>(
              <div key={k.label} className={`kpi-card ${k.color}`}>
                <div className="kpi-label">{k.label}</div>
                <div className="kpi-value" style={{color:`var(--accent-${k.color})`}}>{typeof k.value === 'number' ? k.value.toLocaleString() : k.value}</div>
              </div>
            ))}
          </div>

          {/* Compliance rate bar */}
          {complianceRate !== null && (
            <div className="card" style={{marginBottom:16}}>
              <div className="card-header">
                <span className="card-title">Overall Compliance</span>
                <span className={`badge ${complianceRate >= 80 ? 'badge-green' : 'badge-red'}`}>
                  {complianceRate >= 80 ? '✓ Compliant' : '⚠ Below threshold'}
                </span>
              </div>
              <div style={{padding:'8px 0'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:6,fontSize:13}}>
                  <span style={{color:'var(--text-secondary)'}}>Compliance Rate</span>
                  <span style={{color:scoreColor(complianceRate),fontWeight:700}}>{complianceRate}%</span>
                </div>
                <div style={{height:10,background:'var(--border)',borderRadius:6,overflow:'hidden'}}>
                  <div style={{
                    width:`${complianceRate}%`,height:'100%',borderRadius:6,
                    background:`linear-gradient(90deg,${scoreColor(complianceRate)},${scoreColor(complianceRate)}aa)`
                  }}/>
                </div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:6}}>
                  Minimum threshold: 80% · Standards: 21 CFR Part 830, EPCIS 2.0, EU MDR 2017/745, ISO 13485
                </div>
              </div>
            </div>
          )}

          {/* Implant table */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Implant Compliance Details ({implants.length})</span>
            </div>
            {implants.length === 0 ? (
              <div className="empty-state">
                <div className="icon">🦷</div>
                <p>No implant records found — record implants to generate compliance data</p>
              </div>
            ) : (
              <div className="table-wrap"><table className="data-table">
                <thead>
                  <tr>
                    <th>Implant ID</th>
                    <th>UDI-DI</th>
                    <th>UDI-PI</th>
                    <th>Clearance</th>
                    <th>Lot Status</th>
                    <th>Score</th>
                    <th>Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {implants.map(imp=>(
                    <tr key={imp.implantId}>
                      <td style={{fontFamily:'monospace',fontSize:11}}>{imp.implantId}</td>
                      <td>
                        {imp.checks?.udiDI
                          ? <span className="badge badge-green">✓ Present</span>
                          : <span className="badge badge-red">✗ Missing</span>}
                      </td>
                      <td>
                        {imp.checks?.udiPI
                          ? <span className="badge badge-green">✓ Present</span>
                          : imp.checks?.udiPI === false
                            ? <span className="badge badge-amber">⚠ Partial</span>
                            : <span className="badge badge-red">✗ Missing</span>}
                      </td>
                      <td>
                        {imp.checks?.clearance
                          ? <span className="badge badge-green">✓ Active</span>
                          : <span className="badge badge-amber">? Unverified</span>}
                      </td>
                      <td>
                        {imp.checks?.lotActive
                          ? <span className="badge badge-green">✓ Active</span>
                          : <span className="badge badge-red">✗ Recalled</span>}
                      </td>
                      <td>
                        <span style={{
                          fontWeight:700, fontSize:13,
                          color: scoreColor(imp.score || 0)
                        }}>
                          {imp.score ?? '—'}
                        </span>
                      </td>
                      <td style={{fontSize:11,color:'var(--text-muted)'}}>
                        {imp.issues?.length > 0
                          ? imp.issues.join(', ')
                          : <span style={{color:'var(--accent-green)'}}>None</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
