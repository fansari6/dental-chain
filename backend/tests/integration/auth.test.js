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

// __tests__/integration/auth.test.js
// Integration tests for authentication routes
// Tests login, logout, session persistence, and role enforcement

import request from 'supertest';
import bcrypt from 'bcryptjs';
import { setupTestDb, teardownTestDb, clearTables } from '../setup.js';

let pool;
let app;

const TEST_USERS = [
  { username:'admin-int',   email:'admin@int.test',   role:'admin',               identity:'admin-int',   password:'Admin@1234' },
  { username:'gov-int',     email:'gov@int.test',     role:'government',           identity:'gov-int',     password:'Gov@1234'   },
  { username:'nurse-int',   email:'nurse@int.test',   role:'nurse',                identity:'nurse-int',   password:'Nurse@1234', hosp:'Memorial Hospital' },
  { username:'mfr-int',     email:'mfr@int.test',     role:'manufacturer',         identity:'mfr-int',     password:'Mfr@1234'   },
  { username:'ip-int',      email:'ip@int.test',      role:'infection_prevention', identity:'ip-int',      password:'IP@1234',   hosp:'Memorial Hospital' },
];

beforeAll(async () => {
  if (!app) { const m = await import('../../server.js'); app = m.default; }
  pool = await setupTestDb();
  await clearTables();
  // Seed test users with real bcrypt hashes
  for (const u of TEST_USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    await pool.query(
      `INSERT INTO users (username, full_name, password_hash, role, identity_label, hospital_id, email, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true) ON CONFLICT (username) DO NOTHING`,
      [u.username, u.username, hash, u.role, u.identity, u.hosp||null, u.email]
    );
  }
});

afterAll(teardownTestDb);

// ─────────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────────

describe('POST /api/login', () => {
  test('login with valid email and password returns 200 and user info', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'admin@int.test', password: 'Admin@1234' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('username', 'admin-int');
    expect(res.body).toHaveProperty('role', 'admin');
    expect(res.body).not.toHaveProperty('password_hash');
  });

  test('login sets a session cookie', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'admin@int.test', password: 'Admin@1234' });
    expect(res.headers['set-cookie']).toBeDefined();
  });

  test('login with wrong password returns 401', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'admin@int.test', password: 'WrongPassword' });
    expect(res.status).toBe(401);
  });

  test('login with unknown email returns 401', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'nobody@nowhere.com', password: 'Admin@1234' });
    expect(res.status).toBe(401);
  });

  test('login with inactive user returns 401 or 403', async () => {
    await pool.query(`UPDATE users SET is_active=false WHERE username='gov-int'`);
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'gov@int.test', password: 'Gov@1234' });
    expect([401, 403]).toContain(res.status);
    await pool.query(`UPDATE users SET is_active=true WHERE username='gov-int'`);
  });

  test('login without email field returns 400', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ password: 'Admin@1234' });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// SESSION / AUTH MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────

describe('Session and requireAuth', () => {
  test('unauthenticated request to protected route returns 401', async () => {
    const res = await request(app).get('/api/assets/stats');
    expect(res.status).toBe(401);
  });

  test('authenticated session allows access to protected route', async () => {
    const agent = request.agent(app);
    await agent.post('/api/login')
      .send({ username: 'admin@int.test', password: 'Admin@1234' });

    const res = await agent.get('/api/assets/stats');
    expect(res.status).toBe(200);
  });

  test('GET /api/me returns current user', async () => {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ username: 'nurse@int.test', password: 'Nurse@1234' });

    const res = await agent.get('/api/me');
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('nurse-int');
    expect(res.body.role).toBe('nurse');
  });

  test('POST /api/logout clears the session', async () => {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ username: 'admin@int.test', password: 'Admin@1234' });

    await agent.post('/api/logout');
    const res = await agent.get('/api/assets/stats');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// ROLE ENFORCEMENT
// ─────────────────────────────────────────────────────────────────────────

describe('requireRole enforcement', () => {
  const loginAs = async (email, password) => {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ username: email, password });
    return agent;
  };

  test('nurse cannot access government-only device registration', async () => {
    const agent = await loginAs('nurse@int.test', 'Nurse@1234');
    const res = await agent.post('/api/device').send({
      udiDI: '(01)TEST', deviceName: 'Test Device',
      manufacturerId: 'mfr-int', deviceCategory: 'orthopedic', deviceType: 'joint',
    });
    expect(res.status).toBe(403);
  });

  test('manufacturer cannot record implants (nurse-only)', async () => {
    const agent = await loginAs('mfr@int.test', 'Mfr@1234');
    const res = await agent.post('/api/implant').send({
      implantId: 'IMPL-TEST', consignmentId: 'CONS-TEST',
      patientId: 'PAT-TEST', procedureType: 'Total Knee Arthroplasty',
      bodyLocation: 'Left Knee', procedureDate: '2026-05-20',
    });
    expect(res.status).toBe(403);
  });

  test('government user can access regulatory portal routes', async () => {
    const agent = await loginAs('gov@int.test', 'Gov@1234');
    const res = await agent.get('/api/assets/clearances');
    expect(res.status).toBe(200);
  });

  test('nurse can read stats but not issue clearances', async () => {
    const agent = await loginAs('nurse@int.test', 'Nurse@1234');
    const statsRes = await agent.get('/api/assets/stats');
    expect(statsRes.status).toBe(200);

    const clearRes = await agent.post('/api/clearance').send({
      clearanceNumber: 'K999999', udiDI: '(01)TEST',
      manufacturerId: 'mfr-int', clearanceType: '510k', clearanceDate: '2026-01-01',
    });
    expect(clearRes.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────────────────────────────────

describe('Health check', () => {
  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
