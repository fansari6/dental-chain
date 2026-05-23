'use strict';
const { BaseContract } = require('./base-contract.js');

/**
 * DentalContract — extends BaseContract with dental-specific functions

 * Key differences from ImplantContract:
 *   - Tooth number (FDI/Universal) instead of body location
 *   - 3-stage implant: POST → ABUTMENT → CROWN
 *   - Lab work chain of custody
 *   - Osseointegration follow-up tracking
 */
class DentalContract extends BaseContract {
  constructor() {
    super();
    this.VERSION = '1.0';
  }

  // ── Device Registration (inherited logic, dental categories) ──
  async registerDentalDevice(ctx, udiDI, deviceName, manufacturerId,
    deviceType, material, diameter, length, timestamp) {
    this._checkRole(ctx, 'government');
    if (await this._assetExists(ctx, `DEVICE_${udiDI}`))
      throw new Error(`Device ${udiDI} already registered`);

    const asset = {
      udiDI, deviceName, manufacturerId,
      deviceType,   // implant-post | abutment | crown | bone-graft | membrane
      material,     // titanium | zirconia | peek | cobalt-chrome
      diameter,     // e.g. 3.5mm, 4.0mm, 4.5mm
      length,       // e.g. 8mm, 10mm, 12mm, 14mm
      registeredBy: this._getCallerInfo(ctx).userId,
      registeredAt: timestamp,
      status: 'active',
    };
    return JSON.stringify(await this._putAsset(ctx, `DEVICE_${udiDI}`, asset));
  }

  // ── 3-Stage Implant Recording ─────────────────────────────────
  async recordImplantPost(ctx, implantId, consignmentId, udiDI,
    lotNumber, patientIdHash, dentistId, toothNumber, toothSystem,
    procedureDate, notes, timestamp) {
    this._checkRole(ctx, 'dentist', 'dental_assistant');

    const asset = {
      implantId, consignmentId, udiDI, lotNumber,
      patientIdHash,
      dentistId,
      toothNumber,   // e.g. "14" (Universal) or "26" (FDI)
      toothSystem,   // "universal" | "fdi"
      procedureDate,
      notes,
      stage:  'post',       // post | abutment | crown
      status: 'implanted',
      recordedBy: this._getCallerInfo(ctx).userId,
      recordedAt: timestamp,
      abutmentId: null,
      crownId:    null,
    };
    ctx.stub.setEvent('DentalPostRecorded',
      Buffer.from(JSON.stringify({ implantId, toothNumber, dentistId })));
    return JSON.stringify(await this._putAsset(ctx, `IMPLANT_${implantId}`, asset));
  }

  async recordAbutment(ctx, implantId, abutmentUdiDI, abutmentLot,
    placementDate, torqueSpec, timestamp) {
    this._checkRole(ctx, 'dentist', 'dental_assistant');
    const implant = await this._getAsset(ctx, `IMPLANT_${implantId}`);
    if (implant.stage !== 'post')
      throw new Error(`Implant ${implantId} must be at post stage to add abutment`);

    implant.stage       = 'abutment';
    implant.abutmentUdiDI = abutmentUdiDI;
    implant.abutmentLot   = abutmentLot;
    implant.abutmentDate  = placementDate;
    implant.torqueSpec    = torqueSpec;
    implant.updatedAt     = timestamp;
    return JSON.stringify(await this._putAsset(ctx, `IMPLANT_${implantId}`, implant));
  }  

async recordCrown(ctx, implantId, crownUdiDI, crownLot,
    labId, placementDate, material, shade, timestamp) {
    this._checkRole(ctx, 'dentist', 'dental_assistant');
    const implant = await this._getAsset(ctx, `IMPLANT_${implantId}`);
    if (implant.stage !== 'abutment')
      throw new Error(`Implant ${implantId} must have abutment before crown`);

    implant.stage       = 'crown';
    implant.crownUdiDI  = crownUdiDI;
    implant.crownLot    = crownLot;
    implant.labId       = labId;
    implant.crownDate   = placementDate;
    implant.crownMaterial = material;  // zirconia | porcelain | pfm | gold
    implant.crownShade  = shade;       // e.g. A2, B1
    implant.status      = 'complete';
    implant.updatedAt   = timestamp;
    return JSON.stringify(await this._putAsset(ctx, `IMPLANT_${implantId}`, implant));
  }

