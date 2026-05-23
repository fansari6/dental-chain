import 'dotenv/config';
// DentalChain Backend Server
// Dental implant traceability on Hyperledger Fabric 2.5
import express          from 'express';
import session          from 'express-session';
import cors             from 'cors';
import pg               from 'pg';
import connectPgSimple  from 'connect-pg-simple';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Env ───────────────────────────────────────────────────────
function parseEnvFile(filePath) {
  const env = {};
  try {
    const content = readFileSync(resolve(__dirname, filePath), 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^([^#=\s][^=]*)=(.*)/);
      if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  } catch {}
  return env;
}

const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
const env     = parseEnvFile(envFile);

const PORT = env.PORT || process.env.PORT || 4001;

// ── Database Pool ─────────────────────────────────────────────
const { Pool } = pg;
export const pool = new Pool({
  host:     env.DB_HOST     || process.env.DB_HOST     || 'localhost',
  port:     parseInt(env.DB_PORT || process.env.DB_PORT || '5433'),
  database: env.DB_NAME     || process.env.DB_NAME     || 'dental_chain',
  user:     env.DB_USER     || process.env.DB_USER     || 'postgres',
  password: env.DB_PASSWORD || process.env.DB_PASSWORD || '',
  max: 10,
  idleTimeoutMillis: 30000,
});

// ── Express App ───────────────────────────────────────────────
const app = express();
const PgSession = connectPgSimple(session);

app.use(cors({
  origin:      env.FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:5174',
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  store: new PgSession({ pool, tableName: 'session' }),
  secret:            env.SESSION_SECRET || process.env.SESSION_SECRET || 'dental-dev-secret',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure:   false,
    maxAge:   8 * 60 * 60 * 1000,
    sameSite: 'lax',
  },
}));

// ── Routes ────────────────────────────────────────────────────
import { router as authRouter }   from './routes/auth.js';
import { router as dentalRouter } from './routes/dental.js';
import { router as adminRouter }  from './routes/admin.js';

app.use('/api', authRouter);
app.use('/api', dentalRouter);
app.use('/api/admin', adminRouter);

// ── Health ────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status:  'ok',
  app:     'DentalChain',
  version: '1.0.0',
  port:    PORT,
}));

export default app;

// ── Start ─────────────────────────────────────────────────────
async function start() {
  try {
    const { initDb } = await import('./db/index.js');
    await initDb();
    app.listen(PORT, () => {
      console.log('🦷 DentalChain backend running on port', PORT);
    });
  } catch (err) {
    console.error('❌ Failed to start DentalChain:', err.message);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') start();
