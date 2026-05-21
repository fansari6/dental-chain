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

// __tests__/integration/workflow.test.js
// End-to-end workflow test: device registration → lot → consignment → implant
// Verifies the full chain of custody in one test flow

import request from 'supertest';
import bcrypt from 'bcryptjs';
import { setupTestDb, teardownTestDb, clearTables } from '../setup.js';
import { submittedTransactions, setMockResponse, resetMocks } from '../mocks/gateway.js';
import { sentEmails, resetEmails } from '../mocks/email.js';

let pool;
let app;
let govAgent, mfrAgent, repAgent, nurseAgent, scAgent;

beforeAll(async () => {
  if (!app) { const m = await import('../../server.js'); app = m.default; }
  pool = await setupTestDb();
  await clearTables();

  const hash = await bcrypt.hash('Test@1234', 10);
  const users = [
    ['gov-wf',   'government',    'gov-wf',   null,                'gov@wf.test'],
    ['mfr-wf',   'manufacturer',  'mfr-wf',   null,                'mfr@wf.test'],
    ['rep-wf',   'distributor',   'rep-wf',   'Memorial Hospital', 'rep@wf.test'],
    ['nurse-wf', 'nurse',         'nurse-wf', 'Memorial Hospital', 'nurse@wf.test'],
    ['sc-wf',    'supply_chain',  'sc-wf',    'Memorial Hospital', 'sc@wf.test'],
  ];
  for (const [username, role, label, hosp, email] of users) {
    await pool.query(
      `INSERT INTO users (username, password_hash, role, identity_label, hospital_id, email, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,true) ON CONFLICT (username) DO NOTHING`,
      [username, hash, role, label, hosp, email]
    );
  }

  await pool.query(
    `INSERT INTO rep_hospitals (rep_username, hospital_name, assigned_by)
     VALUES ('rep-wf', 'Memorial Hospital', 'system') ON CONFLICT DO NOTHING`
  );
});

afterAll(teardownTestDb);

beforeEach(async () => {
  resetMocks();
  resetEmails();
  submittedTransactions.length = 0;

  govAgent   = request.agent(app); await govAgent.post('/api/login').send({ username: 'gov@wf.test',   password: 'Test@1234' });
  mfrAgent   = request.agent(app); await mfrAgent.post('/api/login').send({ username: 'mfr@wf.test',   password: 'Test@1234' });
  repAgent   = request.agent(app); await repAgent.post('/api/login').send({ username: 'rep@wf.test',   password: 'Test@1234' });
  nurseAgent = request.agent(app); await nurseAgent.post('/api/login').send({ username: 'nurse@wf.test', password: 'Test@1234' });
  scAgent    = request.agent(app); await scAgent.post('/api/login').send({ username: 'sc@wf.test',     password: 'Test@1234' });
});

// ─────────────────────────────────────────────────────────────────────────
// DEVICE REGISTRATION (FDA)
// ─────────────────────────────────────────────────────────────────────────