  // ── Lab Work Chain of Custody ─────────────────────────────────
  async sendToLab(ctx, labWorkId, implantId, labId,
    workType, sentDate, instructions, timestamp) {
    this._checkRole(ctx, 'dentist', 'dental_assistant');
    const asset = {
      labWorkId, implantId, labId,
      workType,    // crown | abutment | bridge | veneer
      sentDate, instructions,
      status: 'at_lab',
      sentBy: this._getCallerInfo(ctx).userId,
      sentAt: timestamp,
      returnedDate: null,
    };
    return JSON.stringify(await this._putAsset(ctx, `LAB_${labWorkId}`, asset));
  }

  async receiveFromLab(ctx, labWorkId, receivedDate,
    condition, notes, timestamp) {
    this._checkRole(ctx, 'dentist', 'dental_assistant');
    const work = await this._getAsset(ctx, `LAB_${labWorkId}`);
    work.status       = 'received';
    work.receivedDate = receivedDate;
    work.condition    = condition;
    work.labNotes     = notes;
    work.updatedAt    = timestamp;
    return JSON.stringify(await this._putAsset(ctx, `LAB_${labWorkId}`, work));
  }

  // ── Osseointegration Follow-up ────────────────────────────────
  async recordFollowUp(ctx, followUpId, implantId,
    followUpDate, followUpType, outcome, notes, timestamp) {
    this._checkRole(ctx, 'dentist', 'dental_assistant');
    const asset = {
      followUpId, implantId,
      followUpDate,
      followUpType,  // 1-week | 1-month | 3-month | 6-month | annual
      outcome,       // healing | osseointegrated | failed | monitoring
      notes,
      recordedBy: this._getCallerInfo(ctx).userId,
      recordedAt: timestamp,
    };
    return JSON.stringify(await this._putAsset(ctx, `FOLLOWUP_${followUpId}`, asset));
  }

  // ── History queries ───────────────────────────────────────────
  async getImplantHistory(ctx, implantId) {
    return this._getHistory(ctx, `IMPLANT_${implantId}`);
  }

  async getDeviceHistory(ctx, udiDI) {
    return this._getHistory(ctx, `DEVICE_${udiDI}`);
  }

  // ── Version ───────────────────────────────────────────────────
  async getVersion(ctx) {
    return this.VERSION || '1.0';
  }

  // ── Shared queries (same as ImplantContract) ──────────────────
  async getAllDevices(ctx) {
    return JSON.stringify(await this._getAllByRange(ctx, 'DEVICE_', 'DEVICE_~'));
  }

  async getDevice(ctx, udiDI) {
    return JSON.stringify(await this._getAsset(ctx, `DEVICE_${udiDI}`));
  }

  async getAllClearances(ctx) {
    return JSON.stringify(await this._getAllByRange(ctx, 'CLEARANCE_', 'CLEARANCE_~'));
  }

  async getAllISO13485(ctx) {
    return JSON.stringify(await this._getAllByRange(ctx, 'ISO_', 'ISO_~'));
  }

  async getAllLots(ctx) {
    return JSON.stringify(await this._getAllByRange(ctx, 'LOT_', 'LOT_~'));
  }

  async getAllConsignments(ctx) {
    return JSON.stringify(await this._getAllByRange(ctx, 'CONSIGNMENT_', 'CONSIGNMENT_~'));
  }

  async getConsignmentsByHospital(ctx, practiceId) {
    const all = await this._getAllByRange(ctx, 'CONSIGNMENT_', 'CONSIGNMENT_~');
    return JSON.stringify(all.filter(c => c.hospitalId === practiceId));
  }

