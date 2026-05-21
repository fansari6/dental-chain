import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

// function ChaincodeVersion() {
//   const [ver, setVer] = useState('implant …');
//   useEffect(() => {
//     fetch('/api/chaincode-version')
//       .then((r) => r.json())
//       .then((d) => setVer(d.label || `implant ${d.version}`))
//       .catch(() => setVer('implant'));
//   }, []);
//   return <>{ver}</>;
// }

const ROLE_PORTAL = {
  government: {
    path: '/government',
    label: 'FDA / Regulatory Portal',
    icon: '🏛',
    color: 'var(--accent-blue)',
    desc: 'Review device submissions, issue clearances, manage recalls',
  },
  manufacturer: {
    path: '/manufacturer',
    label: 'Manufacturer Portal',
    icon: '🏭',
    color: 'var(--accent-green)',
    desc: 'Submit devices, upload ISO 13485 certs, create lots, QC release',
  },
  distributor: {
    path: '/distributor',
    label: 'Distributor / Rep Portal',
    icon: '🚚',
    color: 'var(--accent-cyan)',
    desc: 'Manage consignment inventory at hospital accounts',
  },
  supply_chain: {
    path: '/supply-chain',
    label: 'Supply Chain Portal',
    icon: '📦',
    color: 'var(--accent-purple)',
    desc: 'View hospital inventory, low stock alerts, backorder tracking',
  },
  nurse: {
    path: '/nurse',
    label: 'OR Nurse Portal',
    icon: '🩺',
    color: 'var(--accent-amber)',
    desc: 'Scan UDI barcode and record implants at point of use',
  },
  infection_prevention: {
    path: '/infection-prevention',
    label: 'Infection Prevention Portal',
    icon: '🔬',
    color: 'var(--accent-red)',
    desc: 'Recall response, MDR tracking, patient notification',
  },
  admin: {
    path: '/admin',
    label: 'Admin Portal',
    icon: '⚙',
    color: 'var(--text-muted)',
    desc: 'Manage users, hospitals, surgeons, and system identities',
  },
};

const CC = {
  cardiac: {
    bg: 'rgba(59,130,246,0.06)',
    border: 'rgba(59,130,246,0.15)',
    badge: 'badge-blue',
    label: '🫀 Cardiac',
  },
  general_surgery: {
    bg: 'rgba(16,185,129,0.06)',
    border: 'rgba(16,185,129,0.15)',
    badge: 'badge-green',
    label: '🟢 General Surgery',
  },
  neurosurgery: {
    bg: 'rgba(139,92,246,0.06)',
    border: 'rgba(139,92,246,0.15)',
    badge: 'badge-purple',
    label: '🧠 Neurosurgery',
  },
  orthopedic: {
    bg: 'rgba(245,158,11,0.06)',
    border: 'rgba(245,158,11,0.15)',
    badge: 'badge-amber',
    label: '🦴 Orthopedic',
  },
};

