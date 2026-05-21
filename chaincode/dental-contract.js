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
}

module.exports = { contracts: [DentalContract] };