  async getConsignmentsByRep(ctx, repId) {
    const all = await this._getAllByRange(ctx, 'CONSIGNMENT_', 'CONSIGNMENT_~');
    return JSON.stringify(all.filter(c => c.repId === repId));
  }

  async getAllImplants(ctx) {
    return JSON.stringify(await this._getAllByRange(ctx, 'IMPLANT_', 'IMPLANT_~'));
  }

  async getPatientsByLot(ctx, lotNumber) {
    const lots = await this._getAllByRange(ctx, 'LOT_', 'LOT_~');
    const matchingLotIds = new Set(
      lots.filter(l => l.lotNumber === lotNumber || l.lotId === lotNumber).map(l => l.lotId)
    );
    const consignments = await this._getAllByRange(ctx, 'CONSIGNMENT_', 'CONSIGNMENT_~');
    const matchingConsIds = new Set(
      consignments.filter(c => matchingLotIds.has(c.lotId)).map(c => c.consignmentId)
    );
    const all = await this._getAllByRange(ctx, 'IMPLANT_', 'IMPLANT_~');
    return JSON.stringify(all.filter(i =>
      (i.lotNumber === lotNumber || matchingConsIds.has(i.consignmentId)) &&
      i.status !== 'explanted'
    ));
  }

  async verifyDevice(ctx, udiDI) {
    const data = await ctx.stub.getState(`DEVICE_${udiDI}`);
    if (!data || data.length === 0) return JSON.stringify({ found: false, udiDI });
    const device = JSON.parse(data.toString());
    return JSON.stringify({ found: true, ...device });
  }

  async getStats(ctx) {
    const devices      = await this._getAllByRange(ctx, 'DEVICE_',      'DEVICE_~');
    const lots         = await this._getAllByRange(ctx, 'LOT_',         'LOT_~');
    const consignments = await this._getAllByRange(ctx, 'CONSIGNMENT_', 'CONSIGNMENT_~');
    const implants     = await this._getAllByRange(ctx, 'IMPLANT_',     'IMPLANT_~');
    return JSON.stringify({
      devices:            devices.length,
      activeLots:         lots.filter(l => l.status === 'active').length,
      quarantineLots:     lots.filter(l => l.status === 'quarantine').length,
      recalledLots:       lots.filter(l => l.status === 'recalled').length,
      activeConsignments: consignments.filter(c => c.status === 'active').length,
      activeImplants:     implants.filter(i => i.status === 'implanted').length,
      explants:           implants.filter(i => i.status === 'explanted').length,
    });
  }

  async getInventory(ctx) {
    return JSON.stringify(await this._getAllByRange(ctx, 'DEVICE_', 'DEVICE_~'));
  }

  // ── Shared lot/clearance/ISO functions ────────────────────────
  async issueClearance(ctx, clearanceNumber, udiDI, manufacturerId,
    clearanceType, indicationsForUse, clearanceDate, expiryDate, txTime) {
    this._checkRole(ctx, ['government']);
    const asset = {
      clearanceNumber, udiDI, manufacturerId, clearanceType,
      indicationsForUse, clearanceDate, expiryDate: expiryDate || null,
      status: 'active', issuedBy: this._getCallerInfo(ctx).userId, issuedAt: txTime,
    };
    await ctx.stub.putState(`CLEARANCE_${clearanceNumber}`, Buffer.from(JSON.stringify(asset)));
    return JSON.stringify(asset);
  }

  async uploadISO13485(ctx, certId, manufacturerId, facilityName, facilityAddress,
    scope, certBody, issueDate, expiryDate, txTime) {
    this._checkRole(ctx, ['manufacturer', 'admin']);
    const asset = {
      certId, manufacturerId, facilityName, facilityAddress,
      scope, certBody, issueDate, expiryDate,
      status: 'active', uploadedBy: this._getCallerInfo(ctx).userId, uploadedAt: txTime,
    };
    await ctx.stub.putState(`ISO_${certId}`, Buffer.from(JSON.stringify(asset)));
    return JSON.stringify(asset);
  }

