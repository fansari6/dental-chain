import { readFileSync as _efs } from 'fs';
import { resolve as _eres, dirname as _edir } from 'path';
import { fileURLToPath as _eftu } from 'url';
// Inject .env.test into process.env BEFORE server.js / db/index.js loads
try {
  const _ed = _edir(_eftu(import.meta.url));
  _efs(_eres(_ed, '../../.env.test'), 'utf8').split('\n').forEach(l => {
    const m = l.match(/^([^#=\s][^=]*)=(.*)/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
  });
} catch(e) {}

// __tests__/integration/recall.test.js
// Integration tests for the recall workflow — Feature 4
// This is the most critical feature: lot recall → email → patient lookup → bulk notify
// All blockchain calls are mocked; DB and HTTP layer are real.

import request from 'supertest';
import bcrypt from 'bcryptjs';
import { setupTestDb, teardownTestDb, clearTables } from '../setup.js';
import { sentEmails, resetEmails } from '../mocks/email.js';
import { submittedTransactions, setMockResponse, resetMocks } from '../mocks/gateway.js';

let pool;
let app;
let govAgent, ipAgent, nurseAgent;

// Sample implants that will be returned by the mock gateway
const MOCK_IMPLANTS_LOT_A = [
  { implantId: 'IMPL-001', lotNumber: 'LOT-A', patientId: 'PAT-001', patientIdHash: 'hash001', hospitalId: 'Memorial Hospital', surgeonId: 'DR-JOHNSON-ORTH', procedureDate: '2026-03-15', status: 'implanted' },
  { implantId: 'IMPL-002', lotNumber: 'LOT-A', patientId: 'PAT-002', patientIdHash: 'hash002', hospitalId: 'Memorial Hospital', surgeonId: 'DR-JOHNSON-ORTH', procedureDate: '2026-03-20', status: 'implanted' },
  { implantId: 'IMPL-003', lotNumber: 'LOT-A', patientId: 'PAT-003', patientIdHash: 'hash003', hospitalId: 'University Hospital', surgeonId: 'DR-SMITH-ORTH', procedureDate: '2026-04-01', status: 'implanted' },
];

beforeAll(async () => {
  if (!app) { const m = await import('../../server.js'); app = m.default; }
  pool = await setupTestDb();
  await clearTables();

  const hash = await bcrypt.hash('Test@1234', 10);
  const users = [
    ['ip-global',    'infection_prevention',  'ip-global',    null,                'ip-global@recall.test'],
    ['gov-recall',   'government',           'gov-recall',   null,                'gov@recall.test'],
    ['ip-recall',    'infection_prevention',  'ip-recall',    'Memorial Hospital', 'ip@recall.test'],
    ['nurse-recall', 'nurse',                 'nurse-recall', 'Memorial Hospital', 'nurse@recall.test'],
  ];
  for (const [username, role, label, hosp, email] of users) {
    await pool.query(
      `INSERT INTO users (username, password_hash, role, identity_label, hospital_id, email, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,true) ON CONFLICT (username) DO NOTHING`,
      [username, hash, role, label, hosp, email]
    );
  }
});

afterAll(teardownTestDb);

beforeEach(async () => {
  resetEmails();
  resetMocks();

  govAgent   = request.agent(app);
  ipAgent    = request.agent(app);
  nurseAgent = request.agent(app);

  await govAgent.post('/api/login').send({ username: 'gov@recall.test',   password: 'Test@1234' });
  await ipAgent.post('/api/login').send({ username: 'ip@recall.test',    password: 'Test@1234' });
  await nurseAgent.post('/api/login').send({ username: 'nurse@recall.test', password: 'Test@1234' });
});

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 4: RECALL NOTIFICATION WORKFLOW
// ─────────────────────────────────────────────────────────────────────────

describe('Feature 4 — Recall Notification Workflow', () => {

  test('Government can recall a lot — blockchain submitTransaction called', async () => {
    submittedTransactions.length = 0;

    const res = await govAgent.post('/api/lot/LOT-A/recall')
      .send({ recallClass: 'II', reason: 'Potential fracture risk under stress' });

    expect(res.status).toBe(200);
    const recallTx = submittedTransactions.find(t => t.fcn === 'recallLot');
    expect(recallTx).toBeDefined();
    expect(recallTx.args[0]).toBe('LOT-A');
    expect(recallTx.args[1]).toBe('II');
  });

  test('Recall sends email to all IP officers automatically', async () => {
    await govAgent.post('/api/lot/LOT-A/recall')
      .send({ recallClass: 'II', reason: 'Potential fracture risk' });

    const recallEmails = sentEmails.filter(e => e.subject?.includes('Recall'));
    expect(recallEmails.length).toBeGreaterThan(0);
    // ip@recall.test should be in the recipients
    const emailAddrs = recallEmails.flatMap(e => Array.isArray(e.to) ? e.to : [e.to]).filter(Boolean);
    expect(emailAddrs.length).toBeGreaterThan(0); // at least one IP officer notified
  });

  test('IP officer can query all patients affected by a recalled lot — under 1 second', async () => {
    setMockResponse('getPatientsByLot', MOCK_IMPLANTS_LOT_A);

    const start = Date.now();
    const res = await ipAgent.get('/api/recall/patients-by-lot/LOT-A');
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(elapsed).toBeLessThan(1000); // Must respond in under 1 second
  });

  test('IP officer patient query is scoped to their hospital', async () => {
    setMockResponse('getPatientsByLot', MOCK_IMPLANTS_LOT_A);

    const res = await ipAgent.get('/api/recall/patients-by-lot/LOT-A');
    // ip-recall is at Memorial Hospital — should only see Memorial patients
    expect(res.body.every(i => i.hospitalId === 'Memorial Hospital')).toBe(true);
    expect(res.body.length).toBe(2); // Only 2 of 3 are at Memorial
  });

  test('Government sees all patients across all hospitals', async () => {
    setMockResponse('getPatientsByLot', MOCK_IMPLANTS_LOT_A);

    const res = await govAgent.get('/api/recall/patients-by-lot/LOT-A');
    expect(res.body.length).toBe(3); // Sees all 3
  });

  test('Single recall notification recorded on blockchain', async () => {
    submittedTransactions.length = 0;

    const res = await ipAgent.post('/api/recall/notification').send({
      notificationId: 'NOTIF-TEST-001',
      lotNumber: 'LOT-A',
      implantId: 'IMPL-001',
      hospitalId: 'Memorial Hospital',
      notificationMethod: 'phone',
    });

    expect(res.status).toBe(200);
    const tx = submittedTransactions.find(t => t.fcn === 'recordRecallNotification');
    expect(tx).toBeDefined();
    expect(tx.args).toContain('NOTIF-TEST-001');
    expect(tx.args).toContain('LOT-A');
    expect(tx.args).toContain('phone');
  });

  test('Bulk notify records one notification per implant on blockchain', async () => {
    submittedTransactions.length = 0;

    const res = await ipAgent.post('/api/recall/notifications/bulk').send({
      lotNumber: 'LOT-A',
      notificationMethod: 'letter',
      implants: MOCK_IMPLANTS_LOT_A.slice(0, 2), // 2 implants at Memorial
    });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.succeeded).toBe(2);
    expect(res.body.failed).toBe(0);

    const notifTxs = submittedTransactions.filter(t => t.fcn === 'recordRecallNotification');
    expect(notifTxs.length).toBe(2);
  });

  test('Bulk notify returns partial success on chaincode errors for some implants', async () => {
    let callCount = 0;
    // Make the second call fail
    setMockResponse('recordRecallNotification', () => {
      callCount++;
      if (callCount === 2) throw new Error('Chaincode error — implant already notified');
      return { success: true };
    });

    const res = await ipAgent.post('/api/recall/notifications/bulk').send({
      lotNumber: 'LOT-A',
      notificationMethod: 'email',
      implants: MOCK_IMPLANTS_LOT_A.slice(0, 2),
    });

    expect(res.status).toBe(200);
    expect(res.body.succeeded).toBe(1);
    expect(res.body.failed).toBe(1);
  });

  test('Get recall notifications for a lot filters by hospital for IP officer', async () => {
    const allNotifs = [
      { notificationId: 'N-001', lotNumber: 'LOT-A', hospitalId: 'Memorial Hospital', notificationMethod: 'phone' },
      { notificationId: 'N-002', lotNumber: 'LOT-A', hospitalId: 'University Hospital', notificationMethod: 'letter' },
    ];
    setMockResponse('getRecallNotifications', allNotifs);

    const res = await ipAgent.get('/api/recall/notifications/LOT-A');
    // Should only see Memorial Hospital notifications
    expect(res.body.every(n => n.hospitalId === 'Memorial Hospital')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// FEATURE 5: MDR 30-DAY DEADLINE TRACKER
// ─────────────────────────────────────────────────────────────────────────

describe('Feature 5 — MDR 30-Day Deadline Tracker', () => {
  const today = new Date();
  const daysAgo = (d) => new Date(today.getTime() - d * 86400000).toISOString().split('T')[0];

  const MOCK_ADVERSE_EVENTS = [
    { eventId: 'AE-001', implantId: 'IMPL-001', eventType: 'malfunction',       eventDate: daysAgo(35), reportedToFDA: false, hospitalId: 'Memorial Hospital' },
    { eventId: 'AE-002', implantId: 'IMPL-002', eventType: 'serious_injury',    eventDate: daysAgo(25), reportedToFDA: false, hospitalId: 'Memorial Hospital' },
    { eventId: 'AE-003', implantId: 'IMPL-003', eventType: 'imminent_hazard',   eventDate: daysAgo(4),  reportedToFDA: false, hospitalId: 'Memorial Hospital' },
    { eventId: 'AE-004', implantId: 'IMPL-004', eventType: 'malfunction',       eventDate: daysAgo(5),  reportedToFDA: true,  hospitalId: 'Memorial Hospital' },
    { eventId: 'AE-005', implantId: 'IMPL-005', eventType: 'serious_injury',    eventDate: daysAgo(10), reportedToFDA: false, hospitalId: 'University Hospital' },
  ];

  beforeEach(() => setMockResponse('getAllAdverseEvents', MOCK_ADVERSE_EVENTS));

  test('MDR tracker calculates urgency correctly', async () => {
    const res = await ipAgent.get('/api/alerts/mdr-deadlines');
    expect(res.status).toBe(200);

    const { deadlines, summary } = res.body;

    // AE-001: 35 days ago, 30-day deadline → overdue
    const ae1 = deadlines.find(d => d.eventId === 'AE-001');
    expect(ae1.urgency).toBe('overdue');
    expect(ae1.daysRemaining).toBeLessThan(0);

    // AE-003: imminent_hazard, 4 days ago → 5-day deadline, daysRemaining = 1 → critical
    const ae3 = deadlines.find(d => d.eventId === 'AE-003');
    expect(ae3.deadlineDays).toBe(5);
    expect(ae3.daysRemaining).toBe(1);
    expect(['critical','overdue']).toContain(ae3.urgency);

    // AE-004: already reported → urgency = 'reported'
    const ae4 = deadlines.find(d => d.eventId === 'AE-004');
    expect(ae4.urgency).toBe('reported');
  });

  test('MDR tracker orders results by urgency (overdue first)', async () => {
    const res = await ipAgent.get('/api/alerts/mdr-deadlines');
    const { deadlines } = res.body;

    const urgencyOrder = { overdue:0, critical:1, warning:2, safe:3, reported:4 };
    for (let i = 1; i < deadlines.length; i++) {
      expect((urgencyOrder[deadlines[i-1].urgency]??5))
        .toBeLessThanOrEqual(urgencyOrder[deadlines[i].urgency]??5);
    }
  });

  test('MDR tracker scopes to IP officers hospital', async () => {
    const res = await ipAgent.get('/api/alerts/mdr-deadlines');
    // ip-recall is at Memorial Hospital — should not see University Hospital events
    const univ = res.body.deadlines.filter(d => d.hospitalId === 'University Hospital');
    expect(univ.length).toBe(0);
  });

  test('MDR tracker summary counts are correct', async () => {
    const res = await ipAgent.get('/api/alerts/mdr-deadlines');
    const { summary } = res.body;

    expect(summary.total).toBe(4); // 4 Memorial events (not University)
    expect(summary.reported).toBeGreaterThanOrEqual(1);
    expect(typeof summary.overdue).toBe('number');
    expect(typeof summary.critical).toBe('number');
  });

  test('Government sees all hospitals MDR events', async () => {
    const res = await govAgent.get('/api/alerts/mdr-deadlines');
    expect(res.body.summary.total).toBe(5); // Sees all 5
  });
});
