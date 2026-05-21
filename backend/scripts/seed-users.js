#!/usr/bin/env node
/**
 * seed-users.js — standalone script to seed ImplantChain users into PostgreSQL
 * Usage: node seed-users.js
 */
import bcrypt from 'bcryptjs';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'implant_chain',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD,
});

const USERS = [
  { username:'adminUser',       password:'Admin@1234',      role:'admin',               organization:'DApp Architects',     hospitalId:null },
  { username:'government1',     password:'Gov1-1234',       role:'government',          organization:'FDA',                  hospitalId:null },
  { username:'infectionprev1',  password:'IP1-1234',        role:'infection_prevention',organization:'Infection Prevention', hospitalId:null },
  { username:'stryker',         password:'Stryker@1234',    role:'manufacturer',        organization:'Stryker Corporation', hospitalId:null },
  { username:'medtronic',       password:'Medtronic@1234',  role:'manufacturer',        organization:'Medtronic',           hospitalId:null },
  { username:'smithnephew',     password:'Smith@1234',      role:'manufacturer',        organization:'Smith & Nephew',      hospitalId:null },
  { username:'abbott',          password:'Abbott@1234',     role:'manufacturer',        organization:'Abbott',              hospitalId:null },
  { username:'ethicon',         password:'Ethicon@1234',    role:'manufacturer',        organization:'Ethicon',             hospitalId:null },
  { username:'allergan',        password:'Allergan@1234',   role:'manufacturer',        organization:'Allergan',            hospitalId:null },
  { username:'rep-memorial',    password:'Rep-Mem@1234',    role:'distributor',         organization:'DApp MedTech Rep',    hospitalId:'Memorial Hospital' },
  { username:'rep-university',  password:'Rep-Uni@1234',    role:'distributor',         organization:'DApp MedTech Rep',    hospitalId:'University Hospital' },
  { username:'sc-memorial',     password:'SC-Mem@1234',     role:'supply_chain',        organization:'Memorial Hospital',   hospitalId:'Memorial Hospital' },
  { username:'sc-university',   password:'SC-Uni@1234',     role:'supply_chain',        organization:'University Hospital', hospitalId:'University Hospital' },
  { username:'nurse-memorial',  password:'Nurse-Mem@1234',  role:'nurse',               organization:'Memorial Hospital',   hospitalId:'Memorial Hospital' },
  { username:'nurse-university',password:'Nurse-Uni@1234',  role:'nurse',               organization:'University Hospital', hospitalId:'University Hospital' },
];

for (const u of USERS) {
  const hash = await bcrypt.hash(u.password, 12);
  await pool.query(
    `INSERT INTO users (username, password_hash, role, identity_label, organization, hospital_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,'system')
     ON CONFLICT (username) DO UPDATE SET
       password_hash=$2, role=$3, organization=$5, hospital_id=$6`,
    [u.username, hash, u.role, u.username, u.organization, u.hospitalId]
  );
  console.log(`✅ ${u.username} (${u.role})`);
}
console.log('\n✅ ImplantChain users seeded');
await pool.end();
