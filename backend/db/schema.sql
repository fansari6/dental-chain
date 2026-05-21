-- ============================================================
-- DentalChain Database Schema
-- Dental Implant Traceability on Hyperledger Fabric 2.5
-- ============================================================

-- ── USERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  username       VARCHAR(100) UNIQUE NOT NULL,
  full_name      VARCHAR(255),
  password_hash  VARCHAR(255) NOT NULL,
  role           VARCHAR(50)  NOT NULL,
  -- Roles: admin | government | manufacturer | distributor
  --        dentist | dental_assistant | infection_control
  identity_label VARCHAR(150) NOT NULL,
  organization   VARCHAR(255),
  practice_id    VARCHAR(255),   -- dental practice (replaces hospital_id)
  dso_id         VARCHAR(255),   -- DSO group this practice belongs to
  email          VARCHAR(255),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     VARCHAR(100),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── DENTAL PRACTICES (replaces hospitals) ────────────────────
CREATE TABLE IF NOT EXISTS practices (
  id              SERIAL PRIMARY KEY,
  practice_id     VARCHAR(100) UNIQUE NOT NULL,
  name            VARCHAR(255) UNIQUE NOT NULL,
  address         VARCHAR(500),
  phone           VARCHAR(50),
  email           VARCHAR(255),
  dso_id          VARCHAR(100),     -- DSO group (e.g. Aspen, Heartland)
  npi             VARCHAR(20),      -- Practice NPI number
  license_number  VARCHAR(100),     -- State dental license
  chair_count     INTEGER,          -- Number of dental chairs
  implant_volume  INTEGER,          -- Avg implants per month
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      VARCHAR(100)
);

-- ── DSO GROUPS (Dental Service Organizations) ─────────────────
CREATE TABLE IF NOT EXISTS dso_groups (
  id              SERIAL PRIMARY KEY,
  dso_id          VARCHAR(100) UNIQUE NOT NULL,
  name            VARCHAR(255) UNIQUE NOT NULL,
  hq_address      VARCHAR(500),
  contact         VARCHAR(255),
  location_count  INTEGER DEFAULT 0,
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      VARCHAR(100)
);

-- ── DENTISTS (replaces surgeons) ─────────────────────────────
CREATE TABLE IF NOT EXISTS dentists (
  id              SERIAL PRIMARY KEY,
  dentist_id      VARCHAR(100) UNIQUE NOT NULL,
  full_name       VARCHAR(255) NOT NULL,
  license_number  VARCHAR(100),     -- State dental license
  npi             VARCHAR(20),      -- NPI number
  specialty       VARCHAR(100),     -- general | oral_surgeon | periodontist | prosthodontist
  practices       TEXT[] DEFAULT '{}',  -- array of practice_ids
  dea_number      VARCHAR(50),      -- DEA number if applicable
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      VARCHAR(100)
);

-- ── REP PRACTICE ASSIGNMENTS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS rep_practices (
  id              SERIAL PRIMARY KEY,
  rep_username    VARCHAR(100) NOT NULL,
  practice_name   VARCHAR(255) NOT NULL,
  assigned_by     VARCHAR(100),
  assigned_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rep_username, practice_name)
);

