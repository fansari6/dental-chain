// DentalChain — Main Business Routes
// Devices, lots, consignments, implants, cases, lab work, follow-ups
import express from 'express';
import { requireAuth, requireRole } from './auth.js';
import {
  getPractices, getPracticeByName, getPracticeById,
  getDentists, getRepPractices,
  getDentalCases, getDentalCaseById, createDentalCase,
  updateCaseStatus, updateCasePhase, linkImplantToCase,
  getLabWork, createLabWork, updateLabWorkStatus,
  getFollowUps, createFollowUp, updateFollowUpStatus,
  getRepVisits, createRepVisit, updateRepVisitStatus,
  getLookupValues, getAllLookupValues,
  addAuditLog, getInfectionControlEmails,
} from '../db/index.js';
import { evaluateTransaction, submitTransaction } from '../fabric/gateway.js';

export const router = express.Router();

const identity = req => req.session.user.identityLabel;

// ── Stats ─────────────────────────────────────────────────────
router.get('/assets/stats', requireAuth, async (req, res) => {
  try {
    const result = await evaluateTransaction(identity(req), 'getStats');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Devices ───────────────────────────────────────────────────
router.get('/assets/devices', requireAuth, async (req, res) => {
  try {
    const result = await evaluateTransaction(identity(req), 'getAllDevices');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/device', requireAuth, requireRole('government'), async (req, res) => {
  try {
    const {
      udiDI, deviceName, manufacturerId, deviceType,
      material, diameter, length
    } = req.body;
    const txTime = new Date().toISOString();
    const result = await submitTransaction(
      identity(req), 'registerDentalDevice',
      udiDI, deviceName, manufacturerId,
      deviceType, material, diameter, length, txTime
    );
    await addAuditLog({
      actor: req.session.user.username,
      action: 'REGISTER_DEVICE', target: udiDI,
      details: { deviceName, deviceType, material }
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/device/:udiDI', requireAuth, async (req, res) => {
  try {
    const result = await evaluateTransaction(identity(req), 'getDevice', req.params.udiDI);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// ── Clearances ────────────────────────────────────────────────
router.get('/assets/clearances', requireAuth, async (req, res) => {
  try {
    const result = await evaluateTransaction(identity(req), 'getAllClearances');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/clearance', requireAuth, requireRole('government'), async (req, res) => {
  try {
    const {
      clearanceNumber, udiDI, manufacturerId, clearanceType,
      indicationsForUse, clearanceDate, expiryDate
    } = req.body;
    const txTime = new Date().toISOString();
    const result = await submitTransaction(
      identity(req), 'issueClearance',
      clearanceNumber, udiDI, manufacturerId, clearanceType,
      indicationsForUse, clearanceDate, expiryDate || '', txTime
    );
    await addAuditLog({
      actor: req.session.user.username,
      action: 'ISSUE_CLEARANCE', target: clearanceNumber
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ISO 13485 ─────────────────────────────────────────────────
router.get('/assets/iso13485', requireAuth, async (req, res) => {
  try {
    const result = await evaluateTransaction(identity(req), 'getAllISO13485');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/iso13485', requireAuth, requireRole('manufacturer', 'admin'), async (req, res) => {
  try {
    const {
      certId, manufacturerId, facilityName, facilityAddress,
      scope, certBody, issueDate, expiryDate
    } = req.body;
    const txTime = new Date().toISOString();
    const result = await submitTransaction(
      identity(req), 'uploadISO13485',
      certId, manufacturerId, facilityName, facilityAddress,
      scope, certBody, issueDate, expiryDate, txTime
    );
    await addAuditLog({
      actor: req.session.user.username,
      action: 'UPLOAD_ISO13485', target: certId
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Lots ──────────────────────────────────────────────────────
router.get('/assets/lots', requireAuth, async (req, res) => {
  try {
    const result = await evaluateTransaction(identity(req), 'getAllLots');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/lot', requireAuth, requireRole('manufacturer'), async (req, res) => {
  try {
    const {
      lotId, udiDI, clearanceNumber, certId, lotNumber,
      manufacturingDate, expiryDate, sterileExpiryDate, quantity, storageConditions
    } = req.body;
    const txTime = new Date().toISOString();
    const result = await submitTransaction(
      identity(req), 'createLot',
      lotId, udiDI, clearanceNumber, certId, lotNumber,
      manufacturingDate, expiryDate, sterileExpiryDate || expiryDate,
      quantity, storageConditions || '', txTime
    );
    await addAuditLog({
      actor: req.session.user.username,
      action: 'CREATE_LOT', target: lotId,
      details: { udiDI, quantity }
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/lot/:lotId/release', requireAuth, requireRole('manufacturer'), async (req, res) => {
  try {
    const txTime = new Date().toISOString();
    const result = await submitTransaction(
      identity(req), 'releaseLot',
      req.params.lotId, req.body.qcNotes || '', txTime
    );
    await addAuditLog({
      actor: req.session.user.username,
      action: 'RELEASE_LOT', target: req.params.lotId
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/lot/:lotId/recall', requireAuth, requireRole('government', 'manufacturer'), async (req, res) => {
  try {
    const { recallClass, reason, affectedLotNumbers } = req.body;
    const txTime = new Date().toISOString();
    const result = await submitTransaction(
      identity(req), 'recallLot',
      req.params.lotId, recallClass, reason,
      affectedLotNumbers || '', txTime
    );
    // Notify infection control officers
    const icEmails = await getInfectionControlEmails('');
    if (icEmails.length > 0) {
      const { sendEmail, recallAlertTemplate } = await import(
        '../../../core/backend-shared/email/email.js'
      );
      const { subject, html } = recallAlertTemplate({
        lotId: req.params.lotId, recallClass, reason,
        recalledBy: req.session.user.username
      });
      await sendEmail({ to: icEmails, subject, html });
    }
    await addAuditLog({
      actor: req.session.user.username,
      action: 'RECALL_LOT', target: req.params.lotId,
      details: { recallClass, reason }
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Consignments ──────────────────────────────────────────────
router.get('/assets/consignments', requireAuth, async (req, res) => {
  try {
    const { practiceId, repId } = req.query;
    const role = req.session.user.role;
    const userPracticeId = req.session.user.practiceId;
    let result;
    if (practiceId) {
      result = await evaluateTransaction(identity(req), 'getConsignmentsByHospital', practiceId);
    } else if (repId) {
      result = await evaluateTransaction(identity(req), 'getConsignmentsByRep', repId);
    } else if (role === 'distributor') {
      result = await evaluateTransaction(identity(req), 'getConsignmentsByRep', req.session.user.username);
    } else if (['dental_assistant', 'infection_control'].includes(role) && userPracticeId) {
      result = await evaluateTransaction(identity(req), 'getConsignmentsByHospital', userPracticeId);
    } else {
      result = await evaluateTransaction(identity(req), 'getAllConsignments');
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/consignment', requireAuth, requireRole('distributor'), async (req, res) => {
  try {
    const { consignmentId, lotId, practiceId, quantity, location } = req.body;
    // Territory enforcement
    const allowed = await getRepPractices(req.session.user.username);
    const practice = await getPracticeByName(practiceId) || await getPracticeById(practiceId);
    if (!practice) return res.status(404).json({ error: 'Practice not found' });
    if (!allowed.includes(practice.name))
      return res.status(403).json({ error: `Not authorized to serve practice '${practice.name}'` });

    const txTime = new Date().toISOString();
    const result = await submitTransaction(
      identity(req), 'createConsignment',
      consignmentId, lotId, practice.name, quantity, location, txTime
    );
    await addAuditLog({
      actor: req.session.user.username,
      action: 'CREATE_CONSIGNMENT', target: consignmentId,
      details: { lotId, practiceId: practice.name, quantity }
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/consignment/:consignmentId/return', requireAuth, async (req, res) => {
  try {
    const { quantity, reason } = req.body;
    const txTime = new Date().toISOString();
    const result = await submitTransaction(
      identity(req), 'returnConsignment',
      req.params.consignmentId, quantity, reason, txTime
    );
    await addAuditLog({
      actor: req.session.user.username,
      action: 'RETURN_CONSIGNMENT', target: req.params.consignmentId
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Implant Recording — 3 Stage ───────────────────────────────
router.post('/implant/post', requireAuth, requireRole('dentist', 'dental_assistant'), async (req, res) => {
  try {
    const {
      implantId, consignmentId, udiDI, lotNumber,
      patientIdHash, dentistId, toothNumber, toothSystem,
      procedureDate, notes, caseId
    } = req.body;
    const txTime = new Date().toISOString();
    const result = await submitTransaction(
      identity(req), 'recordImplantPost',
      implantId, consignmentId, udiDI, lotNumber,
      patientIdHash, dentistId, toothNumber, toothSystem || 'universal',
      procedureDate, notes || '', txTime
    );
    // Link to case if provided
    if (caseId) await linkImplantToCase(caseId, implantId);
    await addAuditLog({
      actor: req.session.user.username,
      action: 'RECORD_IMPLANT_POST', target: implantId,
      details: { toothNumber, toothSystem, dentistId }
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/implant/:implantId/abutment', requireAuth, requireRole('dentist', 'dental_assistant'), async (req, res) => {
  try {
    const { abutmentUdiDI, abutmentLot, placementDate, torqueSpec } = req.body;
    const txTime = new Date().toISOString();
    const result = await submitTransaction(
      identity(req), 'recordAbutment',
      req.params.implantId, abutmentUdiDI, abutmentLot,
      placementDate, torqueSpec || '', txTime
    );
    await addAuditLog({
      actor: req.session.user.username,
      action: 'RECORD_ABUTMENT', target: req.params.implantId
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/implant/:implantId/crown', requireAuth, requireRole('dentist', 'dental_assistant'), async (req, res) => {
  try {
    const { crownUdiDI, crownLot, labId, placementDate, material, shade } = req.body;
    const txTime = new Date().toISOString();
    const result = await submitTransaction(
      identity(req), 'recordCrown',
      req.params.implantId, crownUdiDI, crownLot,
      labId || '', placementDate, material || '', shade || '', txTime
    );
    await addAuditLog({
      actor: req.session.user.username,
      action: 'RECORD_CROWN', target: req.params.implantId,
      details: { material, shade }
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/assets/implants', requireAuth, async (req, res) => {
  try {
    const result = await evaluateTransaction(identity(req), 'getAllImplants');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history/implant/:implantId', requireAuth, async (req, res) => {
  try {
    const result = await evaluateTransaction(identity(req), 'getImplantHistory', req.params.implantId);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// ── Lab Work ──────────────────────────────────────────────────
router.get('/lab-work', requireAuth, async (req, res) => {
  try {
    const { practiceId, caseId, status } = req.query;
    const rows = await getLabWork({ practiceId, caseId, status });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/lab-work', requireAuth, requireRole('dentist', 'dental_assistant'), async (req, res) => {
  try {
    const labWork = await createLabWork({
      ...req.body,
      createdBy: req.session.user.username
    });
    // Record on blockchain
    const txTime = new Date().toISOString();
    await submitTransaction(
      identity(req), 'sendToLab',
      labWork.lab_work_id, labWork.implant_id || '',
      labWork.lab_id || '', labWork.work_type || '',
      labWork.sent_date?.toString() || txTime, req.body.instructions || '', txTime
    );
    await addAuditLog({
      actor: req.session.user.username,
      action: 'SEND_TO_LAB', target: labWork.lab_work_id,
      details: { labName: req.body.labName, workType: req.body.workType }
    });
    res.status(201).json(labWork);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/lab-work/:labWorkId/status', requireAuth, async (req, res) => {
  try {
    const { status, receivedDate, condition, notes } = req.body;
    const labWork = await updateLabWorkStatus(req.params.labWorkId, status, receivedDate);
    if (status === 'received') {
      const txTime = new Date().toISOString();
      await submitTransaction(
        identity(req), 'receiveFromLab',
        req.params.labWorkId, receivedDate || txTime,
        condition || 'good', notes || '', txTime
      );
    }
    await addAuditLog({
      actor: req.session.user.username,
      action: 'UPDATE_LAB_WORK', target: req.params.labWorkId,
      details: { status }
    });
    res.json(labWork);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Follow-ups ────────────────────────────────────────────────
router.get('/follow-ups', requireAuth, async (req, res) => {
  try {
    const { practiceId, caseId, status } = req.query;
    const rows = await getFollowUps({ practiceId, caseId, status });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/follow-up', requireAuth, async (req, res) => {
  try {
    const followUp = await createFollowUp({
      ...req.body,
      createdBy: req.session.user.username
    });
    const txTime = new Date().toISOString();
    await submitTransaction(
      identity(req), 'recordFollowUp',
      followUp.follow_up_id, followUp.implant_id || '',
      followUp.scheduled_date?.toString() || txTime,
      followUp.follow_up_type, 'scheduled', '', txTime
    );
    await addAuditLog({
      actor: req.session.user.username,
      action: 'CREATE_FOLLOW_UP', target: followUp.follow_up_id
    });
    res.status(201).json(followUp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/follow-up/:followUpId/status', requireAuth, async (req, res) => {
  try {
    const { status, outcome, completedDate, notes } = req.body;
    const followUp = await updateFollowUpStatus(
      req.params.followUpId, status, outcome, completedDate
    );
    if (status === 'completed') {
      const txTime = new Date().toISOString();
      await submitTransaction(
        identity(req), 'recordFollowUp',
        req.params.followUpId, '',
        completedDate || txTime, '', outcome || '', notes || '', txTime
      );
    }
    res.json(followUp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Dental Cases ──────────────────────────────────────────────
router.get('/cases', requireAuth, async (req, res) => {
  try {
    const { practiceId, dentistId, status, date } = req.query;
    const cases = await getDentalCases({ practiceId, dentistId, status, date });
    res.json(cases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cases', requireAuth, async (req, res) => {
  try {
    const caseId = `CASE-${Date.now()}`;
    const newCase = await createDentalCase({
      caseId, ...req.body,
      createdBy: req.session.user.username
    });
    await addAuditLog({
      actor: req.session.user.username,
      action: 'CREATE_CASE', target: caseId,
      details: { toothNumber: req.body.toothNumber, procedureType: req.body.procedureType }
    });
    res.status(201).json(newCase);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/cases/:caseId/status', requireAuth, async (req, res) => {
  try {
    const updated = await updateCaseStatus(req.params.caseId, req.body.status);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/cases/:caseId/phase', requireAuth, async (req, res) => {
  try {
    const updated = await updateCasePhase(req.params.caseId, req.body.phase);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cases/:caseId/link-implant', requireAuth, async (req, res) => {
  try {
    const updated = await linkImplantToCase(req.params.caseId, req.body.implantId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Recall ────────────────────────────────────────────────────
router.get('/recall/patients-by-lot/:lotNumber', requireAuth, async (req, res) => {
  try {
    const result = await evaluateTransaction(
      identity(req), 'getPatientsByLot', req.params.lotNumber
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/recall/notification', requireAuth, async (req, res) => {
  try {
    const {
      notificationId, lotNumber, implantId, patientIdHash,
      practiceId, notificationMethod, notifiedBy, notes
    } = req.body;
    const txTime = new Date().toISOString();
    const result = await submitTransaction(
      identity(req), 'recordRecallNotification',
      notificationId, lotNumber, implantId, patientIdHash,
      practiceId, notificationMethod, notifiedBy || req.session.user.username,
      notes || '', txTime
    );
    await addAuditLog({
      actor: req.session.user.username,
      action: 'RECALL_NOTIFICATION', target: notificationId,
      details: { lotNumber, implantId, notificationMethod }
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Rep Visits ────────────────────────────────────────────────
router.get('/rep-visits', requireAuth, async (req, res) => {
  try {
    const { repUsername, practiceId, status } = req.query;
    const visits = await getRepVisits({ repUsername, practiceId, status });
    res.json(visits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/rep-visits', requireAuth, requireRole('distributor', 'admin'), async (req, res) => {
  try {
    const visitId = `VIS-${Date.now()}`;
    const visit = await createRepVisit({
      visitId, ...req.body,
      repUsername: req.body.repUsername || req.session.user.username,
      createdBy: req.session.user.username
    });
    await addAuditLog({
      actor: req.session.user.username,
      action: 'CREATE_REP_VISIT', target: visitId,
      details: { practiceId: req.body.practiceId }
    });
    res.status(201).json(visit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/rep-visits/:visitId/status', requireAuth, async (req, res) => {
  try {
    const visit = await updateRepVisitStatus(req.params.visitId, req.body.status);
    res.json(visit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Practices & Dentists ──────────────────────────────────────
router.get('/practices', requireAuth, async (req, res) => {
  try {
    const practices = await getPractices();
    res.json(practices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dentists', requireAuth, async (req, res) => {
  try {
    const { practiceId, specialty } = req.query;
    const dentists = await getDentists(practiceId, specialty);
    res.json(dentists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Expiry Alerts ─────────────────────────────────────────────
router.get('/alerts/expiry', requireAuth, async (req, res) => {
  try {
    const lots = JSON.parse(
      await evaluateTransaction(identity(req), 'getAllLots')
    );
    const today = new Date();
    const in90  = new Date(today); in90.setDate(today.getDate() + 90);
    const in30  = new Date(today); in30.setDate(today.getDate() + 30);
    const alerts = lots
      .filter(l => l.status === 'active' && l.expiryDate)
      .map(l => {
        const exp  = new Date(l.expiryDate);
        const days = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
        return { ...l, daysUntilExpiry: days,
          urgency: days <= 0 ? 'expired' : days <= 30 ? 'critical' : 'warning' };
      })
      .filter(l => l.daysUntilExpiry <= 90)
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Lookup Values ─────────────────────────────────────────────
router.get('/lookup/:category', requireAuth, async (req, res) => {
  try {
    const values = await getLookupValues(req.params.category);
    res.json(values);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/lookups', requireAuth, async (req, res) => {
  try {
    const values = await getAllLookupValues();
    res.json(values);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Public Verification ───────────────────────────────────────
router.get('/verify/device/:udiDI', async (req, res) => {
  try {
    const result = await evaluateTransaction(
      'public', 'verifyDevice', req.params.udiDI
    );
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.get('/chaincode-version', requireAuth, async (req, res) => {
  try {
    const version = await evaluateTransaction(identity(req), 'getVersion');
    res.json({ version });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
