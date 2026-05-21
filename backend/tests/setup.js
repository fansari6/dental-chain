// tests/setup.js
// Reads .env.test directly — bypasses @dotenvx/dotenvx process.env interception

import pg       from 'pg';
import bcrypt   from 'bcryptjs';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Read .env.test directly into local variables (never touches process.env) ──
function parseEnvFile(filePath) {
  const env = {};
  try {
    const lines = readFileSync(resolve(__dirname, '..', filePath), 'utf8').split('\n');
    for (const line of lines) {
      const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  } catch (e) {
    console.warn('[setup] Could not read .env.test:', e.message);
  }
  return env;
}

const env = parseEnvFile('.env.test');

const DB_HOST     = env.DB_HOST     || 'localhost';
const DB_PORT     = parseInt(env.DB_PORT     || '5433');
const DB_NAME     = (env.DB_NAME || 'implant_chain').replace(/implant_chain$/, 'implant_chain_test');
const DB_USER     = env.DB_USER     || 'postgres';
const DB_PASSWORD = env.DB_PASSWORD || '';

const { Pool } = pg;
let testPool;

export async function setupTestDb() {
  testPool = new Pool({
    host: DB_HOST, port: DB_PORT,
    database: DB_NAME, user: DB_USER, password: DB_PASSWORD,
    max: 5,
  });

  await testPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id             SERIAL PRIMARY KEY,
      username       VARCHAR(100) UNIQUE NOT NULL,
      full_name      VARCHAR(255),
      password_hash  VARCHAR(255) NOT NULL DEFAULT '$2b$12$test',
      role           VARCHAR(50)  NOT NULL,
      identity_label VARCHAR(150) NOT NULL,
      organization   VARCHAR(255),
      hospital_id    VARCHAR(255),
      email          VARCHAR(255),
      is_active      BOOLEAN NOT NULL DEFAULT TRUE,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by     VARCHAR(100),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY, actor VARCHAR(100) NOT NULL,
      action VARCHAR(100) NOT NULL, target VARCHAR(255),
      details JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS hospitals (
      id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL,
      address VARCHAR(500), contact VARCHAR(255),
      accreditation VARCHAR(100), bed_count INTEGER,
      active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW(),
      created_by VARCHAR(100)
    );
    CREATE TABLE IF NOT EXISTS organizations (
      id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL,
      type VARCHAR(50) NOT NULL, address VARCHAR(500),
      contact VARCHAR(255), phone VARCHAR(50), website VARCHAR(255),
      active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW(),
      created_by VARCHAR(100)
    );
    CREATE TABLE IF NOT EXISTS surgeons (
      id SERIAL PRIMARY KEY, surgeon_id VARCHAR(100) UNIQUE NOT NULL,
      full_name VARCHAR(255) NOT NULL, license_number VARCHAR(100),
      specialty VARCHAR(100), hospital_id VARCHAR(255),
      hospitals TEXT[] DEFAULT '{}', npi VARCHAR(20),
      active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW(),
      created_by VARCHAR(100)
    );
    CREATE TABLE IF NOT EXISTS rep_hospitals (
      id SERIAL PRIMARY KEY, rep_username VARCHAR(100) NOT NULL,
      hospital_name VARCHAR(255) NOT NULL, assigned_by VARCHAR(100),
      assigned_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(rep_username, hospital_name)
    );
    CREATE TABLE IF NOT EXISTS cases (
      id SERIAL PRIMARY KEY, case_id VARCHAR(50) UNIQUE NOT NULL,
      procedure_date DATE NOT NULL, procedure_time TIME, or_room VARCHAR(50),
      hospital_id VARCHAR(255) NOT NULL, surgeon_id VARCHAR(100),
      procedure_type VARCHAR(255), device_category VARCHAR(50),
      required_devices JSONB DEFAULT '[]', patient_mrn VARCHAR(100),
      notes TEXT, status VARCHAR(20) DEFAULT 'scheduled',
      implant_ids TEXT[] DEFAULT '{}', created_by VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS rep_visits (
      id SERIAL PRIMARY KEY, visit_id VARCHAR(50) UNIQUE NOT NULL,
      rep_username VARCHAR(100) NOT NULL, hospital_id VARCHAR(255) NOT NULL,
      visit_date DATE NOT NULL, visit_time TIME, purpose VARCHAR(50),
      case_id VARCHAR(50), contact_name VARCHAR(255), notes TEXT,
      status VARCHAR(20) DEFAULT 'scheduled', checked_in_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS email_log (
      id SERIAL PRIMARY KEY, recipients TEXT NOT NULL,
      subject TEXT NOT NULL, type VARCHAR(50), triggered_by VARCHAR(100),
      details JSONB DEFAULT '{}', sent_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS session (
      sid VARCHAR NOT NULL COLLATE "default", sess JSON NOT NULL,
      expire TIMESTAMPTZ NOT NULL, CONSTRAINT session_pkey PRIMARY KEY (sid)
    );
    CREATE TABLE IF NOT EXISTS lookup_values (
      id SERIAL PRIMARY KEY, category VARCHAR(100) NOT NULL,
      value VARCHAR(255) NOT NULL, sort_order INTEGER DEFAULT 0,
      active BOOLEAN DEFAULT true, UNIQUE(category, value)
    );
  `);

  return testPool;
}

export async function teardownTestDb() {
  if (testPool) {
    await testPool.query(`
      DROP TABLE IF EXISTS rep_visits, cases, rep_hospitals, surgeons,
        organizations, hospitals, email_log, audit_log, users,
        lookup_values, session CASCADE;
    `);
    await testPool.end();
    testPool = null;
  }
}

export async function clearTables() {
  if (testPool) {
    await testPool.query(`
      TRUNCATE TABLE rep_visits, cases, rep_hospitals, surgeons,
        organizations, hospitals, email_log, audit_log, users,
        lookup_values RESTART IDENTITY CASCADE;
    `);
  }
}

export { testPool };

export async function seedTestUsers(pool) {
  const users = [
    { username:'admin-test',   role:'admin',               label:'admin-test',   hosp:null,             email:'admin@test.com' },
    { username:'gov-test',     role:'government',           label:'gov-test',     hosp:null,             email:'gov@test.com'   },
    { username:'mfr-test',     role:'manufacturer',         label:'mfr-test',     hosp:null,             email:'mfr@test.com'   },
    { username:'rep-test',     role:'distributor',          label:'rep-test',     hosp:'Test Hospital',  email:'rep@test.com'   },
    { username:'sc-test',      role:'supply_chain',         label:'sc-test',      hosp:'Test Hospital',  email:'sc@test.com'    },
    { username:'nurse-test',   role:'nurse',                label:'nurse-test',   hosp:'Test Hospital',  email:'nurse@test.com' },
    { username:'ip-test',      role:'infection_prevention', label:'ip-test',      hosp:'Test Hospital',  email:'ip@test.com'    },
  ];
  for (const u of users) {
    await pool.query(
      `INSERT INTO users (username, password_hash, role, identity_label, hospital_id, email, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,true) ON CONFLICT (username) DO NOTHING`,
      [u.username, '$2b$12$hashedpassword', u.role, u.label, u.hosp, u.email]
    );
  }
}