// Available consignment units = total - used - opened_not_implanted - returned
const getAvailable = (c) =>
  c.quantity -
  (c.usedQuantity || 0) -
  (c.openedNotUsed || 0) -
  (c.returnedQuantity || 0);

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [expiryAlerts, setExpiryAlerts] = useState({ alerts:[], counts:{critical:0,warning:0} });
  const [mdrSummary,    setMdrSummary]    = useState({ overdue:0, critical:0, warning:0, total:0 });
  const [ccVersion, setCcVersion] = useState('implant …');
  const [inventory, setInventory] = useState([]);
  const [consignments, setConsignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Data loading ────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/chaincode-version')
      .then((r) => r.json())
      .then((d) => setCcVersion(d.label || 'implant ' + d.version))
      .catch(() => setCcVersion('implant'));
  }, []);

  useEffect(() => {
    if (authLoading || !user?.role) return;

    const role = user.role;

    const loadData = async () => {
      setLoading(true);
      setError('');

      // Roles that need consignment data for KPIs
      if (['supply_chain', 'nurse', 'distributor'].includes(role)) {
        try {
          const cons = await api.getConsignments({});
          setConsignments(cons || []);
        } catch {}
      }

      // Load expiry alerts in background (non-blocking)
      api.getExpiryAlerts()
        .then(data => setExpiryAlerts(data || { alerts:[], counts:{critical:0,warning:0} }))
        .catch(() => {});

      // Load MDR deadlines for compliance roles
      if (['infection_prevention','government','admin','nurse','supply_chain'].includes(role)) {
        api.getMDRDeadlines()
          .then(data => setMdrSummary(data?.summary || { overdue:0, critical:0, warning:0, total:0 }))
          .catch(() => {});
      }

      const [s, inv] = await Promise.allSettled([
        api.getStats(),
        api.getInventory(),
      ]);

      if (s.status === 'fulfilled') setStats(s.value);
      else setError(s.reason?.message || 'Failed to load stats');

      if (inv.status === 'fulfilled') {
        const data = inv.value || [];
        setInventory(
          role === 'manufacturer'
            ? data.filter((d) => d.manufacturerId === user.username)
            : data,
        );
      }
      setLoading(false);
    };

    loadData();
  }, [user, authLoading]);

  // ── Derived data ────────────────────────────────────────────────

  const role = user?.role;
  const portal = ROLE_PORTAL[role];

  // For hospital/distributor roles: filter inventory to devices present in their consignments
  const consignmentUDIs =
    consignments.length > 0 ? new Set(consignments.map((c) => c.udiDI)) : null;
  const displayInv = consignmentUDIs
    ? inventory.filter((d) => consignmentUDIs.has(d.udiDI))
    : inventory;

  // Inventory-level aggregates
  const invDevices = displayInv.length;
  const invClear = displayInv.reduce(
    (s, d) =>
      s + (d.clearances?.filter((c) => c.status === 'active').length || 0),
    0,
  );
  const invLots = displayInv.reduce((s, d) => s + (d.lotCount || 0), 0);
  const invRecalled = displayInv.reduce((s, d) => s + (d.recalledLots || 0), 0);
  const invProduced = displayInv.reduce(
    (s, d) => s + (d.totalProduced || 0),
    0,
  );
  const invImplanted = displayInv.reduce(
    (s, d) => s + (d.totalImplanted || 0),
    0,
  );
  const invRemaining = displayInv.reduce(
    (s, d) => s + (d.totalRemaining || 0),
    0,
  );

  // Consignment-level aggregates (used for supply_chain/nurse/distributor KPIs)
  const activeCons = consignments.filter((c) => c.status === 'active');
  const totalPlaced = activeCons.reduce((s, c) => s + c.quantity, 0);
  const totalUsed = activeCons.reduce((s, c) => s + (c.usedQuantity || 0), 0);
  const totalAvail = activeCons.reduce((s, c) => s + getAvailable(c), 0);

  const recalled = inventory.filter((d) => d.recalledLots > 0);
  // Consignments at this hospital from recalled lots
  const recalledInConsignments = displayInv.filter(
    d => d.recalledLots > 0 && consignmentUDIs?.has(d.udiDI)
  );
  const backorder = inventory.filter((d) => d.backordered);
  const lowStock = displayInv.filter(
    (d) => d.totalProduced > 0 && d.totalRemaining / d.totalProduced < 0.1,
  );

  // ── KPI definitions by role ─────────────────────────────────────

  const kpiCards = () => {
    if (!role) return [];

    if (['government', 'infection_prevention', 'admin'].includes(role))
      return [
        { label: 'Medical Devices', value: stats?.devices, color: 'blue' },
        {
          label: 'Active Clearances',
          value: stats?.activeClearances,
          color: 'green',
        },
        { label: 'ISO 13485 Certs', value: stats?.activeCerts, color: 'cyan' },
        { label: 'Active Lots', value: stats?.activeLots, color: 'purple' },
        {
          label: 'In Quarantine',
          value: stats?.quarantineLots,
          color: 'amber',
        },
        { label: 'Recalled Lots', value: stats?.recalledLots, color: 'red' },
        {
          label: 'Active Implants',
          value: stats?.activeImplants,
          color: 'blue',
        },
        { label: 'Explants',        value: stats?.explants,     color: 'amber' },
        { label: 'MDR Overdue',       value: mdrSummary.overdue,  color: 'red'   },
        { label: 'MDR Due ≤7 Days',   value: mdrSummary.critical, color: 'amber' },
      ];

    if (role === 'manufacturer')
      return [
        { label: 'My Devices', value: invDevices, color: 'green' },
        { label: 'Active Clearances', value: invClear, color: 'blue' },
        { label: 'ISO 13485 Certs', value: stats?.activeCerts, color: 'cyan' },
        { label: 'Lots Created', value: invLots, color: 'purple' },
        { label: 'Recalled Lots', value: invRecalled, color: 'red' },
        { label: 'Units Produced', value: invProduced, color: 'blue' },
        { label: 'Units Implanted', value: invImplanted, color: 'amber' },
        { label: 'Units Remaining', value: invRemaining, color: 'green' },
      ];

    if (role === 'distributor') {
      const recalledC = consignments.filter(
        (c) => c.status === 'recalled',
      ).length;
      return [
        {
          label: 'Active Consignments',
          value: activeCons.length,
          color: 'cyan',
        },
        {
          label: 'Hospitals Covered',
          value: new Set(activeCons.map((c) => c.hospitalId)).size,
          color: 'blue',
        },
        { label: 'Units Placed', value: totalPlaced, color: 'purple' },
        { label: 'Units Used', value: totalUsed, color: 'amber' },
        { label: 'Units Available', value: totalAvail, color: 'green' },
        { label: 'Recalled', value: recalledC, color: 'red' },
        {
          label: 'Active Implants',
          value: stats?.activeImplants || 0,
          color: 'blue',
        },
        {
          label: 'Backordered Lots',
          value: stats?.backordered || 0,
          color: 'amber',
        },
      ];
    }

    if (['supply_chain', 'nurse'].includes(role))
      return [
        {
          label: 'Active Consignments',
          value: activeCons.length,
          color: 'cyan',
        },
        {
          label: 'Devices at Hospital',
          value: new Set(activeCons.map((c) => c.udiDI)).size,
          color: 'blue',
        },
        { label: 'Units Available', value: totalAvail, color: 'green' },
        { label: 'Units Used', value: totalUsed, color: 'amber' },
        { label: 'Low Stock Alerts', value: lowStock.length, color: 'amber' },
        {
          label: 'Recalled Devices',
          value: recalledInConsignments.length,
          color: 'red',
        },
        {
          label: 'Active Implants',
          value: stats?.activeImplants || 0,
          color: 'blue',
        },
        {
          label: 'Backordered Lots',
          value: stats?.backordered || 0,
          color: 'purple',
        },
      ];

    return [
      { label: 'Medical Devices', value: stats?.devices, color: 'blue' },
      { label: 'Active Lots', value: stats?.activeLots, color: 'purple' },
      {
        label: 'Consignments',
        value: stats?.activeConsignments,
        color: 'cyan',
      },
      {
        label: 'Active Implants',
        value: stats?.activeImplants,
        color: 'green',
      },
    ];
  };

  // ── Render ──────────────────────────────────────────────────────

  return (
    <>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>
          Welcome back, <strong>{user?.username}</strong>
          {user?.organization ? ` — ${user.organization}` : ''} · ImplantChain
        </p>
      </div>

      {/* Global alerts */}
      {recalled.length > 0 && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          ⚠ <strong>Active Recalls:</strong>{' '}
          {recalled
            .map(
              (d) =>
                `${d.deviceName} (${d.recalledLots} lot${d.recalledLots > 1 ? 's' : ''})`,
            )
            .join(', ')}
        </div>
      )}
      {backorder.length > 0 && (
        <div className="alert alert-amber" style={{ marginBottom: 12 }}>
          ⚠ <strong>Backordered:</strong>{' '}
          {backorder.map((d) => d.deviceName).join(', ')}
        </div>
      )}
      {lowStock.length > 0 && (
        <div className="alert alert-amber" style={{ marginBottom: 12 }}>
          ⚠ <strong>Low Stock (&lt;10%):</strong>{' '}
          {lowStock
            .map((d) => `${d.deviceName} (${d.totalRemaining} remaining)`)
            .join(', ')}
        </div>
      )}

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          ⚠ {error}
        </div>
      )}

      {/* Expiry Alerts */}
      {expiryAlerts.counts.critical > 0 && (
        <div className="alert alert-error" style={{marginBottom:8}}>
          ⚠ <strong>{expiryAlerts.counts.critical} critical expiry alert{expiryAlerts.counts.critical!==1?'s':''}</strong>
          {' '}— {expiryAlerts.alerts.filter(a=>a.urgency==='critical').slice(0,3).map(a=>
            `${a.name} expires in ${a.days}d`
          ).join(' · ')}
          {expiryAlerts.counts.critical > 3 ? ' · and more…' : ''}
        </div>
      )}
      {expiryAlerts.counts.warning > 0 && expiryAlerts.counts.critical === 0 && (
        <div className="alert alert-amber" style={{marginBottom:8}}>
          ⚠ <strong>{expiryAlerts.counts.warning} expiry warning{expiryAlerts.counts.warning!==1?'s':''}</strong>
          {' '}— {expiryAlerts.alerts.filter(a=>a.urgency==='warning').slice(0,3).map(a=>
            `${a.name} expires in ${a.days}d`
          ).join(' · ')}
        </div>
      )}

      {/* MDR Deadline Alert */}
      {['infection_prevention','government','admin','nurse'].includes(role) && mdrSummary.overdue > 0 && (
        <div className="alert alert-error" style={{marginBottom:8}}>
          ⚠ <strong>{mdrSummary.overdue} MDR report{mdrSummary.overdue!==1?'s':''} OVERDUE</strong>
          {' '}— FDA 21 CFR Part 803 deadline passed. File immediately at{' '}
          <a href="https://www.accessdata.fda.gov/scripts/medwatch" target="_blank" rel="noreferrer"
            style={{color:'var(--accent-red)',fontWeight:600}}>FDA MedWatch</a>
        </div>
      )}
      {['infection_prevention','government','admin','nurse'].includes(role) && mdrSummary.overdue === 0 && mdrSummary.critical > 0 && (
        <div className="alert alert-amber" style={{marginBottom:8}}>
          ⏰ <strong>{mdrSummary.critical} MDR report{mdrSummary.critical!==1?'s':''} due within 7 days</strong>
          {' '}— File at FDA MedWatch before deadline
        </div>
      )}

      {/* Nurse/Supply Chain — recalled devices in consignment inventory */}
      {['nurse','supply_chain'].includes(role) && recalledInConsignments.length > 0 && (
        <div className="alert alert-error" style={{marginBottom:8}}>
          ⚠ <strong>Recalled devices in your hospital inventory:</strong>{' '}
          {recalledInConsignments.map(d=>d.deviceName).join(', ')}
          {' '}— Contact your rep immediately and do not use these devices.
        </div>
      )}

      {/* KPI Grid */}
      <div
        className="kpi-grid"
        style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 16 }}
      >
        {kpiCards().map(({ label, value, color }) => (
          <div key={label} className={`kpi-card ${color}`}>
            <div className="kpi-label">{label}</div>
            <div
              className="kpi-value"
              style={{ color: `var(--accent-${color})` }}
            >
              {loading ? '—' : (value ?? 0).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <div className="two-col">
        {/* Portal shortcut */}
        {portal && (
          <div className="card" style={{ borderColor: `${portal.color}30` }}>
            <div className="card-header">
              <span className="card-title">Your Portal</span>
            </div>
            <div
              onClick={() => navigate(portal.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: 20,
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${portal.color}30`,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = portal.color)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = `${portal.color}30`)
              }
            >
              <span style={{ fontSize: 36 }}>{portal.icon}</span>
              <div>
                <div
                  style={{ fontSize: 16, fontWeight: 700, color: portal.color }}
                >
                  {portal.label}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    marginTop: 4,
                  }}
                >
                  {portal.desc}
                </div>
              </div>
              <span
                style={{
                  marginLeft: 'auto',
                  color: 'var(--text-muted)',
                  fontSize: 18,
                }}
              >
                →
              </span>
            </div>
          </div>
        )}

        {/* Fabric network info */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">⬡ Fabric Network</span>
            <span className="badge badge-green">Connected</span>
          </div>
          {[
            { label: 'Channel', value: 'mychannel' },
            { label: 'Chaincode', value: ccVersion },
            { label: 'Standard', value: 'FDA UDI / EU MDR / ISO 13485' },
            { label: 'MSP', value: 'Org1MSP' },
            {
              label: 'Identity',
              value: user?.identityLabel || user?.username || '—',
            },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {label}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--accent-cyan)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Device Inventory table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            🦾 Device Inventory
            <span className="badge badge-blue" style={{ marginLeft: 8 }}>
              {displayInv.length} devices
            </span>
          </span>
        </div>
        {loading ? (
          <div className="loading-overlay">
            <span className="spinner" /> Loading…
          </div>
        ) : displayInv.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🦾</div>
            <p>No medical devices registered yet</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Clearance</th>
                  <th>ISO 13485</th>
                  <th>Lots</th>
                  <th>Produced</th>
                  <th>Implanted</th>
                  <th>Remaining</th>
                  <th>Stock %</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const sorted = [...displayInv].sort(
                    (a, b) =>
                      (a.deviceCategory || '').localeCompare(
                        b.deviceCategory || '',
                      ) ||
                      (a.deviceName || '').localeCompare(b.deviceName || ''),
                  );
                  let lastCat = null;
                  return sorted.map((d) => {
                    const pct =
                      d.totalProduced > 0
                        ? Math.round((d.totalRemaining / d.totalProduced) * 100)
                        : 0;
                    const sc =
                      pct > 50
                        ? 'var(--accent-green)'
                        : pct > 10
                          ? 'var(--accent-amber)'
                          : 'var(--accent-red)';
                    const clearBadge = d.clearances?.find(
                      (c) => c.status === 'active' && !c.expired,
                    ) ? (
                      <span className="badge badge-green">Active</span>
                    ) : (
                      <span className="badge badge-red">None</span>
                    );
                    const certBadge =
                      d.certStatus === 'valid' ? (
                        <span className="badge badge-green">Valid</span>
                      ) : d.certStatus === 'expired' ? (
                        <span className="badge badge-amber">Expired</span>
                      ) : (
                        <span className="badge badge-red">None</span>
                      );
                    const cat = CC[d.deviceCategory] || {
                      bg: 'transparent',
                      border: 'transparent',
                      badge: 'badge-blue',
                      label: d.deviceCategory,
                    };
                    const newCat = d.deviceCategory !== lastCat;
                    lastCat = d.deviceCategory;
                    return (
                      <>
                        {newCat && (
                          <tr key={'cat-' + d.deviceCategory}>
                            <td
                              colSpan={10}
                              style={{
                                padding: '8px 12px',
                                background: cat.border,
                                borderTop: '2px solid ' + cat.border,
                                fontSize: 11,
                                fontWeight: 700,
                                color: 'var(--text-secondary)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              {cat.label}
                            </td>
                          </tr>
                        )}
                        <tr key={d.udiDI} style={{ background: cat.bg }}>
                          <td>
                            <div
                              style={{
                                color: 'var(--text-primary)',
                                fontWeight: 600,
                              }}
                            >
                              {d.deviceName}
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: 'var(--text-muted)',
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              {d.udiDI}
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${cat.badge}`}>
                              {(d.deviceCategory || '').replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td style={{ fontSize: 12 }}>{d.deviceType}</td>
                          <td>{clearBadge}</td>
                          <td>{certBadge}</td>
                          <td style={{ textAlign: 'center' }}>
                            {d.lotCount || 0}
                            {d.recalledLots > 0 && (
                              <span
                                className="badge badge-red"
                                style={{ marginLeft: 4, fontSize: 9 }}
                              >
                                {d.recalledLots} recalled
                              </span>
                            )}
                            {d.backordered && (
                              <span
                                className="badge badge-amber"
                                style={{ marginLeft: 4, fontSize: 9 }}
                              >
                                BO
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {(d.totalProduced || 0).toLocaleString()}
                          </td>
                          <td
                            style={{
                              textAlign: 'center',
                              color: 'var(--accent-amber)',
                            }}
                          >
                            {(d.totalImplanted || 0).toLocaleString()}
                          </td>
                          <td
                            style={{
                              textAlign: 'center',
                              color: sc,
                              fontWeight: 600,
                            }}
                          >
                            {(d.totalRemaining || 0).toLocaleString()}
                          </td>
                          <td>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <div
                                style={{
                                  flex: 1,
                                  height: 5,
                                  background: 'var(--border)',
                                  borderRadius: 3,
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${pct}%`,
                                    height: '100%',
                                    background: sc,
                                    borderRadius: 3,
                                  }}
                                />
                              </div>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: sc,
                                  minWidth: 32,
                                }}
                              >
                                {pct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      </>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
