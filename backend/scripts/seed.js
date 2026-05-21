// DentalChain — Seed default users, practices, and DSO groups
import bcrypt from 'bcryptjs';
import { pool } from '../db/index.js';

const users = [
  // ── Platform ───────────────────────────────────────────────
  {
    username:     'admin',
    password:     'Admin@1234',
    role:         'admin',
    fullName:     'DentalChain Administrator',
    email:        'admin@dentalchain.com',
    practiceId:   '',
    dsoId:        '',
  },
  // ── Government / FDA ───────────────────────────────────────
  {
    username:     'fda.dental',
    password:     'FDA@1234',
    role:         'government',
    fullName:     'Dr. James Whitfield',
    email:        'j.whitfield@fda.hhs.gov',
    practiceId:   '',
    dsoId:        '',
  },
  // ── Manufacturers ──────────────────────────────────────────
  {
    username:     'nobelbiocare',
    password:     'Nobel@1234',
    role:         'manufacturer',
    fullName:     'Nobel Biocare USA',
    email:        'compliance@nobelbiocare.com',
    practiceId:   '',
    dsoId:        '',
  },
  {
    username:     'straumann',
    password:     'Straumann@1234',
    role:         'manufacturer',
    fullName:     'Straumann USA LLC',
    email:        'compliance@straumann.com',
    practiceId:   '',
    dsoId:        '',
  },
  {
    username:     'zimmerbiomet',
    password:     'Zimmer@1234',
    role:         'manufacturer',
    fullName:     'Zimmer Biomet Dental',
    email:        'compliance@zimmerbiomet.com',
    practiceId:   '',
    dsoId:        '',
  },
  {
    username:     'biohorizons',
    password:     'BioH@1234',
    role:         'manufacturer',
    fullName:     'BioHorizons Implant Systems',
    email:        'compliance@biohorizons.com',
    practiceId:   '',
    dsoId:        '',
  },
  // ── Distributors ───────────────────────────────────────────
  {
    username:     'henry.schein.rep',
    password:     'Schein@1234',
    role:         'distributor',
    fullName:     'Marcus Webb',
    email:        'm.webb@henryschein.com',
    practiceId:   '',
    dsoId:        '',
  },
  {
    username:     'patterson.rep',
    password:     'Patterson@1234',
    role:         'distributor',
    fullName:     'Sandra Kowalski',
    email:        's.kowalski@patterson.com',
    practiceId:   '',
    dsoId:        '',
  },
  // ── Dentists ───────────────────────────────────────────────
  {
    username:     'dr.sarah.johnson',
    password:     'DrJ@1234',
    role:         'dentist',
    fullName:     'Dr. Sarah Johnson',
    email:        's.johnson@smiledentalgroup.com',
    practiceId:   'PRACTICE-001',
    dsoId:        '',
  },
  {
    username:     'dr.michael.chen',
    password:     'DrC@1234',
    role:         'dentist',
    fullName:     'Dr. Michael Chen',
    email:        'm.chen@advancedimplantcenter.com',
    practiceId:   'PRACTICE-002',
    dsoId:        '',
  },
  // ── Dental Assistants ──────────────────────────────────────
  {
    username:     'maria.garcia',
    password:     'Maria@1234',
    role:         'dental_assistant',
    fullName:     'Maria Garcia RDA',
    email:        'm.garcia@smiledentalgroup.com',
    practiceId:   'PRACTICE-001',
    dsoId:        '',
  },
  {
    username:     'james.park',
    password:     'James@1234',
    role:         'dental_assistant',
    fullName:     'James Park RDA',
    email:        'j.park@advancedimplantcenter.com',
    practiceId:   'PRACTICE-002',
    dsoId:        '',
  },
  // ── Infection Control ──────────────────────────────────────
  {
    username:     'linda.brooks',
    password:     'Linda@1234',
    role:         'infection_control',
    fullName:     'Linda Brooks RDH',
    email:        'l.brooks@smiledentalgroup.com',
    practiceId:   'PRACTICE-001',
    dsoId:        '',
  },
  {
    username:     'robert.nguyen',
    password:     'Robert@1234',
    role:         'infection_control',
    fullName:     'Robert Nguyen RDH',
    email:        'r.nguyen@advancedimplantcenter.com',
    practiceId:   'PRACTICE-002',
    dsoId:        '',
  },
];

const practices = [
  {
    practiceId:    'PRACTICE-001',
    name:          'Smile Dental Group',
    address:       '1247 N Michigan Ave, Suite 800, Chicago, IL 60610',
    phone:         '312-555-0101',
    email:         'info@smiledentalgroup.com',
    npi:           '1234567890',
    licenseNumber: 'IL-DDS-2019-04821',
    chairCount:    6,
    implantVolume: 20,
    dsoId:         '',
  },
  {
    practiceId:    'PRACTICE-002',
    name:          'Advanced Implant Center',
    address:       '3800 Maple Ave, Suite 200, Dallas, TX 75219',
    phone:         '214-555-0202',
    email:         'info@advancedimplantcenter.com',
    npi:           '0987654321',
    licenseNumber: 'TX-DDS-2020-11234',
    chairCount:    4,
    implantVolume: 35,
    dsoId:         '',
  },
  {
    practiceId:    'PRACTICE-003',
    name:          'Family Dentistry Plus',
    address:       '2100 Coral Way, Suite 301, Miami, FL 33145',
    phone:         '305-555-0303',
    email:         'info@familydentistryplus.com',
    npi:           '1122334455',
    licenseNumber: 'FL-DDS-2018-33891',
    chairCount:    8,
    implantVolume: 12,
    dsoId:         'DSO-001',
  },
  {
    practiceId:    'PRACTICE-004',
    name:          'Aspen Dental - Orlando',
    address:       '4200 Millenia Blvd, Orlando, FL 32839',
    phone:         '407-555-0404',
    email:         'orlando@aspendental.com',
    npi:           '2233445566',
    licenseNumber: 'FL-DDS-2021-44102',
    chairCount:    10,
    implantVolume: 45,
    dsoId:         'DSO-001',
  },
];

