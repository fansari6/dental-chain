import { useState, useEffect } from 'react';
import { api } from '../api/client';

/**
 * ExpiryAlertBanner — drop into any role page.
 * Calls /alerts/expiry, shows nothing if clear, compact banner if alerts exist.
 * Role-scoped automatically by the backend.
 */
export default function ExpiryAlertBanner({ style = {} }) {
  const [data,     setData]     = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api.getExpiryAlerts()
      .then(d => setData(d || { alerts:[], counts:{critical:0,warning:0} }))
      .catch(() => {});
  }, []);

  if (!data) return null;

  const { alerts, counts } = data;
  const critical = alerts.filter(a => a.urgency === 'critical');
  const warning  = alerts.filter(a => a.urgency === 'warning');

  if (counts.critical === 0 && counts.warning === 0) return null;

  const hasCritical = counts.critical > 0;
  const bg     = hasCritical ? 'rgba(239,68,68,0.08)'   : 'rgba(245,158,11,0.08)';
  const border = hasCritical ? 'rgba(239,68,68,0.35)'   : 'rgba(245,158,11,0.35)';
  const color  = hasCritical ? 'var(--accent-red)'       : 'var(--accent-amber)';
  const icon   = hasCritical ? '⚠'                       : '⏰';

  const typeLabel = (type) =>
    type === 'consignment' ? 'Consignment'
    : type === 'lot'        ? 'Lot'
    : type === 'clearance'  ? 'Clearance'
    : type;

  return (
    <div style={{
      marginBottom: 16, padding: '12px 16px',
      background: bg, border: `1px solid ${border}`,
      borderRadius: 'var(--radius-md)', ...style
    }}>
      {/* Summary row */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:18 }}>{icon}</span>
          <div>
            {hasCritical && (
              <span style={{ fontWeight:700, color:'var(--accent-red)', fontSize:13 }}>
                {counts.critical} critical expiry alert{counts.critical!==1?'s':''}
              </span>
            )}
            {counts.warning > 0 && (
              <span style={{ fontWeight:hasCritical?400:700, color:'var(--accent-amber)', fontSize:13, marginLeft:hasCritical?8:0 }}>
                {hasCritical ? `· ` : ''}{counts.warning} warning{counts.warning!==1?'s':''}
              </span>
            )}
            {/* Inline preview of top 2 critical */}
            {!expanded && critical.length > 0 && (
              <span style={{ fontSize:12, color:'var(--text-secondary)', marginLeft:8 }}>
                — {critical.slice(0,2).map(a => `${a.name} (${a.days}d)`).join(', ')}
                {critical.length > 2 ? ` +${critical.length-2} more` : ''}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ background:'none', border:'none', cursor:'pointer',
            fontSize:12, color, fontWeight:600, padding:'2px 8px',
            borderRadius:'var(--radius-sm)' }}>
          {expanded ? '▲ Collapse' : '▼ Details'}
        </button>
      </div>

      {/* Expanded detail table */}
      {expanded && (
        <div style={{ marginTop:12, overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)' }}>
                <th style={{ textAlign:'left', padding:'4px 8px', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', fontSize:10 }}>Urgency</th>
                <th style={{ textAlign:'left', padding:'4px 8px', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', fontSize:10 }}>Type</th>
                <th style={{ textAlign:'left', padding:'4px 8px', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', fontSize:10 }}>Item</th>
                <th style={{ textAlign:'left', padding:'4px 8px', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', fontSize:10 }}>ID</th>
                <th style={{ textAlign:'left', padding:'4px 8px', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', fontSize:10 }}>Expiry</th>
                <th style={{ textAlign:'left', padding:'4px 8px', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', fontSize:10 }}>Days</th>
                <th style={{ textAlign:'left', padding:'4px 8px', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', fontSize:10 }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a, i) => {
                const rowColor = a.urgency==='critical'?'rgba(239,68,68,0.04)':'rgba(245,158,11,0.03)';
                const dayColor = a.urgency==='critical'?'var(--accent-red)':'var(--accent-amber)';
                return (
                  <tr key={i} style={{ background: rowColor, borderBottom:'1px solid rgba(0,0,0,0.04)' }}>
                    <td style={{ padding:'5px 8px' }}>
                      <span className={`badge ${a.urgency==='critical'?'badge-red':'badge-amber'}`} style={{ fontSize:10 }}>
                        {a.urgency==='critical' ? '🔴 Critical' : '🟡 Warning'}
                      </span>
                    </td>
                    <td style={{ padding:'5px 8px', color:'var(--text-secondary)' }}>{typeLabel(a.type)}</td>
                    <td style={{ padding:'5px 8px', fontWeight:600 }}>{a.name}</td>
                    <td style={{ padding:'5px 8px', fontFamily:'var(--font-mono)', fontSize:10 }}>{a.id}</td>
                    <td style={{ padding:'5px 8px', color: a.days <= 0 ? 'var(--accent-red)' : 'inherit' }}>{a.expiry}</td>
                    <td style={{ padding:'5px 8px', fontWeight:700, color: dayColor }}>
                      {a.days <= 0 ? `${Math.abs(a.days)}d overdue` : `${a.days}d`}
                    </td>
                    <td style={{ padding:'5px 8px', color:'var(--text-muted)', fontSize:11 }}>{a.detail}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