  async createLot(ctx, lotId, udiDI, clearanceNumber, certId, lotNumber,
    manufacturingDate, expiryDate, sterileExpiryDate, quantity, storageConditions, txTime) {
    this._checkRole(ctx, ['manufacturer']);
    const qty = parseInt(quantity);
    const asset = {
      lotId, udiDI, clearanceNumber, certId, lotNumber,
      manufacturingDate, expiryDate, sterileExpiryDate: sterileExpiryDate || expiryDate,
      quantity: qty, remainingQuantity: qty,
      storageConditions: storageConditions || 'Store at room temperature',
      status: 'quarantine', manufacturerId: this._getCallerInfo(ctx).userId,
      createdAt: txTime,
    };
    await ctx.stub.putState(`LOT_${lotId}`, Buffer.from(JSON.stringify(asset)));
    return JSON.stringify(asset);
  }

  async releaseLot(ctx, lotId, qcNotes, txTime) {
    this._checkRole(ctx, ['manufacturer']);
    const lot = await this._getAsset(ctx, `LOT_${lotId}`);
    lot.status = 'active'; lot.qualityReleaseDate = txTime; lot.qcNotes = qcNotes || null;
    await ctx.stub.putState(`LOT_${lotId}`, Buffer.from(JSON.stringify(lot)));
    return JSON.stringify(lot);
  }

  async recallLot(ctx, lotId, recallClass, reason, affectedLotNumbers, txTime) {
    this._checkRole(ctx, ['government', 'manufacturer']);
    const lot = await this._getAsset(ctx, `LOT_${lotId}`);
    lot.status = 'recalled'; lot.recallClass = recallClass;
    lot.recallReason = reason; lot.recalledBy = this._getCallerInfo(ctx).userId;
    lot.recalledAt = txTime;
    await ctx.stub.putState(`LOT_${lotId}`, Buffer.from(JSON.stringify(lot)));
    ctx.stub.setEvent('LotRecalled', Buffer.from(JSON.stringify({ lotId, recallClass, reason })));
    return JSON.stringify(lot);
  }

  async createConsignment(ctx, consignmentId, lotId, hospitalId, quantity, location, txTime) {
    this._checkRole(ctx, ['distributor']);
    const lot = await this._getAsset(ctx, `LOT_${lotId}`);
    const qty = parseInt(quantity);
    lot.remainingQuantity -= qty;
    await ctx.stub.putState(`LOT_${lotId}`, Buffer.from(JSON.stringify(lot)));
    const asset = {
      consignmentId, lotId, udiDI: lot.udiDI,
      deviceName: lot.deviceName || '', lotNumber: lot.lotNumber,
      repId: this._getCallerInfo(ctx).userId, hospitalId,
      quantity: qty, usedQuantity: 0, openedNotUsed: 0, returnedQuantity: 0,
      location, expiryDate: lot.expiryDate,
      sterileExpiryDate: lot.sterileExpiryDate || lot.expiryDate,
      status: 'active', createdAt: txTime,
    };
    await ctx.stub.putState(`CONSIGNMENT_${consignmentId}`, Buffer.from(JSON.stringify(asset)));
    return JSON.stringify(asset);
  }

  async returnConsignment(ctx, consignmentId, quantity, reason, txTime) {
    const c = await this._getAsset(ctx, `CONSIGNMENT_${consignmentId}`);
    c.returnedQuantity += parseInt(quantity);
    await ctx.stub.putState(`CONSIGNMENT_${consignmentId}`, Buffer.from(JSON.stringify(c)));
    return JSON.stringify(c);
  }

  async recordRecallNotification(ctx, notificationId, lotNumber, implantId,
    patientIdHash, hospitalId, notificationMethod, notifiedBy, notes, txTime) {
    const asset = {
      notificationId, lotNumber, implantId, patientIdHash,
      hospitalId, notificationMethod, notifiedBy, notes,
      notifiedAt: txTime, status: 'notified',
    };
    await ctx.stub.putState(`RECALL_NOTIF_${notificationId}`, Buffer.from(JSON.stringify(asset)));
    return JSON.stringify(asset);
  }

}

module.exports = { contracts: [DentalContract] };