const dsoGroups = [
  {
    dsoId:      'DSO-001',
    name:       'Aspen Dental Management',
    hqAddress:  '281 Sanders Creek Pkwy, East Syracuse, NY 13057',
    contact:    'compliance@aspendental.com',
  },
];

const repPractices = [
  { repUsername: 'henry.schein.rep', practiceNames: ['Smile Dental Group', 'Advanced Implant Center'] },
  { repUsername: 'patterson.rep',    practiceNames: ['Family Dentistry Plus', 'Aspen Dental - Orlando'] },
];

const dentists = [
  {
    dentistId:     'DENTIST-001',
    fullName:      'Dr. Sarah Johnson',
    licenseNumber: 'IL-DDS-2015-08821',
    npi:           '1234509876',
    specialty:     'implantologist',
    practices:     ['PRACTICE-001'],
    deaNumber:     '',
  },
  {
    dentistId:     'DENTIST-002',
    fullName:      'Dr. Michael Chen',
    licenseNumber: 'TX-DDS-2012-22341',
    npi:           '9876501234',
    specialty:     'oral_surgeon',
    practices:     ['PRACTICE-002'],
    deaNumber:     'BC1234563',
  },
  {
    dentistId:     'DENTIST-003',
    fullName:      'Dr. Patricia Williams',
    licenseNumber: 'FL-DDS-2010-44521',
    npi:           '5678901234',
    specialty:     'periodontist',
    practices:     ['PRACTICE-003', 'PRACTICE-004'],
    deaNumber:     '',
  },
];

async function seed() {
  console.log('');
  console.log('════════════════════════════════════════════════');
  console.log('  DentalChain Seed');
  console.log('════════════════════════════════════════════════');

  // DSO Groups
  console.log('\n── DSO Groups ──');
  for (const d of dsoGroups) {
    await pool.query(
      `INSERT INTO dso_groups (dso_id, name, hq_address, contact, created_by)
       VALUES ($1,$2,$3,$4,'seed')
       ON CONFLICT (dso_id) DO NOTHING`,
      [d.dsoId, d.name, d.hqAddress, d.contact]
    );
    console.log(`  ✅ ${d.name}`);
  }

  // Practices
  console.log('\n── Practices ──');
  for (const p of practices) {
    await pool.query(
      `INSERT INTO practices
         (practice_id, name, address, phone, email, dso_id,
          npi, license_number, chair_count, implant_volume, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'seed')
       ON CONFLICT (practice_id) DO NOTHING`,
      [p.practiceId, p.name, p.address, p.phone, p.email,
       p.dsoId, p.npi, p.licenseNumber, p.chairCount, p.implantVolume]
    );
    console.log(`  ✅ ${p.name}`);
  }

  // Dentists
  console.log('\n── Dentists ──');
  for (const d of dentists) {
    await pool.query(
      `INSERT INTO dentists
         (dentist_id, full_name, license_number, npi, specialty, practices, dea_number, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'seed')
       ON CONFLICT (dentist_id) DO NOTHING`,
      [d.dentistId, d.fullName, d.licenseNumber, d.npi,
       d.specialty, d.practices, d.deaNumber]
    );
    console.log(`  ✅ ${d.fullName} (${d.specialty})`);
  }

  // Users
  console.log('\n── Users ──');
  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    await pool.query(
      `INSERT INTO users
         (username, password_hash, role, identity_label,
          full_name, email, practice_id, dso_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'seed')
       ON CONFLICT (username) DO NOTHING`,
      [u.username, hash, u.role,
       `${u.fullName}@DentalChainMSP`,
       u.fullName, u.email, u.practiceId, u.dsoId]
    );
    console.log(`  ✅ ${u.role.padEnd(20)} ${u.username.padEnd(25)} ${u.password}`);
  }

  // Rep assignments
  console.log('\n── Rep Practice Assignments ──');
  for (const r of repPractices) {
    for (const name of r.practiceNames) {
      await pool.query(
        `INSERT INTO rep_practices (rep_username, practice_name, assigned_by)
         VALUES ($1,$2,'seed') ON CONFLICT DO NOTHING`,
        [r.repUsername, name]
      );
    }
    console.log(`  ✅ ${r.repUsername} → ${r.practiceNames.join(', ')}`);
  }

  console.log('');
  console.log('════════════════════════════════════════════════');
  console.log('  ✅ DentalChain seeded successfully');
  console.log('');
  console.log('  Login credentials:');
  console.log('  Email                              Password');
  console.log('  ─────────────────────────────────────────────');
  for (const u of users) {
    console.log(`  ${u.email.padEnd(35)} ${u.password}`);
  }
  console.log('════════════════════════════════════════════════');
  console.log('');

  await pool.end();
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