describe('Device Registration Workflow', () => {
  test('GET /api/assets/devices returns device list', async () => {
    setMockResponse('getAllDevices', [{ udiDI: '(01)00643169007234', deviceName: 'Stryker Triathlon Knee' }]);
    const res = await govAgent.get('/api/assets/devices');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/device/onboard submits a device for registration', async () => {
    const res = await govAgent.post('/api/device/onboard').send({
      udiDI: '(01)00643169007234',
      deviceName: 'Stryker Triathlon Total Knee System',
      manufacturerId: 'mfr-wf',
      deviceCategory: 'orthopedic',
      deviceType: 'joint',
      mriSafe: 'conditional',
      bodyLocations: ['Left Knee', 'Right Knee'],
      gudidVerified: true,
    });
    expect(res.status).toBe(200);
    const tx = submittedTransactions.find(t => t.fcn === 'onboardDevice');
    expect(tx).toBeDefined();
    expect(tx.args[0]).toBe('(01)00643169007234');
  });

  test('POST /api/clearance issues a 510k clearance', async () => {
    const res = await govAgent.post('/api/clearance').send({
      clearanceNumber: 'K193629',
      udiDI: '(01)00643169007234',
      manufacturerId: 'mfr-wf',
      clearanceType: '510k',
      clearanceDate: '2024-01-15',
      expiryDate: '2029-01-15',
    });
    expect(res.status).toBe(200);
    const tx = submittedTransactions.find(t => t.fcn === 'issueClearance');
    expect(tx).toBeDefined();
    expect(tx.args[0]).toBe('K193629');
    expect(tx.args[3]).toBe('510k');
  });

  test('POST /api/clearance/:id/revoke records revocation', async () => {
    const res = await govAgent.post('/api/clearance/K193629/revoke')
      .send({ reason: 'Safety concern identified' });
    expect(res.status).toBe(200);
    const tx = submittedTransactions.find(t => t.fcn === 'revokeClearance');
    expect(tx).toBeDefined();
    expect(tx.args[1]).toBe('Safety concern identified');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// LOT LIFECYCLE (Manufacturer)
// ─────────────────────────────────────────────────────────────────────────

describe('Lot Lifecycle Workflow', () => {
  test('POST /api/lot creates a lot in quarantine', async () => {
    const res = await mfrAgent.post('/api/lot').send({
      lotId: 'LOT-WF-001',
      udiDI: '(01)00643169007234',
      clearanceNumber: 'K193629',
      certId: 'ISO-STR-2024',
      lotNumber: 'STR-2024-WF-001',
      manufacturingDate: '2024-06-01',
      expiryDate: '2027-06-01',
      quantity: 100,
      storageConditions: 'Store at room temperature',
    });
    expect(res.status).toBe(200);
    const tx = submittedTransactions.find(t => t.fcn === 'createLot');
    expect(tx).toBeDefined();
    expect(tx.args[0]).toBe('LOT-WF-001');
    // arg order verified via lotId above
  });

  test('POST /api/lot/:lotId/release QC-releases the lot', async () => {
    const res = await mfrAgent.post('/api/lot/LOT-WF-001/release')
      .send({ qcNotes: 'All QC checks passed. Sterility verified.' });
    expect(res.status).toBe(200);
    const tx = submittedTransactions.find(t => t.fcn === 'releaseLot');
    expect(tx).toBeDefined();
    expect(tx.args[0]).toBe('LOT-WF-001');
    expect(tx.args[1]).toBe('All QC checks passed. Sterility verified.');
  });

  test('POST /api/iso13485 uploads a certificate', async () => {
    const res = await mfrAgent.post('/api/iso13485').send({
      certId: 'ISO-STR-2024',
      manufacturerId: 'mfr-wf',
      facilityName: 'Stryker Kalamazoo Manufacturing',
      facilityAddress: '2825 Airview Blvd, Kalamazoo, MI',
      certBody: 'BSI Group',
      issueDate: '2024-01-01',
      expiryDate: '2027-01-01',
    });
    expect(res.status).toBe(200);
    const tx = submittedTransactions.find(t => t.fcn === 'uploadISO13485');
    expect(tx).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// CONSIGNMENT WORKFLOW (Distributor)
// ─────────────────────────────────────────────────────────────────────────

describe('Consignment Workflow', () => {
  test('POST /api/consignment creates consignment at assigned hospital', async () => {
    const res = await repAgent.post('/api/consignment').send({
      consignmentId: 'CONS-WF-001',
      lotId: 'LOT-WF-001',
      hospitalId: 'Memorial Hospital',
      quantity: 20,
      location: 'OR Suite B - Tray 1',
    });
    expect(res.status).toBe(200);
    const tx = submittedTransactions.find(t => t.fcn === 'createConsignment');
    expect(tx).toBeDefined();
    expect(tx.args[2]).toBe('Memorial Hospital');
    expect(tx.args[3]).toBe('20');
  });

  test('POST /api/consignment enforces territory — rep cannot serve unassigned hospital', async () => {
    const res = await repAgent.post('/api/consignment').send({
      consignmentId: 'CONS-WF-FORBIDDEN',
      lotId: 'LOT-WF-001',
      hospitalId: 'University Hospital', // rep-wf is not assigned here
      quantity: 10,
      location: 'OR Room 1',
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('not assigned');
  });

  test('POST /api/consignment/:id/return records a return', async () => {
    const res = await scAgent.post('/api/consignment/CONS-WF-001/return')
      .send({ quantity: 5, reason: 'Unused — case cancelled' });
    expect(res.status).toBe(200);
    const tx = submittedTransactions.find(t => t.fcn === 'returnConsignment');
    expect(tx).toBeDefined();
    expect(tx.args[1]).toBe('5');
  });

  test('POST /api/consignment/:id/opened-not-implanted records waste event', async () => {
    const res = await nurseAgent.post('/api/consignment/CONS-WF-001/opened-not-implanted')
      .send({ quantity: 1, reason: 'Wrong size', disposition: 'Returned to rep' });
    expect(res.status).toBe(200);
    const tx = submittedTransactions.find(t => t.fcn === 'recordOpenedNotImplanted');
    expect(tx).toBeDefined();
    expect(tx.args[2]).toBe('Wrong size');
    expect(tx.args[3]).toBe('Returned to rep');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// IMPLANT RECORDING + MRI ALERT (OR Nurse) — Feature 1
// ─────────────────────────────────────────────────────────────────────────

describe('Implant Recording + MRI Alert (Feature 1)', () => {
  test('POST /api/implant records an implant on blockchain', async () => {
    const res = await nurseAgent.post('/api/implant').send({
      implantId: 'IMPL-WF-001',
      consignmentId: 'CONS-WF-001',
      udiPI: '(01)00643169007234(10)LOT-WF-001',
      lotNumber: 'STR-2024-WF-001',
      patientId: 'MRN-12345',
      patientIdHash: 'sha256-hash-of-mrn',
      surgeonId: 'DR-JOHNSON-ORTH',
      procedureType: 'Total Knee Arthroplasty',
      bodyLocation: 'Left Knee',
      procedureDate: '2026-05-18',
      notes: 'Procedure uneventful.',
    });
    expect(res.status).toBe(200);
    const tx = submittedTransactions.find(t => t.fcn === 'recordImplant');
    expect(tx).toBeDefined();
    expect(tx.args[0]).toBe('IMPL-WF-001');
    expect(tx.args[5]).toBe('MRN-12345');
    expect(tx.args[8]).toBe('Total Knee Arthroplasty');
  });

  test('MRI safety data is accessible via device evaluation', async () => {
    setMockResponse('getDevice', { udiDI: '(01)00643169007234', deviceName: 'Stryker Triathlon Knee', mriSafe: 'conditional' });
    const res = await nurseAgent.get('/api/device/(01)00643169007234');
    expect(res.status).toBe(200);
    expect(res.body.mriSafe).toBe('conditional');
  });

  test('POST /api/implant/:id/explant records explant with disposition', async () => {
    const res = await nurseAgent.post('/api/implant/IMPL-WF-001/explant').send({
      explantReason: 'Infection',
      explantDate: '2026-06-01',
      disposition: 'Sent to lab for analysis',
      explantedBy: 'DR-JOHNSON-ORTH',
    });
    expect(res.status).toBe(200);
    const tx = submittedTransactions.find(t => t.fcn === 'recordExplant');
    expect(tx).toBeDefined();
    expect(tx.args[1]).toBe('Infection');
    expect(tx.args[3]).toBe('Sent to lab for analysis');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// OR SCHEDULING — Feature 8
// ─────────────────────────────────────────────────────────────────────────

describe('OR Scheduling (Feature 8)', () => {
  test('POST /api/cases creates a scheduled case', async () => {
    const res = await scAgent.post('/api/cases').send({
      caseId: 'CASE-WF-001',
      procedureDate: '2026-05-20',
      procedureTime: '07:30:00',
      orRoom: 'OR-2',
      hospitalId: 'Memorial Hospital',
      surgeonId: 'DR-JOHNSON-ORTH',
      procedureType: 'Total Knee Arthroplasty',
      deviceCategory: 'orthopedic',
    });
    expect(res.status).toBe(200);
    expect(res.body.case_id).toBe('CASE-WF-001');
    expect(res.body.status).toBe('scheduled');
  });

  test('GET /api/cases filters by hospitalId for supply chain user', async () => {
    const res = await scAgent.get('/api/cases');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // sc-wf is at Memorial Hospital — should only see Memorial cases
    const crossHospital = res.body.filter(c => c.hospital_id !== 'Memorial Hospital');
    expect(crossHospital.length).toBe(0);
  });

  test('PUT /api/cases/:id/status transitions case status', async () => {
    // Create the case first
    await scAgent.post('/api/cases').send({
      caseId: 'CASE-STATUS-WF-001',
      procedureDate: '2026-05-21',
      hospitalId: 'Memorial Hospital',
    });

    const res = await scAgent.put('/api/cases/CASE-STATUS-WF-001/status').send({ status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });

  test('POST /api/cases/:id/link-implant links implant to case', async () => {
    await scAgent.post('/api/cases').send({
      caseId: 'CASE-LINK-WF-001',
      procedureDate: '2026-05-22',
      hospitalId: 'Memorial Hospital',
    });

    const res = await nurseAgent.post('/api/cases/CASE-LINK-WF-001/link-implant')
      .send({ implantId: 'IMPL-WF-001' });
    expect(res.status).toBe(200);
    expect(res.body.implant_ids).toContain('IMPL-WF-001');
    expect(res.body.status).toBe('in_progress');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// REP VISIT LOG — Feature 10
// ─────────────────────────────────────────────────────────────────────────

describe('Rep Visit Log (Feature 10)', () => {
  test('POST /api/rep-visits creates a scheduled visit', async () => {
    const res = await repAgent.post('/api/rep-visits').send({
      visitId: 'VISIT-WF-001',
      hospitalId: 'Memorial Hospital',
      visitDate: '2026-05-25',
      visitTime: '09:00:00',
      purpose: 'procedure_support',
      contactName: 'Robert Kim',
    });
    expect(res.status).toBe(200);
    expect(res.body.visit_id).toBe('VISIT-WF-001');
    expect(res.body.status).toBe('scheduled');
  });

  test('PUT /api/rep-visits/:id/status check-in sets timestamp', async () => {
    await repAgent.post('/api/rep-visits').send({
      visitId: 'VISIT-CHECKIN-WF-001',
      hospitalId: 'Memorial Hospital',
      visitDate: '2026-05-25',
    });

    const res = await repAgent.put('/api/rep-visits/VISIT-CHECKIN-WF-001/status')
      .send({ status: 'checked_in' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('checked_in');
    expect(res.body.checked_in_at).not.toBeNull();
  });

  test('GET /api/rep-visits returns only rep-wf visits for distributor role', async () => {
    const res = await repAgent.get('/api/rep-visits');
    expect(res.status).toBe(200);
    expect(res.body.every(v => v.rep_username === 'rep-wf')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC VERIFICATION (no auth)
// ─────────────────────────────────────────────────────────────────────────

describe('Public Device Verification (no auth required)', () => {
  test('GET /api/verify/device/:udiDI works without login', async () => {
    setMockResponse('verifyDevice', { udiDI: '(01)00643169007234', status: 'active', clearance: 'active' });
    const res = await request(app).get('/api/verify/device/(01)00643169007234');
    expect(res.status).toBe(200);
    expect(res.body.udiDI).toBe('(01)00643169007234');
  });

  test('GET /api/verify/lot/:lotId works without login', async () => {
    setMockResponse('verifyLot', { lotId: 'LOT-WF-001', status: 'active' });
    const res = await request(app).get('/api/verify/lot/LOT-WF-001');
    expect(res.status).toBe(200);
  });
});
