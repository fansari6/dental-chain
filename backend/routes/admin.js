// DentalChain — Admin Routes
// Users, practices, DSO groups, dentists, analytics, audit, email, onboarding
import express from 'express';
import { requireAuth, requireRole } from './auth.js';
import {
  getAllUsers, createUser, setUserActive, updateUserFullName, setUserEmail,
  getPractices, createPractice, updatePractice, deletePractice,
  getDsoGroups, createDsoGroup,
  getDentists, createDentist, updateDentist, setDentistActive,
  getRepPractices, setRepPractices,
  getAuditLog, getAuditActions,
  getEmailLog, getUsersWithEmail, addAuditLog,
  getAllLookupValues, getLookupValues,
} from '../db/index.js';
import bcrypt from 'bcryptjs';

export const router = express.Router();

// ── Users ─────────────────────────────────────────────────────
router.get('/users', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    res.json(await getAllUsers());
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
      username, passwordHash, role,
      identityLabel: identityLabel || username,
      organization, practiceId, dsoId, email, fullName,
      createdBy: req.session.user.username
    });
    await addAuditLog({
      actor: req.session.user.username,
      action: 'CREATE_USER', target: username,
      details: { role, practiceId, dsoId }
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
    res.json(await setUserEmail(req.params.username, req.body.email));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Practices ─────────────────────────────────────────────────
router.get('/practices', requireAuth, requireRole('admin', 'government'), async (req, res) => {
  try {
    res.json(await getPractices());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/practices', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const practice = await createPractice({
      ...req.body,
      practiceId: req.body.practiceId || `PRACTICE-${Date.now()}`,
      createdBy: req.session.user.username
    });
    await addAuditLog({
      actor: req.session.user.username,
      action: 'CREATE_PRACTICE', target: practice.practice_id,
      details: { name: practice.name, dsoId: practice.dso_id }
    });
    res.status(201).json(practice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/practices/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    res.json(await updatePractice(req.params.id, req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/practices/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    await deletePractice(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DSO Groups ────────────────────────────────────────────────
router.get('/dso-groups', requireAuth, requireRole('admin', 'government'), async (req, res) => {
  try {
    res.json(await getDsoGroups());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/dso-groups', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const dso = await createDsoGroup({
      ...req.body,
      dsoId: req.body.dsoId || `DSO-${Date.now()}`,
      createdBy: req.session.user.username
    });
    await addAuditLog({
      actor: req.session.user.username,
      action: 'CREATE_DSO', target: dso.dso_id,
      details: { name: dso.name }
    });
    res.status(201).json(dso);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Dentists ──────────────────────────────────────────────────
router.get('/dentists', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    res.json(await getDentists());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/dentists', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const dentist = await createDentist({
      ...req.body,
      dentistId: req.body.dentistId || `DENTIST-${Date.now()}`,
      createdBy: req.session.user.username
    });
    await addAuditLog({
      actor: req.session.user.username,
      action: 'CREATE_DENTIST', target: dentist.dentist_id,
      details: { fullName: dentist.full_name, specialty: dentist.specialty }
    });
    res.status(201).json(dentist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/dentists/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    res.json(await updateDentist(req.params.id, req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/dentists/:id/active', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    await setDentistActive(req.params.id, req.body.isActive);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Rep Practice Assignments ──────────────────────────────────
router.get('/rep-practices/:repUsername', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    res.json(await getRepPractices(req.params.repUsername));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/rep-practices', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { repUsername, practices } = req.body;
    await setRepPractices(repUsername, practices, req.session.user.username);
    await addAuditLog({
      actor: req.session.user.username,
      action: 'SET_REP_PRACTICES', target: repUsername,
      details: { practices }
    });
    res.json({ success: true, repUsername, practices });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Analytics ─────────────────────────────────────────────────
router.get('/analytics', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const days   = parseInt(req.query.days) || 30;
    const since  = new Date();
    since.setDate(since.getDate() - days);

    const allLogs = await getAuditLog({ limit: 5000, from: since.toISOString() });

    // Action breakdown
    const actionMap = {};
    for (const log of allLogs) {
      actionMap[log.action] = (actionMap[log.action] || 0) + 1;
    }
    const actionBreakdown = Object.entries(actionMap)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count);

    // Top users
    const userMap = {};
    for (const log of allLogs) {
      userMap[log.actor] = (userMap[log.actor] || 0) + 1;
    }
    const topUsers = Object.entries(userMap)
      .map(([actor, count]) => ({ actor, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Daily activity
    const dayMap = {};
    for (const log of allLogs) {
      const day = log.created_at.toISOString().split('T')[0];
      dayMap[day] = (dayMap[day] || 0) + 1;
    }
    const dailyActivity = Object.entries(dayMap)
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day));

    // Role breakdown
    const roleCategories = {
      'Admin/Auth':    ['LOGIN', 'LOGOUT', 'CREATE_USER', 'ACTIVATE_USER', 'DEACTIVATE_USER'],
      'Clinical':      ['RECORD_IMPLANT_POST', 'RECORD_ABUTMENT', 'RECORD_CROWN', 'CREATE_CASE', 'CREATE_FOLLOW_UP'],
      'Recall':        ['RECALL_LOT', 'RECALL_NOTIFICATION', 'BULK_RECALL_NOTIFICATION'],
      'Distributor':   ['CREATE_CONSIGNMENT', 'RETURN_CONSIGNMENT', 'CREATE_REP_VISIT'],
      'Government':    ['REGISTER_DEVICE', 'ISSUE_CLEARANCE'],
      'Lab':           ['SEND_TO_LAB', 'UPDATE_LAB_WORK'],
    };
    const roleBreakdown = Object.entries(roleCategories).map(([category, actions]) => ({
      category,
      count: allLogs.filter(l => actions.includes(l.action)).length
    }));

    // All-time
    const allTimeLogs = await getAuditLog({ limit: 99999 });
    const allUsers    = await getAllUsers();

    res.json({
      summary: {
        totalActions:  allLogs.length,
        activeUsers:   new Set(allLogs.map(l => l.actor)).size,
        allTimeActions: allTimeLogs.length,
        totalUsers:    allUsers.length,
      },
      period:         { days, start: since.toISOString(), end: new Date().toISOString() },
      actionBreakdown,
      topUsers,
      dailyActivity,
      roleBreakdown,
      recentActivity: allLogs.slice(0, 20),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Audit Log ─────────────────────────────────────────────────
router.get('/audit', requireAuth, requireRole('admin', 'government'), async (req, res) => {
  try {
    const { limit, actor, action, search, from, to } = req.query;
    const logs = await getAuditLog({ limit, actor, action, search, from, to });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/audit/actions', requireAuth, requireRole('admin', 'government'), async (req, res) => {
  try {
    res.json(await getAuditActions());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Email Log ─────────────────────────────────────────────────
router.get('/email/log', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    res.json(await getEmailLog(100));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Onboarding Checklist ──────────────────────────────────────
router.get('/onboarding', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const practices = await getPractices();
    const allUsers  = await getAllUsers();
    const allLogs   = await getAuditLog({ limit: 99999 });

    const checklist = practices.map(p => {
      const practiceUsers = allUsers.filter(u => u.practice_id === p.practice_id);
      const practiceLogs  = allLogs.filter(l =>
        practiceUsers.some(u => u.username === l.actor)
      );

      const hasAdmin    = practiceUsers.some(u => u.role === 'admin');
      const hasIC       = practiceUsers.some(u => u.role === 'infection_control');
      const hasDentist  = practiceUsers.some(u => u.role === 'dentist');
      const hasRep      = practiceUsers.some(u => u.role === 'distributor');
      const firstImplant = practiceLogs.some(l => l.action === 'RECORD_IMPLANT_POST');
      const firstCase    = practiceLogs.some(l => l.action === 'CREATE_CASE');
      const labWork      = practiceLogs.some(l => l.action === 'SEND_TO_LAB');
      const followUp     = practiceLogs.some(l => l.action === 'CREATE_FOLLOW_UP');

      const checks = [
        { id: 'admin',         label: 'Admin user created',               done: hasAdmin },
        { id: 'ic',            label: 'Infection control officer assigned', done: hasIC },
        { id: 'dentist',       label: 'Dentist added with license + NPI',  done: hasDentist },
        { id: 'rep',           label: 'Rep territory assigned',            done: hasRep },
        { id: 'first_implant', label: 'First implant post recorded',       done: firstImplant },
        { id: 'first_case',    label: 'First treatment case created',      done: firstCase },
        { id: 'lab_work',      label: 'Lab work chain of custody used',    done: labWork },
        { id: 'follow_up',     label: 'Osseointegration follow-up logged', done: followUp },
      ];

      const completed = checks.filter(c => c.done).length;
      const phase = completed <= 2 ? 1 : completed <= 5 ? 2 : 3;

      return {
        practiceId:   p.practice_id,
        name:         p.name,
        dsoId:        p.dso_id,
        checks,
        completed,
        total:        checks.length,
        progress:     Math.round((completed / checks.length) * 100),
        phase,
      };
    });

    res.json(checklist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Lookup Values ─────────────────────────────────────────────
router.get('/lookups', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    res.json(await getAllLookupValues());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
