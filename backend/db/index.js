// DentalChain — Database Query Functions
// Mirrors ImplantChain db/index.js with dental-specific adaptations
import pg             from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

// ── Connection Pool ───────────────────────────────────────────
function parseEnvFile(filePath) {
  const env = {};
  try {
    const content = readFileSync(resolve(__dirname, '..', filePath), 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^([^#=\s][^=]*)=(.*)/);
      if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  } catch {}
  return env;
}

const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
const env     = parseEnvFile(envFile);

export const pool = new Pool({
  host:     env.DB_HOST     || process.env.DB_HOST     || 'localhost',
  port:     parseInt(env.DB_PORT || process.env.DB_PORT || '5433'),
  database: env.DB_NAME     || process.env.DB_NAME     || 'dental_chain',
  user:     env.DB_USER     || process.env.DB_USER     || 'postgres',
  password: env.DB_PASSWORD || process.env.DB_PASSWORD || '',
  max: 10,
  idleTimeoutMillis: 30000,
});

// ── Init DB ───────────────────────────────────────────────────
export async function initDb() {
  const schema = readFileSync(resolve(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('✅ DentalChain database schema initialized');
}

// ── Users ─────────────────────────────────────────────────────
export async function findUserByEmail(email) {
  const { rows } = await pool.query(
    `SELECT * FROM users WHERE (email = $1 OR username = $1) AND is_active = true LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

export async function findUserByUsername(username) {
  const { rows } = await pool.query(
    `SELECT * FROM users WHERE username = $1 LIMIT 1`, [username]
  );
  return rows[0] || null;
}

export async function getAllUsers() {
  const { rows } = await pool.query(
    `SELECT id, username, full_name, role, identity_label, organization,
            practice_id, dso_id, email, is_active, created_at
     FROM users ORDER BY role, username`
  );
  return rows;
}

export async function getUsersByRole(role) {
  const { rows } = await pool.query(
    `SELECT * FROM users WHERE role = $1 AND is_active = true ORDER BY username`,
    [role]
  );
  return rows;
}

export async function createUser({
  username, passwordHash, role, identityLabel,
  organization='', practiceId='', dsoId='', email='', fullName='', createdBy=''
}) {
  const { rows } = await pool.query(
    `INSERT INTO users
       (username, password_hash, role, identity_label, organization,
        practice_id, dso_id, email, full_name, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [username, passwordHash, role, identityLabel,
     organization, practiceId, dsoId, email, fullName, createdBy]
  );
  return rows[0];
}

export async function setUserActive(username, isActive) {
  const { rows } = await pool.query(
    `UPDATE users SET is_active=$2, updated_at=NOW() WHERE username=$1 RETURNING *`,
    [username, isActive]
  );
  return rows[0];
}

export async function updateUserFullName(username, fullName) {
  const { rows } = await pool.query(
    `UPDATE users SET full_name=$2, updated_at=NOW() WHERE username=$1 RETURNING *`,
    [username, fullName]
  );
  return rows[0];
}

export async function setUserEmail(username, email) {
  const { rows } = await pool.query(
    `UPDATE users SET email=$2, updated_at=NOW() WHERE username=$1 RETURNING *`,
    [username, email]
  );
  return rows[0];
}

// ── Practices (replaces Hospitals) ───────────────────────────
export async function getPractices() {
  const { rows } = await pool.query(
    `SELECT * FROM practices WHERE active = true ORDER BY name`
  );
  return rows;
}

export async function getPracticeByName(name) {
  const { rows } = await pool.query(
    `SELECT * FROM practices WHERE name = $1 LIMIT 1`, [name]
  );
  return rows[0] || null;
}

export async function getPracticeById(practiceId) {
  const { rows } = await pool.query(
    `SELECT * FROM practices WHERE practice_id = $1 LIMIT 1`, [practiceId]
  );
  return rows[0] || null;
}

export async function createPractice({
  practiceId, name, address='', phone='', email='',
  dsoId='', npi='', licenseNumber='', chairCount=0,
  implantVolume=0, createdBy=''
}) {
  const { rows } = await pool.query(
    `INSERT INTO practices
       (practice_id, name, address, phone, email,
        dso_id, npi, license_number, chair_count, implant_volume, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [practiceId, name, address, phone, email,
     dsoId, npi, licenseNumber, chairCount, implantVolume, createdBy]
  );
  return rows[0];
}

export async function updatePractice(id, {
  name, address, phone, email, npi, licenseNumber, chairCount, implantVolume
}) {
  const { rows } = await pool.query(
    `UPDATE practices SET
       name=$2, address=$3, phone=$4, email=$5,
       npi=$6, license_number=$7, chair_count=$8, implant_volume=$9
     WHERE id=$1 RETURNING *`,
    [id, name, address, phone, email, npi, licenseNumber, chairCount, implantVolume]
  );
  return rows[0];
}

export async function deletePractice(id) {
  await pool.query(`UPDATE practices SET active=false WHERE id=$1`, [id]);
}

// ── DSO Groups ────────────────────────────────────────────────
export async function getDsoGroups() {
  const { rows } = await pool.query(
    `SELECT * FROM dso_groups WHERE active = true ORDER BY name`
  );
  return rows;
}

export async function createDsoGroup({
  dsoId, name, hqAddress='', contact='', createdBy=''
}) {
  const { rows } = await pool.query(
    `INSERT INTO dso_groups (dso_id, name, hq_address, contact, created_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [dsoId, name, hqAddress, contact, createdBy]
  );
  return rows[0];
}

// ── Dentists (replaces Surgeons) ──────────────────────────────
export async function getDentists(practiceId='', specialty='') {
  let q = `SELECT * FROM dentists WHERE active = true`;
  const params = [];
  if (practiceId) { params.push(practiceId); q += ` AND $${params.length} = ANY(practices)`; }
  if (specialty)  { params.push(specialty);  q += ` AND specialty = $${params.length}`; }
  q += ` ORDER BY full_name`;
  const { rows } = await pool.query(q, params);
  return rows;
}

export async function createDentist({
  dentistId, fullName, licenseNumber='', npi='',
  specialty='general', practices=[], deaNumber='', createdBy=''
}) {
  const { rows } = await pool.query(
    `INSERT INTO dentists
       (dentist_id, full_name, license_number, npi, specialty, practices, dea_number, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [dentistId, fullName, licenseNumber, npi, specialty, practices, deaNumber, createdBy]
  );
  return rows[0];
}

export async function updateDentist(id, {
  fullName, licenseNumber, specialty, practices, npi
}) {
  const { rows } = await pool.query(
    `UPDATE dentists SET
       full_name=$2, license_number=$3, specialty=$4, practices=$5, npi=$6
     WHERE id=$1 RETURNING *`,
    [id, fullName, licenseNumber, specialty, practices, npi]
  );
  return rows[0];
}

export async function setDentistActive(id, isActive) {
  await pool.query(`UPDATE dentists SET active=$2 WHERE id=$1`, [id, isActive]);
}

// ── Rep Practice Assignments ──────────────────────────────────
export async function getRepPractices(repUsername) {
  const { rows } = await pool.query(
    `SELECT practice_name FROM rep_practices WHERE rep_username=$1 ORDER BY practice_name`,
    [repUsername]
  );
  return rows.map(r => r.practice_name);
}

export async function setRepPractices(repUsername, practiceNames, assignedBy='') {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM rep_practices WHERE rep_username=$1`, [repUsername]);
    for (const name of practiceNames) {
      await client.query(
        `INSERT INTO rep_practices (rep_username, practice_name, assigned_by)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [repUsername, name, assignedBy]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ── Dental Cases ──────────────────────────────────────────────
export async function getDentalCases({
  practiceId='', dentistId='', status='', date=''
}={}) {
  let q = `SELECT * FROM dental_cases WHERE 1=1`;
  const params = [];
  if (practiceId) { params.push(practiceId); q += ` AND practice_id=$${params.length}`; }
  if (dentistId)  { params.push(dentistId);  q += ` AND dentist_id=$${params.length}`; }
  if (status)     { params.push(status);     q += ` AND status=$${params.length}`; }
  if (date)       { params.push(date);       q += ` AND appointment_date=$${params.length}`; }
  q += ` ORDER BY appointment_date DESC, created_at DESC`;
  const { rows } = await pool.query(q, params);
  return rows;
}

export async function getDentalCaseById(caseId) {
  const { rows } = await pool.query(
    `SELECT * FROM dental_cases WHERE case_id=$1 LIMIT 1`, [caseId]
  );
  return rows[0] || null;
}

export async function createDentalCase({
  caseId, practiceId, dentistId='', patientMrn='',
  toothNumber='', toothSystem='universal', procedureType='',
  treatmentPhase='planning', appointmentDate=null, notes='', createdBy=''
}) {
  const { rows } = await pool.query(
    `INSERT INTO dental_cases
       (case_id, practice_id, dentist_id, patient_mrn, tooth_number, tooth_system,
        procedure_type, treatment_phase, appointment_date, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [caseId, practiceId, dentistId, patientMrn, toothNumber, toothSystem,
     procedureType, treatmentPhase, appointmentDate, notes, createdBy]
  );
  return rows[0];
}

export async function updateCasePhase(caseId, treatmentPhase) {
  const { rows } = await pool.query(
    `UPDATE dental_cases SET treatment_phase=$2, updated_at=NOW()
     WHERE case_id=$1 RETURNING *`,
    [caseId, treatmentPhase]
  );
  return rows[0];
}

export async function updateCaseStatus(caseId, status) {
  const { rows } = await pool.query(
    `UPDATE dental_cases SET status=$2, updated_at=NOW()
     WHERE case_id=$1 RETURNING *`,
    [caseId, status]
  );
  return rows[0];
}

export async function linkImplantToCase(caseId, implantId) {
  const { rows } = await pool.query(
    `UPDATE dental_cases
     SET implant_ids = array_append(implant_ids, $2),
         treatment_phase = CASE WHEN treatment_phase='planning' THEN 'implant_post'
                               ELSE treatment_phase END,
         updated_at = NOW()
     WHERE case_id=$1 RETURNING *`,
    [caseId, implantId]
  );
  return rows[0];
}

// ── Lab Work ──────────────────────────────────────────────────
export async function getLabWork({ practiceId='', caseId='', status='' }={}) {
  let q = `SELECT * FROM lab_work WHERE 1=1`;
  const params = [];
  if (practiceId) { params.push(practiceId); q += ` AND practice_id=$${params.length}`; }
  if (caseId)     { params.push(caseId);     q += ` AND case_id=$${params.length}`; }
  if (status)     { params.push(status);     q += ` AND status=$${params.length}`; }
  q += ` ORDER BY sent_date DESC`;
  const { rows } = await pool.query(q, params);
  return rows;
}

export async function createLabWork({
  labWorkId, caseId='', implantId='', practiceId, labName='',
  labId='', workType='', shade='', material='', sentDate=null,
  dueDate=null, notes='', createdBy=''
}) {
  const { rows } = await pool.query(
    `INSERT INTO lab_work
       (lab_work_id, case_id, implant_id, practice_id, lab_name, lab_id,
        work_type, shade, material, sent_date, due_date, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [labWorkId, caseId, implantId, practiceId, labName, labId,
     workType, shade, material, sentDate, dueDate, notes, createdBy]
  );
  return rows[0];
}

export async function updateLabWorkStatus(labWorkId, status, receivedDate=null) {
  const { rows } = await pool.query(
    `UPDATE lab_work SET status=$2, received_date=$3, updated_at=NOW()
     WHERE lab_work_id=$1 RETURNING *`,
    [labWorkId, status, receivedDate]
  );
  return rows[0];
}

// ── Follow-ups ────────────────────────────────────────────────
export async function getFollowUps({ practiceId='', caseId='', status='' }={}) {
  let q = `SELECT * FROM follow_ups WHERE 1=1`;
  const params = [];
  if (practiceId) { params.push(practiceId); q += ` AND practice_id=$${params.length}`; }
  if (caseId)     { params.push(caseId);     q += ` AND case_id=$${params.length}`; }
  if (status)     { params.push(status);     q += ` AND status=$${params.length}`; }
  q += ` ORDER BY scheduled_date ASC`;
  const { rows } = await pool.query(q, params);
  return rows;
}

export async function createFollowUp({
  followUpId, caseId='', implantId='', practiceId,
  patientMrn='', followUpType='', scheduledDate=null, notes='', createdBy=''
}) {
  const { rows } = await pool.query(
    `INSERT INTO follow_ups
       (follow_up_id, case_id, implant_id, practice_id, patient_mrn,
        follow_up_type, scheduled_date, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [followUpId, caseId, implantId, practiceId, patientMrn,
     followUpType, scheduledDate, notes, createdBy]
  );
  return rows[0];
}

export async function updateFollowUpStatus(followUpId, status, outcome='', completedDate=null) {
  const { rows } = await pool.query(
    `UPDATE follow_ups SET status=$2, outcome=$3, completed_date=$4
     WHERE follow_up_id=$1 RETURNING *`,
    [followUpId, status, outcome, completedDate]
  );
  return rows[0];
}

// ── Rep Visits ────────────────────────────────────────────────
export async function getRepVisits({ repUsername='', practiceId='', status='' }={}) {
  let q = `SELECT * FROM rep_visits WHERE 1=1`;
  const params = [];
  if (repUsername) { params.push(repUsername); q += ` AND rep_username=$${params.length}`; }
  if (practiceId)  { params.push(practiceId);  q += ` AND practice_id=$${params.length}`; }
  if (status)      { params.push(status);       q += ` AND status=$${params.length}`; }
  q += ` ORDER BY visit_date DESC, created_at DESC`;
  const { rows } = await pool.query(q, params);
  return rows;
}

export async function createRepVisit({
  visitId, repUsername, practiceId, visitDate, visitTime='',
  purpose='', caseId='', contactName='', notes='', createdBy=''
}) {
  const { rows } = await pool.query(
    `INSERT INTO rep_visits
       (visit_id, rep_username, practice_id, visit_date, visit_time,
        purpose, case_id, contact_name, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [visitId, repUsername, practiceId, visitDate, visitTime || null,
     purpose, caseId, contactName, notes, createdBy]
  );
  return rows[0];
}

export async function updateRepVisitStatus(visitId, status) {
  const now = new Date();
  const { rows } = await pool.query(
    `UPDATE rep_visits SET
       status=$2,
       checked_in_at  = CASE WHEN $2='checked_in'  THEN $3 ELSE checked_in_at  END,
       completed_at   = CASE WHEN $2='completed'    THEN $3 ELSE completed_at   END,
       updated_at=$3
     WHERE visit_id=$1 RETURNING *`,
    [visitId, status, now]
  );
  return rows[0];
}

// ── Audit Log ─────────────────────────────────────────────────
export async function addAuditLog({ actor, action, target='', details=null }) {
  await pool.query(
    `INSERT INTO audit_log (actor, action, target, details)
     VALUES ($1,$2,$3,$4)`,
    [actor, action, target, details ? JSON.stringify(details) : null]
  );
}

export async function getAuditLog({
  limit=200, actor='', action='', search='', from='', to=''
}={}) {
  let q = `SELECT * FROM audit_log WHERE 1=1`;
  const params = [];
  if (actor)  { params.push(`%${actor}%`);  q += ` AND actor ILIKE $${params.length}`; }
  if (action) { params.push(`%${action}%`); q += ` AND action ILIKE $${params.length}`; }
  if (search) { params.push(`%${search}%`); q += ` AND (actor ILIKE $${params.length} OR target ILIKE $${params.length})`; }
  if (from)   { params.push(from);          q += ` AND created_at >= $${params.length}`; }
  if (to)     { params.push(to);            q += ` AND created_at <= $${params.length}`; }
  params.push(limit);
  q += ` ORDER BY created_at DESC LIMIT $${params.length}`;
  const { rows } = await pool.query(q, params);
  return rows;
}

export async function getAuditActions() {
  const { rows } = await pool.query(
    `SELECT DISTINCT action FROM audit_log ORDER BY action`
  );
  return rows.map(r => r.action);
}

// ── Email ─────────────────────────────────────────────────────
export async function getInfectionControlEmails(practiceId='') {
  const { rows } = await pool.query(
    `SELECT email FROM users
     WHERE role = 'infection_control'
       AND email IS NOT NULL AND email != ''
       AND is_active = true
       AND (practice_id = $1 OR practice_id IS NULL OR practice_id = '')`,
    [practiceId]
  );
  return rows.map(r => r.email);
}

export async function getUsersWithEmail(role, practiceId='') {
  let q = `SELECT email FROM users WHERE role=$1 AND email IS NOT NULL AND is_active=true`;
  const params = [role];
  if (practiceId) { params.push(practiceId); q += ` AND practice_id=$${params.length}`; }
  const { rows } = await pool.query(q, params);
  return rows.map(r => r.email);
}

export async function getEmailLog(limit=50) {
  const { rows } = await pool.query(
    `SELECT * FROM email_log ORDER BY sent_at DESC LIMIT $1`, [limit]
  );
  return rows;
}

// ── Lookup Values ─────────────────────────────────────────────
export async function getLookupValues(category) {
  const { rows } = await pool.query(
    `SELECT value, sort_order FROM lookup_values
     WHERE category=$1 AND active=true ORDER BY sort_order, value`,
    [category]
  );
  return rows.map(r => r.value);
}

export async function getAllLookupValues() {
  const { rows } = await pool.query(
    `SELECT * FROM lookup_values WHERE active=true ORDER BY category, sort_order, value`
  );
  return rows;
}
