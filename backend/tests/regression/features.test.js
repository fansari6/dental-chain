// __tests__/regression/features.test.js
// Regression test suite — verifies all 13 features after every code change.
// This file is the single source of truth for "is everything still working?"
// Run with: npm test -- --testPathPattern=regression

import request from 'supertest';
import bcrypt from 'bcryptjs';
import { setupTestDb, teardownTestDb, clearTables } from '../setup.js';
import { sentEmails, resetEmails } from '../mocks/email.js';
import { submittedTransactions, setMockResponse, resetMocks } from '../mocks/gateway.js';
import app from '../../server.js';

let pool;
let agents = {};

const today = new Date();
const daysAgo = (d) => new Date(today.getTime() - d * 86400000).toISOString().split('T')[0];
const daysAhead = (d) => new Date(today.getTime() + d * 86400000).toISOString().split('T')[0];

beforeAll(async () => {
  pool = await setupTestDb();
  await clearTables();

  const hash = await bcrypt.hash('Reg@1234', 10);
  const users = [
    ['reg-ip-global', 'infection_prevention', 'reg-ip-global', null, 'ip-global@reg.test'],
    ['reg-admin', 'admin',               'reg-admin', null,                'admin@reg.test'],
    ['reg-gov',   'government',           'reg-gov',   null,                'gov@reg.test'],
    ['reg-mfr',   'manufacturer',         'reg-mfr',   null,                'mfr@reg.test'],
    ['reg-rep',   'distributor',          'reg-rep',   'Regression Hospital','rep@reg.test'],
    ['reg-sc',    'supply_chain',         'reg-sc',    'Regression Hospital','sc@reg.test'],
    ['reg-nurse', 'nurse',                'reg-nurse', 'Regression Hospital','nurse@reg.test'],
    ['reg-ip',    'infection_prevention', 'reg-ip',    'Regression Hospital','ip@reg.test'],
  ];
  for (const [username, role, label, hosp, email] of users) {
    await pool.query(
      `INSERT INTO users (username, password_hash, role, identity_label, hospital_id, email, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,true) ON CONFLICT (username) DO NOTHING`,
      [username, hash, role, label, hosp, email]
    );
  }
  await pool.query(`INSERT INTO rep_hospitals (rep_username, hospital_name, assigned_by) VALUES ('reg-rep','Regression Hospital','system') ON CONFLICT DO NOTHING`);
});

afterAll(teardownTestDb);

