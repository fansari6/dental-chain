// DentalChain — Auth Routes
// Login, logout, session, user management
import express   from 'express';
import bcrypt    from 'bcryptjs';
import {
  findUserByUsername, findUserByEmail, getAllUsers, getUsersByRole,
  createUser, setUserActive, updateUserFullName, setUserEmail,
  getPractices, getRepPractices, addAuditLog
} from '../db/index.js';

export const router = express.Router();

const requireAuth = (req, res, next) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
  if (!roles.includes(req.session.user.role))
    return res.status(403).json({ error: 'Insufficient permissions' });
  next();
};

// ── Login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const identifier = username || email;
    if (!identifier || !password)
      return res.status(400).json({ error: 'Username and password required' });

    const user = await findUserByEmail(identifier) || await findUserByUsername(identifier);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.is_active) return res.status(403).json({ error: 'Account is inactive' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    // Load rep's assigned practices
    let assignedPractices = [];
    if (user.role === 'distributor') {
      assignedPractices = await getRepPractices(user.username);
    }

    req.session.user = {
      username:    user.username,
      fullName:    user.full_name,
      role:        user.role,
      identityLabel: user.identity_label,
      organization:  user.organization,
      practiceId:  user.practice_id,
      dsoId:       user.dso_id,
      email:       user.email,
      assignedPractices,
    };

    await addAuditLog({ actor: user.username, action: 'LOGIN', target: user.username });
    res.json({ success: true, user: req.session.user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── Logout ────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  const username = req.session?.user?.username;
  req.session.destroy(() => {
    if (username) addAuditLog({ actor: username, action: 'LOGOUT', target: username });
    res.json({ success: true });
  });
});

// ── Session ───────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});

// ── Users ─────────────────────────────────────────────────────
router.get('/users', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users-by-role/:role', requireAuth, async (req, res) => {
  try {
    const users = await getUsersByRole(req.params.role);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const {
      username, password, role, identityLabel,
      organization, practiceId, dsoId, email, fullName
    } = req.body;
    if (!username || !password || !role)
      return res.status(400).json({ error: 'username, password and role required' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({
      username, passwordHash, role, identityLabel: identityLabel || username,
      organization, practiceId, dsoId, email, fullName,
      createdBy: req.session.user.username
    });
    await addAuditLog({
      actor: req.session.user.username,
      action: 'CREATE_USER',
      target: username,
      details: { role, practiceId }
    });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:username/active', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const user = await setUserActive(req.params.username, req.body.isActive);
    await addAuditLog({
      actor: req.session.user.username,
      action: req.body.isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      target: req.params.username
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:username/email', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const user = await setUserEmail(req.params.username, req.body.email);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { requireAuth, requireRole };
