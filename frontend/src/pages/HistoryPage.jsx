import { useState } from 'react';
import { api } from '../api/client';

const ASSET_TYPES = [
  { value:'device',      label:'🦾 Medical Device',       placeholder:'e.g. (01)00643169007234',   fn:(id)=>api.getDeviceHistory(id) },
  { value:'lot',         label:'🔬 Device Lot',           placeholder:'e.g. LOT-STK-2024-001',     fn:(id)=>api.getLotHistory(id) },
  { value:'clearance',   label:'📋 Regulatory Clearance', placeholder:'e.g. K231234',              fn:(id)=>api.getClearanceHistory(id) },
  { value:'consignment', label:'📦 Consignment',          placeholder:'e.g. CONS-MEM-2024-001',    fn:(id)=>api.getConsignmentHistory(id) },
  { value:'implant',     label:'💊 Implant Record',       placeholder:'e.g. MEM-IMP-0001',         fn:(id)=>api.getImplantHistory(id) },
];

export default function HistoryPage() {
  const [assetType, setAssetType] = useState('device');
  const [assetId,   setAssetId]   = useState('');
  const [history,   setHistory]   = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const currentType = ASSET_TYPES.find(t => t.value === assetType);

  const search = async (e) => {
    e.preventDefault();
    if (!assetId.trim()) return;
    setLoading(true); setError(''); setHistory(null);
    try {
      const result = await currentType.fn(assetId.trim());
      setHistory(result);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  // Fabric history is returned newest-first.
  // The last entry (highest index) is the genesis / initial creation.
  const totalTx = history?.length || 0;

  return (
    <>
      <div className="page-header">
        <h2>📋 Blockchain History</h2>
        <p>Tamper-proof audit trail — every state change recorded on the Hyperledger Fabric ledger</p>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Search Asset History</span>
        </div>
        <form onSubmit={search}>
          <div className="form-grid" style={{marginBottom:14}}>
            <div className="form-group">
              <label>Asset Type</label>
              <select value={assetType}
                onChange={e=>{ setAssetType(e.target.value); setHistory(null); setError(''); }}>
                {ASSET_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Asset ID</label>
              <input value={assetId} onChange={e=>setAssetId(e.target.value)}
                placeholder={currentType?.placeholder}
                style={{fontFamily:'var(--font-mono)'}} required/>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading||!assetId.trim()}>
            {loading
              ? <><span className="spinner" style={{width:14,height:14}}/> Searching…</>
              : '🔍 Search History'}
          </button>
        </form>
      </div>

      {error && <div className="alert alert-error" style={{marginBottom:12}}>⚠ {error}</div>}

      {history && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              {currentType?.label}: <span style={{fontFamily:'var(--font-mono)',fontSize:13}}>{assetId}</span>
            </span>
            <span className="badge badge-blue">{totalTx} transaction{totalTx!==1?'s':''}</span>
          </div>

          {totalTx === 0
            ? <div className="empty-state"><div className="icon">📭</div><p>No history found for this asset ID</p></div>
            : (
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {history.map((entry, i) => {
                  // History is newest-first; index 0 = latest, index (n-1) = genesis
                  const isGenesis  = i === totalTx - 1;
                  const isLatest   = i === 0;
                  const txNumber   = totalTx - i; // 1 = genesis, totalTx = latest
                  const icon       = isGenesis ? '🌱' : entry.isDelete ? '🗑' : isLatest ? '⭐' : '📝';
                  const leftColor  = entry.isDelete
                    ? 'var(--accent-red)'
                    : isGenesis
                      ? 'var(--accent-green)'
                      : 'var(--accent-blue)';

                  return (
                    <div key={i} style={{
                      background:'var(--bg-secondary)',
                      border:'1px solid var(--border)',
                      borderRadius:'var(--radius-md)',
                      padding:16,
                      borderLeft:`3px solid ${leftColor}`,
                    }}>
                      {/* Transaction header */}
                      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                        <span style={{fontSize:20}}>{icon}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:12,fontFamily:'var(--font-mono)',
                            color:'var(--accent-cyan)',wordBreak:'break-all'}}>
                            TX: {entry.txId}
                          </div>
                          <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
                            {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}
                            {isGenesis && ' · Initial creation'}
                            {isLatest && !isGenesis && ' · Current state'}
                            {entry.isDelete && ' · DELETED'}
                          </div>
                        </div>
                        <span className={`badge ${
                          entry.isDelete ? 'badge-red' : isGenesis ? 'badge-green' : isLatest ? 'badge-cyan' : 'badge-blue'
                        }`}>
                          TX #{txNumber}
                        </span>
                      </div>

                      {/* State snapshot at this transaction */}
                      {entry.value && (
                        <div style={{background:'var(--bg-card)',borderRadius:'var(--radius-sm)',padding:12}}>
                          <div style={{fontSize:11,color:'var(--text-muted)',fontFamily:'var(--font-mono)',
                            marginBottom:8,textTransform:'uppercase'}}>
                            State at this transaction
                          </div>
                          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(200px,1fr))',gap:8}}>
                            {Object.entries(entry.value)
                              .filter(([k]) => k !== 'docType')
                              .map(([key, val]) => (
                                <div key={key}>
                                  <div style={{fontSize:10,color:'var(--text-muted)',
                                    fontFamily:'var(--font-mono)',textTransform:'uppercase'}}>
                                    {key}
                                  </div>
                                  <div style={{
                                    fontSize:13,
                                    color: key==='status' ? 'var(--accent-amber)' : 'var(--text-primary)',
                                    fontFamily: typeof val==='string' && val.length>20 ? 'var(--font-mono)' : 'inherit',
                                    wordBreak:'break-all',
                                  }}>
                                    {typeof val==='boolean'
                                      ? (val ? 'Yes' : 'No')
                                      : Array.isArray(val)
                                        ? (
                                          <div style={{fontSize:11,fontFamily:'var(--font-mono)',marginTop:4}}>
                                            {val.map((item,j)=>(
                                              <div key={j} style={{marginBottom:6,paddingBottom:6,
                                                borderBottom:'1px solid var(--border)'}}>
                                                {typeof item==='object'
                                                  ? Object.entries(item).map(([k,v])=>(
                                                      <div key={k} style={{display:'flex',gap:8,lineHeight:1.6}}>
                                                        <span style={{color:'var(--text-muted)',minWidth:100}}>{k}</span>
                                                        <span style={{color:'var(--accent-cyan)',wordBreak:'break-all'}}>{String(v)}</span>
                                                      </div>
                                                    ))
                                                  : String(item)}
                                              </div>
                                            ))}
                                          </div>
                                        )
                                        : typeof val==='object' && val!==null
                                          ? <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-muted)'}}>
                                              {JSON.stringify(val)}
                                            </span>
                                          : String(val)
                                    }
                                  </div>
                                </div>
                              ))
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>
      )}
    </>
  );
}