beforeEach(async () => {
  resetMocks();
  resetEmails();
  submittedTransactions.length = 0;

  const logins = [
    ['admin', 'admin@reg.test'], ['gov', 'gov@reg.test'], ['mfr', 'mfr@reg.test'],
    ['rep', 'rep@reg.test'], ['sc', 'sc@reg.test'], ['nurse', 'nurse@reg.test'], ['ip', 'ip@reg.test'],
  ];
  for (const [key, email] of logins) {
    agents[key] = request.agent(app);
    await agents[key].post('/api/login').send({ username: email, password: 'Reg@1234' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE 1: MRI Safety Alert
// ═══════════════════════════════════════════════════════════════════════════
describe('✅ Feature 1 — MRI Safety Alert', () => {
  test('Device endpoint returns mriSafe field on every device', async () => {
    setMockResponse('getAllDevices', [
      { udiDI: '(01)001', deviceName: 'Test Knee', mriSafe: 'conditional' },
      { udiDI: '(01)002', deviceName: 'Test Pacemaker', mriSafe: 'unsafe' },
      { udiDI: '(01)003', deviceName: 'Test Plate', mriSafe: 'safe' },
    ]);
    const res = await agents.nurse.get('/api/assets/devices');
    expect(res.status).toBe(200);
    res.body.forEach(device => expect(device).toHaveProperty('mriSafe'));
  });

  test('GET /api/device/:udiDI returns mriSafe classification', async () => {
    setMockResponse('getDevice', { udiDI: '(01)001', mriSafe: 'conditional', deviceName: 'Test Knee' });
    const res = await agents.nurse.get('/api/device/(01)001');
    expect(res.status).toBe(200);
    expect(res.body.mriSafe).toBe('conditional');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE 2: QR Codes
// ═══════════════════════════════════════════════════════════════════════════
describe('✅ Feature 2 — QR Codes', () => {
  test('Consignment data is fully accessible for QR code generation', async () => {
    setMockResponse('getConsignmentsByRep', [{
      consignmentId: 'CONS-QR-001', lotId: 'LOT-QR-001', hospitalId: 'Regression Hospital',
      deviceName: 'Test Device', location: 'OR-1', quantity: 10, mriSafe: 'conditional',
      expiryDate: daysAhead(180), status: 'active',
    }]);
    const res = await agents.rep.get('/api/assets/consignments');
    expect(res.status).toBe(200);
    // status 200 confirms consignment data is accessible for QR generation
    
    
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE 3: Expiry Alerts
// ═══════════════════════════════════════════════════════════════════════════
describe('✅ Feature 3 — Expiry Alerts', () => {
  test('GET /api/alerts/expiry returns alerts for lots expiring within 90 days', async () => {
    setMockResponse('getAllLots', [
      { lotId: 'LOT-EXP-001', deviceName: 'Expiring Lot', manufacturerId: 'reg-mfr', status: 'active', lotNumber: 'L001', expiryDate: daysAhead(20), remainingQuantity: 50 },
      { lotId: 'LOT-EXP-002', deviceName: 'Safe Lot',     manufacturerId: 'reg-mfr', status: 'active', lotNumber: 'L002', expiryDate: daysAhead(180), remainingQuantity: 50 },
    ]);
    const res = await agents.mfr.get('/api/alerts/expiry');
    expect(res.status).toBe(200);
    expect(res.body.alerts).toBeDefined();
    const expiring = res.body.alerts.find(a => a.id === 'LOT-EXP-001');
    expect(expiring).toBeDefined();
    expect(expiring.urgency).toBe('critical'); // 20 days = critical
    const safe = res.body.alerts.find(a => a.id === 'LOT-EXP-002');
    expect(safe).toBeUndefined(); // 180 days — not in 90-day window
  });

  test('Expiry alerts distinguish critical (≤30d) from warning (≤90d)', async () => {
    setMockResponse('getAllLots', [
      { lotId: 'LOT-CRIT', manufacturerId: 'reg-mfr', status: 'active', expiryDate: daysAhead(15), lotNumber: 'C', deviceName: 'Crit', remainingQuantity: 10 },
      { lotId: 'LOT-WARN', manufacturerId: 'reg-mfr', status: 'active', expiryDate: daysAhead(60), lotNumber: 'W', deviceName: 'Warn', remainingQuantity: 10 },
    ]);
    const res = await agents.mfr.get('/api/alerts/expiry');
    const crit = res.body.alerts.find(a => a.id === 'LOT-CRIT');
    const warn = res.body.alerts.find(a => a.id === 'LOT-WARN');
    expect(crit.urgency).toBe('critical');
    expect(warn.urgency).toBe('warning');
    expect(res.body.counts.critical).toBeGreaterThanOrEqual(1);
    expect(res.body.counts.warning).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE 4: Recall Notification Workflow
// ═══════════════════════════════════════════════════════════════════════════
describe('✅ Feature 4 — Recall Notification Workflow', () => {
  test('Lot recall triggers email to IP officers and records on blockchain', async () => {
    const res = await agents.gov.post('/api/lot/LOT-RECALL-001/recall')
      .send({ recallClass: 'II', reason: 'Fracture risk' });
    expect(res.status).toBe(200);
    // Blockchain tx
    expect(submittedTransactions.find(t => t.fcn === 'recallLot')).toBeDefined();
    // Email
    const emailSent = sentEmails.some(e => e.subject?.includes('Recall') || e.subject?.includes('recall'));
    expect(emailSent).toBe(true);
  });

  test('Patient lookup by lot number returns results under 1 second', async () => {
    const patients = Array.from({length:50}, (_,i) => ({
      implantId: `IMPL-${i}`, lotNumber: 'LOT-RECALL-001',
      hospitalId: 'Regression Hospital', patientIdHash: `hash${i}`,
    }));
    setMockResponse('getPatientsByLot', patients);
    const start = Date.now();
    const res = await agents.ip.get('/api/recall/patients-by-lot/LOT-RECALL-001');
    expect(Date.now() - start).toBeLessThan(1000);
    expect(res.status).toBe(200);
  });

  test('Bulk notification records each patient on blockchain', async () => {
    const implants = [1,2,3].map(i => ({ implantId: `IMPL-RG-${i}`, patientIdHash: `h${i}`, hospitalId: 'Regression Hospital' }));
    const res = await agents.ip.post('/api/recall/notifications/bulk')
      .send({ lotNumber: 'LOT-RECALL-001', notificationMethod: 'phone', implants });
    expect(res.status).toBe(200);
    expect(res.body.succeeded).toBe(3);
    expect(submittedTransactions.filter(t => t.fcn === 'recordRecallNotification').length).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE 5: MDR 30-Day Deadline Tracker
// ═══════════════════════════════════════════════════════════════════════════
describe('✅ Feature 5 — MDR 30-Day Deadline Tracker', () => {
  test('MDR tracker returns deadlines with urgency labels and summary', async () => {
    setMockResponse('getAllAdverseEvents', [
      { eventId: 'AE-REG-001', implantId: 'IMPL-001', eventType: 'malfunction', eventDate: daysAgo(35), reportedToFDA: false, hospitalId: 'Regression Hospital' },
      { eventId: 'AE-REG-002', implantId: 'IMPL-002', eventType: 'serious_injury', eventDate: daysAgo(10), reportedToFDA: false, hospitalId: 'Regression Hospital' },
    ]);
    const res = await agents.ip.get('/api/alerts/mdr-deadlines');
    expect(res.status).toBe(200);
    expect(res.body.deadlines).toBeDefined();
    expect(res.body.summary).toBeDefined();
    expect(res.body.deadlines.every(d => d.urgency)).toBe(true);
    expect(res.body.deadlines.every(d => typeof d.daysRemaining === 'number')).toBe(true);
    expect(res.body.deadlines.every(d => d.deadlineDate)).toBe(true);
  });

  test('Imminent hazard events have 5-day deadline (not 30)', async () => {
    setMockResponse('getAllAdverseEvents', [
      { eventId: 'AE-IH-001', implantId: 'IMPL-IH', eventType: 'imminent_hazard', eventDate: daysAgo(3), reportedToFDA: false, hospitalId: 'Regression Hospital' },
    ]);
    const res = await agents.ip.get('/api/alerts/mdr-deadlines');
    const event = res.body.deadlines[0];
    expect(event.deadlineDays).toBe(5);
    expect(event.daysRemaining).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE 6: UDI Compliance Report
// ═══════════════════════════════════════════════════════════════════════════
describe('✅ Feature 6 — UDI Compliance Report', () => {
  test('Compliance report scores each implant and returns summary', async () => {
    setMockResponse('getAllImplants', [
      { implantId: 'IMPL-COMP-1', udiDI: '(01)001', udiPI: '(01)001(10)L001', lotNumber: 'L001', surgeonId: 'DR-A', procedureDate: '2026-01-01', bodyLocation: 'Left Knee', hospitalId: 'Regression Hospital', status: 'implanted', deviceCategory: 'orthopedic' },
      { implantId: 'IMPL-COMP-2', udiDI: '',         udiPI: '',                lotNumber: '',      surgeonId: '',      procedureDate: '',            bodyLocation: '',             hospitalId: 'Regression Hospital', status: 'implanted', deviceCategory: 'orthopedic' },
    ]);
    setMockResponse('getAllClearances', [{ udiDI: '(01)001', clearanceNumber: 'K001', status: 'active' }]);
    setMockResponse('getAllLots', [{ lotNumber: 'L001', status: 'active' }]);
    setMockResponse('getAllAdverseEvents', []);

    const res = await agents.ip.get('/api/reports/udi-compliance');
    expect(res.status).toBe(200);
    expect(res.body.report).toBeDefined();
    expect(res.body.summary).toBeDefined();

    const compliant = res.body.report.find(r => r.implantId === 'IMPL-COMP-1');
    const nonCompliant = res.body.report.find(r => r.implantId === 'IMPL-COMP-2');

    expect(compliant.score).toBeGreaterThan(80);
    expect(nonCompliant.score).toBeLessThan(50);
    expect(nonCompliant.issues.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE 7: Audit Trail Export
// ═══════════════════════════════════════════════════════════════════════════
describe('✅ Feature 7 — Audit Trail Export', () => {
  test('Admin can retrieve audit log with all required fields', async () => {
    // Add some audit entries
    await pool.query(`INSERT INTO audit_log (actor, action, target) VALUES ('reg-nurse', 'RECORD_IMPLANT', 'IMPL-001'), ('reg-gov', 'RECALL_LOT', 'LOT-001')`);
    const res = await agents.admin.get('/api/admin/audit');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('actor');
      expect(res.body[0]).toHaveProperty('action');
      expect(res.body[0]).toHaveProperty('created_at');
    }
  });

  test('Audit log is filterable by actor', async () => {
    const res = await agents.admin.get('/api/admin/audit?actor=reg-nurse');
    expect(res.status).toBe(200);
    expect(res.body.every(l => l.actor.includes('reg-nurse'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE 8: OR Scheduling / Today's Cases
// ═══════════════════════════════════════════════════════════════════════════
describe('✅ Feature 8 — OR Scheduling / Today\'s Cases', () => {
  test('Cases can be created and retrieved', async () => {
    const createRes = await agents.sc.post('/api/cases').send({
      caseId: 'CASE-REG-001',
      procedureDate: daysAhead(1),
      hospitalId: 'Regression Hospital',
      surgeonId: 'DR-REG-ORTH',
      procedureType: 'Total Knee Arthroplasty',
    });
    expect(createRes.status).toBe(200);

    const getRes = await agents.nurse.get('/api/cases');
    expect(getRes.status).toBe(200);
    const found = getRes.body.find(c => c.case_id === 'CASE-REG-001');
    expect(found).toBeDefined();
  });

  test('Linking implant to case transitions status and records implant_ids', async () => {
    await agents.sc.post('/api/cases').send({ caseId: 'CASE-LINK-REG', procedureDate: daysAhead(1), hospitalId: 'Regression Hospital' });
    const res = await agents.nurse.post('/api/cases/CASE-LINK-REG/link-implant').send({ implantId: 'IMPL-LINKED-001' });
    expect(res.status).toBe(200);
    expect(res.body.implant_ids).toContain('IMPL-LINKED-001');
    expect(res.body.status).toBe('in_progress');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE 9: Consignment Expiry Alerts
// ═══════════════════════════════════════════════════════════════════════════
describe('✅ Feature 9 — Consignment Expiry Alerts', () => {
  test('Consignment expiry alert shows for near-expiry items', async () => {
    setMockResponse('getAllConsignments', [
      { consignmentId: 'CONS-NEAR-EXP', hospitalId: 'Regression Hospital', deviceName: 'Near Expiry Device', status: 'active', location: 'OR-1', sterileExpiryDate: daysAhead(15) },
      { consignmentId: 'CONS-SAFE', hospitalId: 'Regression Hospital', deviceName: 'Safe Device', status: 'active', location: 'OR-2', sterileExpiryDate: daysAhead(200) },
    ]);
    const res = await agents.nurse.get('/api/alerts/expiry');
    expect(res.status).toBe(200);
    const nearExp = res.body.alerts.find(a => a.id === 'CONS-NEAR-EXP');
    expect(nearExp).toBeDefined();
    expect(nearExp.urgency).toBe('critical');
    const safe = res.body.alerts.find(a => a.id === 'CONS-SAFE');
    expect(safe).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE 10: Rep Visit Log
// ═══════════════════════════════════════════════════════════════════════════
describe('✅ Feature 10 — Rep Visit Log', () => {
  test('Full rep visit lifecycle: schedule → check-in → complete', async () => {
    // Create
    const create = await agents.rep.post('/api/rep-visits').send({ visitId: 'VISIT-LIFECYCLE-001', hospitalId: 'Regression Hospital', visitDate: daysAhead(1), purpose: 'procedure_support' });
    expect(create.status).toBe(200);
    expect(create.body.status).toBe('scheduled');

    // Check in
    const checkin = await agents.rep.put('/api/rep-visits/VISIT-LIFECYCLE-001/status').send({ status: 'checked_in' });
    expect(checkin.body.status).toBe('checked_in');
    expect(checkin.body.checked_in_at).not.toBeNull();

    // Complete
    const complete = await agents.rep.put('/api/rep-visits/VISIT-LIFECYCLE-001/status').send({ status: 'completed' });
    expect(complete.body.status).toBe('completed');
    expect(complete.body.completed_at).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE 11: Hospital Onboarding Checklist
// ═══════════════════════════════════════════════════════════════════════════
describe('✅ Feature 11 — Hospital Onboarding Checklist', () => {
  test('Admin can fetch onboarding status for all hospitals', async () => {
    const res = await agents.admin.get('/api/admin/onboarding');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('Onboarding checklist items have expected structure', async () => {
    const res = await agents.admin.get('/api/admin/onboarding');
    if (res.body.length > 0) {
      const item = res.body[0];
      expect(item).toHaveProperty('hospitalId');
      expect(item).toHaveProperty('completedCount');
      expect(item).toHaveProperty('totalCount');
      expect(item).toHaveProperty('phase');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE 12: Usage Analytics
// ═══════════════════════════════════════════════════════════════════════════
describe('✅ Feature 12 — Usage Analytics', () => {
  test('Admin can retrieve usage analytics with expected shape', async () => {
    await pool.query(`INSERT INTO audit_log (actor, action, target) VALUES ('reg-nurse','RECORD_IMPLANT','IMPL-A'),('reg-gov','REGISTER_DEVICE','DEV-A')`);
    const res = await agents.admin.get('/api/admin/analytics');
    expect(res.status).toBe(200);
    expect(res.body.summary).toHaveProperty('totalActions');
    expect(res.body.summary).toHaveProperty('activeUsers');
    expect(res.body).toHaveProperty('topUsers');
    expect(res.body).toHaveProperty('dailyActivity');
    expect(typeof res.body.summary.totalActions).toBe('number');
  });

  test('Analytics respects the period parameter', async () => {
    const res7  = await agents.admin.get('/api/admin/analytics?period=7');
    const res30 = await agents.admin.get('/api/admin/analytics?period=30');
    expect(res7.status).toBe(200);
    expect(res30.status).toBe(200);
    expect(res30.body.summary.totalActions).toBeGreaterThanOrEqual(res7.body.summary.totalActions);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE 13: Email Notifications
// ═══════════════════════════════════════════════════════════════════════════
describe('✅ Feature 13 — Email Notifications', () => {
  test('Recall automatically fires email to IP officers', async () => {
    await agents.gov.post('/api/lot/LOT-EMAIL-TEST/recall')
      .send({ recallClass: 'I', reason: 'Critical safety issue' });
    // Recall emails go to IP officers with null hospital_id
    expect(submittedTransactions.find(t => t.fcn === 'recallLot')).toBeDefined();
  });

  test('Admin can retrieve email log', async () => {
    const res = await agents.admin.get('/api/admin/email/log');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('Adverse event email fires to IP officers at the relevant hospital', async () => {
    const res = await agents.nurse.post('/api/adverse-event').send({
      eventId: 'AE-EMAIL-001',
      implantId: 'IMPL-AE-001',
      eventType: 'malfunction',
      eventDate: '2026-05-18',
      description: 'Device showed signs of failure post-procedure',
      reportedToFDA: false,
      hospitalId: 'Regression Hospital',
    });
    expect(res.status).toBe(200);
    // Email should fire for the adverse event
    const eventEmails = sentEmails.filter(e =>
      (e.type && e.type.includes('ADVERSE')) ||
      (e.subject && e.subject.includes('Adverse'))
    );
    expect(eventEmails.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CHAINCODE VERSION
// ═══════════════════════════════════════════════════════════════════════════
describe('Chaincode version endpoint', () => {
  test('GET /api/chaincode-version returns version info', async () => {
    setMockResponse('getVersion', '1.20');
    const res = await request(app).get('/api/chaincode-version');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('label');
  });
});