-- ── DENTAL TREATMENT CASES ───────────────────────────────────
-- Each case is one implant treatment (may span multiple appointments)
CREATE TABLE IF NOT EXISTS dental_cases (
  id              SERIAL PRIMARY KEY,
  case_id         VARCHAR(50) UNIQUE NOT NULL,
  practice_id     VARCHAR(255) NOT NULL,
  dentist_id      VARCHAR(100),
  patient_mrn     VARCHAR(100),     -- hashed before storage
  tooth_number    VARCHAR(10),      -- Universal: 1-32 or FDI: 11-48
  tooth_system    VARCHAR(20) DEFAULT 'universal', -- universal | fdi
  procedure_type  VARCHAR(100),     -- single_implant | all_on_4 | bone_graft | full_arch
  treatment_phase VARCHAR(50) DEFAULT 'planning',
  -- planning | extraction | bone_graft | implant_post
  -- healing | abutment | crown | complete | failed
  appointment_date DATE,
  notes           TEXT,
  status          VARCHAR(20) DEFAULT 'scheduled',
  implant_ids     TEXT[] DEFAULT '{}',
  lab_work_ids    TEXT[] DEFAULT '{}',
  created_by      VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── LAB WORK ORDERS ──────────────────────────────────────────
-- Tracks crown/abutment sent to dental lab and returned
CREATE TABLE IF NOT EXISTS lab_work (
  id              SERIAL PRIMARY KEY,
  lab_work_id     VARCHAR(50) UNIQUE NOT NULL,
  case_id         VARCHAR(50),
  implant_id      VARCHAR(100),
  practice_id     VARCHAR(255) NOT NULL,
  lab_name        VARCHAR(255),
  lab_id          VARCHAR(100),
  work_type       VARCHAR(50),      -- crown | abutment | bridge | veneer | full_arch
  shade           VARCHAR(20),      -- A1, A2, B1, etc.
  material        VARCHAR(50),      -- zirconia | porcelain | pfm | gold
  sent_date       DATE,
  due_date        DATE,
  received_date   DATE,
  status          VARCHAR(20) DEFAULT 'at_lab',
  -- at_lab | received | approved | rejected | remade
  notes           TEXT,
  created_by      VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── FOLLOW-UP SCHEDULE ───────────────────────────────────────
-- Osseointegration and post-treatment follow-ups
CREATE TABLE IF NOT EXISTS follow_ups (
  id              SERIAL PRIMARY KEY,
  follow_up_id    VARCHAR(50) UNIQUE NOT NULL,
  case_id         VARCHAR(50),
  implant_id      VARCHAR(100),
  practice_id     VARCHAR(255) NOT NULL,
  patient_mrn     VARCHAR(100),
  follow_up_type  VARCHAR(50),      -- 1_week | 1_month | 3_month | 6_month | annual
  scheduled_date  DATE,
  completed_date  DATE,
  outcome         VARCHAR(50),      -- healing | osseointegrated | failed | monitoring
  notes           TEXT,
  status          VARCHAR(20) DEFAULT 'scheduled',
  created_by      VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── REP VISITS (same as ImplantChain) ────────────────────────
CREATE TABLE IF NOT EXISTS rep_visits (
  id              SERIAL PRIMARY KEY,
  visit_id        VARCHAR(50) UNIQUE NOT NULL,
  rep_username    VARCHAR(100) NOT NULL,
  practice_id     VARCHAR(255) NOT NULL,
  visit_date      DATE NOT NULL,
  visit_time      TIME,
  purpose         VARCHAR(50),      -- procedure_support | inventory | training | new_product
  case_id         VARCHAR(50),
  contact_name    VARCHAR(255),
  notes           TEXT,
  status          VARCHAR(20) DEFAULT 'scheduled',
  checked_in_at   TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── AUDIT LOG (same as ImplantChain) ─────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id              SERIAL PRIMARY KEY,
  actor           VARCHAR(100) NOT NULL,
  action          VARCHAR(100) NOT NULL,
  target          VARCHAR(255),
  details         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── EMAIL LOG (same as ImplantChain) ─────────────────────────
CREATE TABLE IF NOT EXISTS email_log (
  id              SERIAL PRIMARY KEY,
  recipients      TEXT NOT NULL,
  subject         TEXT NOT NULL,
  type            VARCHAR(50),
  triggered_by    VARCHAR(100),
  details         JSONB DEFAULT '{}',
  sent_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ── SESSION ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session (
  sid     VARCHAR NOT NULL COLLATE "default",
  sess    JSON NOT NULL,
  expire  TIMESTAMPTZ NOT NULL,
  CONSTRAINT session_pkey PRIMARY KEY (sid)
);

-- ── LOOKUP VALUES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lookup_values (
  id          SERIAL PRIMARY KEY,
  category    VARCHAR(100) NOT NULL,
  value       VARCHAR(255) NOT NULL,
  sort_order  INTEGER DEFAULT 0,
  active      BOOLEAN DEFAULT TRUE,
  UNIQUE(category, value)
);

-- ── INDEXES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_role         ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_practice     ON users(practice_id);
CREATE INDEX IF NOT EXISTS idx_users_dso          ON users(dso_id);
CREATE INDEX IF NOT EXISTS idx_cases_practice     ON dental_cases(practice_id);
CREATE INDEX IF NOT EXISTS idx_cases_dentist      ON dental_cases(dentist_id);
CREATE INDEX IF NOT EXISTS idx_cases_status       ON dental_cases(status);
CREATE INDEX IF NOT EXISTS idx_lab_work_case      ON lab_work(case_id);
CREATE INDEX IF NOT EXISTS idx_lab_work_status    ON lab_work(status);
CREATE INDEX IF NOT EXISTS idx_follow_ups_case    ON follow_ups(case_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_date    ON follow_ups(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_rep_visits_rep     ON rep_visits(rep_username);
CREATE INDEX IF NOT EXISTS idx_audit_actor        ON audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_action       ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created      ON audit_log(created_at DESC);

-- ── SEED DEFAULT LOOKUP VALUES ────────────────────────────────
INSERT INTO lookup_values (category, value, sort_order) VALUES
  ('tooth_system',    'universal',          1),
  ('tooth_system',    'fdi',                2),
  ('procedure_type',  'single_implant',     1),
  ('procedure_type',  'multiple_implants',  2),
  ('procedure_type',  'all_on_4',           3),
  ('procedure_type',  'all_on_6',           4),
  ('procedure_type',  'full_arch',          5),
  ('procedure_type',  'bone_graft',         6),
  ('procedure_type',  'sinus_lift',         7),
  ('procedure_type',  'socket_preservation',8),
  ('treatment_phase', 'planning',           1),
  ('treatment_phase', 'extraction',         2),
  ('treatment_phase', 'bone_graft',         3),
  ('treatment_phase', 'implant_post',       4),
  ('treatment_phase', 'healing',            5),
  ('treatment_phase', 'abutment',           6),
  ('treatment_phase', 'crown',              7),
  ('treatment_phase', 'complete',           8),
  ('treatment_phase', 'failed',             9),
  ('implant_material','titanium',           1),
  ('implant_material','zirconia',           2),
  ('implant_material','titanium_zirconia',  3),
  ('crown_material',  'zirconia',           1),
  ('crown_material',  'porcelain',          2),
  ('crown_material',  'pfm',               3),
  ('crown_material',  'gold',              4),
  ('implant_diameter','3.0mm',             1),
  ('implant_diameter','3.5mm',             2),
  ('implant_diameter','4.0mm',             3),
  ('implant_diameter','4.5mm',             4),
  ('implant_diameter','5.0mm',             5),
  ('implant_length',  '6mm',              1),
  ('implant_length',  '8mm',              2),
  ('implant_length',  '10mm',             3),
  ('implant_length',  '12mm',             4),
  ('implant_length',  '14mm',             5),
  ('implant_length',  '16mm',             6),
  ('specialty',       'general',           1),
  ('specialty',       'oral_surgeon',      2),
  ('specialty',       'periodontist',      3),
  ('specialty',       'prosthodontist',    4),
  ('specialty',       'implantologist',    5)
ON CONFLICT DO NOTHING;
