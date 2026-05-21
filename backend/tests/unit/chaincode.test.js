// tests/unit/chaincode.test.js
// Unit tests for ImplantChain chaincode using a lightweight stub mock

// ── ChaincodeStub mock ────────────────────────────────────────────────────
class MockStub {
  constructor() {
    this._state   = new Map();
    this._history = new Map();
    this.txId     = 'mock-tx-' + Date.now();
    this.mspId    = 'Org1MSP';
  }
  async putState(key, value) {
    const buf = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
    this._state.set(key, buf);
    if (!this._history.has(key)) this._history.set(key, []);
    this._history.get(key).push({ value: buf, timestamp: { seconds: { low: Math.floor(Date.now()/1000) } } });
  }
  async getState(key) { return this._state.get(key) || null; }
  async deleteState(key) { this._state.delete(key); }
  async getStateByRange(start, end) {
    const results = [];
    for (const [key, value] of this._state)
      if (key >= start && (end === '' || key < end)) results.push({ key, value });
    let i = 0;
    return { async next() { if(i<results.length) return {value:results[i++],done:false}; return {done:true}; }, async close(){} };
  }
  async getHistoryForKey(key) {
    const hist = this._history.get(key) || [];
    let i = 0;
    return { async next() { if(i<hist.length) return {value:hist[i++],done:false}; return {done:true}; }, async close(){} };
  }
  setEvent(name, payload) { /* no-op */ }
  getTxID()        { return this.txId; }
  getMspID()       { return this.mspId; }
  setMspId(id)     { this.mspId = id; return this; }
  getTxTimestamp() { return { seconds: { low: Math.floor(Date.now()/1000) }, nanos: 0 }; }
  getCreator()     { return { mspid: this.mspId, idBytes: Buffer.from('mock-cert') }; }
}

function makeCtx(stub, role = 'admin') {
  return {
    stub,
    clientIdentity: {
      getMSPID: ()           => stub.mspId,
      getAttributeValue: (a) => ({ role, 'hf.EnrollmentID':'test-user', 'hf.Type':'client' }[a] || null),
      assertAttributeValue:  () => true,
      getID:                 () => 'test-user',
      getIDBytes:            () => Buffer.from('mock-cert'),
    },
  };
}

// ── Parse helper (chaincode returns JSON strings) ─────────────────────────
const parse = (v) => {
  if (typeof v === 'string') return JSON.parse(v);
  if (Buffer.isBuffer(v))    return JSON.parse(v.toString());
  return v;
};

// ── Import chaincode ──────────────────────────────────────────────────────
const { contracts } = await import('../../../chaincode/implant-contract.js');
const ImplantContract = contracts[0];
const contract = new ImplantContract();
const now = () => new Date().toISOString();

// ── Shared setup helpers ──────────────────────────────────────────────────
async function setupDevice(stub, udiDI = '(01)00001') {
  await contract.registerDevice(makeCtx(stub, 'government'),
    udiDI, 'Test Device', 'test-user', 'orthopedic', 'joint',
    'false', 'true', 'false', 'conditional', 'Left Knee,Right Knee', '', now()
  );
}

async function setupClearance(stub, udiDI = '(01)00001', clearanceNum = 'K001', certId = 'ISO-001') {
  await setupDevice(stub, udiDI);
  await contract.issueClearance(makeCtx(stub, 'government'),
    clearanceNum, udiDI, 'test-user', '510k', 'Knee replacement', '2024-01-01', '2029-01-01', now()
  );
  // Upload ISO cert so createLot can find it
  await contract.uploadISO13485(makeCtx(stub, 'manufacturer'),
    certId, 'test-user', 'Test Facility', 'Test Address',
    'Medical devices', 'BSI Group', '2023-01-01', '2028-01-01', now()
  );
}

async function setupLot(stub, lotId = 'LOT-001', udiDI = '(01)00001') {
  await setupClearance(stub, udiDI, 'K001');
  await contract.createLot(makeCtx(stub, 'manufacturer'),
    lotId, udiDI, 'K001', 'ISO-001', 'L-2024-001',
    '2024-01-01', '2027-01-01', '', '100', 'Store at room temperature', now()
  );
  await contract.releaseLot(makeCtx(stub, 'manufacturer'), lotId, 'QC passed', now());
}

async function setupConsignment(stub, consId = 'CONS-001', lotId = 'LOT-001') {
  await setupLot(stub, lotId);
  await contract.createConsignment(makeCtx(stub, 'distributor'),
    consId, lotId, 'Memorial Hospital', '20', 'OR Suite B', now()
  );
}

async function setupImplant(stub, implantId = 'IMPL-001', consId = 'CONS-001') {
  await setupConsignment(stub, consId);
  await contract.recordImplant(makeCtx(stub, 'nurse'),
    implantId, consId, '', 'L-2024-001', 'SER001',
    'MRN-123', 'hash123', 'DR-TEST',
    'Total Knee Arthroplasty', 'Left Knee', '2026-05-18', 'Notes', now()
  );
}

// ─────────────────────────────────────────────────────────────────────────
// VERSION
// ─────────────────────────────────────────────────────────────────────────
describe('getVersion', () => {
  test('returns a non-empty version string', async () => {
    const stub = new MockStub();
    const v = await contract.getVersion(makeCtx(stub));
    expect(String(v).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// DEVICE REGISTRATION
// ─────────────────────────────────────────────────────────────────────────
describe('registerDevice / onboardDevice', () => {
  test('registerDevice stores device and returns it', async () => {
    const stub = new MockStub();
    const result = await contract.registerDevice(makeCtx(stub, 'government'),
      '(01)00001', 'Test Knee', 'stryker', 'orthopedic', 'joint',
      'false', 'true', 'false', 'conditional', 'Left Knee,Right Knee', '', now()
    );
    const device = parse(result);
    expect(device.udiDI).toBe('(01)00001');
    expect(device.deviceName).toBe('Test Knee');
    expect(device.mriSafe).toBe('conditional');
  });

  test('onboardDevice stores device with gudidVerified flag', async () => {
    const stub = new MockStub();
    const result = await contract.onboardDevice(makeCtx(stub, 'government'),
      '(01)00002', 'Test Pacemaker', 'medtronic', 'cardiac', 'pacemaker',
      'true', 'true', 'false', 'unsafe', 'Left Ventricle', 'true', 'Model-X', now()
    );
    const device = parse(result);
    expect(device.gudidVerified).toBe(true);
    expect(device.mriSafe).toBe('unsafe');
    expect(device.modelNumber).toBe('Model-X');
  });

  test('getDevice retrieves registered device', async () => {
    const stub = new MockStub();
    await contract.registerDevice(makeCtx(stub, 'government'),
      '(01)00003', 'Device Three', 'mfr', 'general_surgery', 'mesh',
      'false', 'true', 'false', 'safe', 'Abdomen', '', now()
    );
    const result  = await contract.getDevice(makeCtx(stub), '(01)00003');
    const device  = parse(result);
    expect(device.deviceName).toBe('Device Three');
  });

  test('registerDevice throws if device already exists', async () => {
    const stub = new MockStub();
    await contract.registerDevice(makeCtx(stub, 'government'),
      '(01)DUP', 'Dup Device', 'mfr', 'orthopedic', 'joint',
      'false', 'true', 'false', 'conditional', '', '', now()
    );
    await expect(contract.registerDevice(makeCtx(stub, 'government'),
      '(01)DUP', 'Dup 2', 'mfr', 'orthopedic', 'joint',
      'false', 'true', 'false', 'conditional', '', '', now()
    )).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// CLEARANCES
// ─────────────────────────────────────────────────────────────────────────
describe('issueClearance / revokeClearance', () => {
  test('issueClearance stores clearance with status active', async () => {
    const stub = new MockStub();
    await setupDevice(stub);
    const result = await contract.issueClearance(makeCtx(stub, 'government'),
      'K001', '(01)00001', 'stryker', '510k', 'Total knee replacement',
      '2024-01-01', '2029-01-01', now()
    );
    const clr = parse(result);
    expect(clr.clearanceNumber).toBe('K001');
    expect(clr.status).toBe('active');
    expect(clr.clearanceType).toBe('510k');
  });

  test('revokeClearance sets status to revoked', async () => {
    const stub = new MockStub();
    await setupDevice(stub);
    await contract.issueClearance(makeCtx(stub, 'government'),
      'K002', '(01)00001', 'stryker', 'PMA', '', '2024-01-01', '2029-01-01', now()
    );
    const result  = await contract.revokeClearance(makeCtx(stub, 'government'), 'K002', 'Safety concern', now());
    const revoked = parse(result);
    expect(revoked.status).toBe('revoked');
    expect(revoked.revokeReason).toBe('Safety concern');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// LOTS
// ─────────────────────────────────────────────────────────────────────────
describe('createLot / releaseLot / recallLot', () => {
  test('createLot creates lot in quarantine status', async () => {
    const stub = new MockStub();
    await setupClearance(stub);
    const result = await contract.createLot(makeCtx(stub, 'manufacturer'),
      'LOT-001', '(01)00001', 'K001', 'ISO-001', 'L-2024-001',
      '2024-01-01', '2027-01-01', '', '100', 'Store at room temperature', now()
    );
    const lot = parse(result);
    expect(lot.lotId).toBe('LOT-001');
    expect(lot.status).toBe('quarantine');
    expect(lot.quantity).toBe(100);
    expect(lot.remainingQuantity).toBe(100);
  });

  test('releaseLot transitions quarantine → active', async () => {
    const stub = new MockStub();
    await setupClearance(stub);
    await contract.createLot(makeCtx(stub, 'manufacturer'),
      'LOT-002', '(01)00001', 'K001', 'ISO-001', 'L-002',
      '2024-01-01', '2027-01-01', '', '50', '', now()
    );
    const result   = await contract.releaseLot(makeCtx(stub, 'manufacturer'), 'LOT-002', 'All QC tests passed', now());
    const released = parse(result);
    expect(released.status).toBe('active');
    expect(released.qcNotes).toBe('All QC tests passed');
  });

  test('releaseLot throws if lot is not in quarantine', async () => {
    const stub = new MockStub();
    await setupClearance(stub);
    await contract.createLot(makeCtx(stub, 'manufacturer'),
      'LOT-003', '(01)00001', 'K001', 'ISO-001', 'L-003',
      '2024-01-01', '2027-01-01', '', '50', '', now()
    );
    await contract.releaseLot(makeCtx(stub, 'manufacturer'), 'LOT-003', '', now());
    await expect(contract.releaseLot(makeCtx(stub, 'manufacturer'), 'LOT-003', '', now()))
      .rejects.toThrow();
  });

  test('recallLot sets status to recalled', async () => {
    const stub = new MockStub();
    await setupClearance(stub);
    await contract.createLot(makeCtx(stub, 'manufacturer'),
      'LOT-004', '(01)00001', 'K001', 'ISO-001', 'L-004',
      '2024-01-01', '2027-01-01', '', '50', '', now()
    );
    await contract.releaseLot(makeCtx(stub, 'manufacturer'), 'LOT-004', '', now());
    const result   = await contract.recallLot(makeCtx(stub, 'government'), 'LOT-004', 'II', 'Fracture risk', '', now());
    const recalled = parse(result);
    expect(recalled.status).toBe('recalled');
    expect(recalled.recallClass).toBe('II');
    expect(recalled.recallReason).toBe('Fracture risk');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// CONSIGNMENTS
// ─────────────────────────────────────────────────────────────────────────
describe('createConsignment / returnConsignment / recallConsignment', () => {
  test('createConsignment creates active consignment', async () => {
    const stub = new MockStub();
    await setupLot(stub, 'LOT-C1');
    const result = await contract.createConsignment(makeCtx(stub, 'distributor'),
      'CONS-001', 'LOT-C1', 'Memorial Hospital', '20', 'OR Suite B - Tray 1', now()
    );
    const cons = parse(result);
    expect(cons.consignmentId).toBe('CONS-001');
    expect(cons.status).toBe('active');
    expect(cons.quantity).toBe(20);
    expect(cons.usedQuantity).toBe(0);
  });

  test('returnConsignment decrements quantity', async () => {
    const stub = new MockStub();
    await setupLot(stub, 'LOT-C2');
    await contract.createConsignment(makeCtx(stub, 'distributor'),
      'CONS-002', 'LOT-C2', 'Memorial Hospital', '20', 'OR-1', now()
    );
    const result   = await contract.returnConsignment(makeCtx(stub, 'supply_chain'),
      'CONS-002', '5', 'Procedure cancelled', now()
    );
    const returned = parse(result);
    expect(returned.returnedQuantity).toBeGreaterThanOrEqual(5);
  });

  test('recallConsignment sets status to recalled', async () => {
    const stub = new MockStub();
    await setupLot(stub, 'LOT-C3');
    await contract.createConsignment(makeCtx(stub, 'distributor'),
      'CONS-003', 'LOT-C3', 'Memorial Hospital', '10', 'OR-2', now()
    );
    const result   = await contract.recallConsignment(makeCtx(stub, 'government'),
      'CONS-003', 'Lot recalled by FDA', now()
    );
    const recalled = parse(result);
    expect(recalled.status).toBe('recalled');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// IMPLANT RECORDS
// ─────────────────────────────────────────────────────────────────────────
describe('recordImplant / recordExplant', () => {
  test('recordImplant creates implant with status implanted', async () => {
    const stub = new MockStub();
    await setupConsignment(stub, 'CONS-I1', 'LOT-I1');
    const result  = await contract.recordImplant(makeCtx(stub, 'nurse'),
      'IMPL-001', 'CONS-I1', '', 'L-2024-001', 'SER001',
      'MRN-123', 'hash-mrn-123', 'DR-JOHNSON',
      'Total Knee Arthroplasty', 'Left Knee', '2026-05-18', 'Procedure uneventful', now()
    );
    const implant = parse(result);
    expect(implant.implantId).toBe('IMPL-001');
    expect(implant.status).toBe('implanted');
    expect(implant.patientId).toBe('MRN-123');
    expect(implant.bodyLocation).toBe('Left Knee');
  });

  test('recordExplant transitions implant to explanted status', async () => {
    const stub = new MockStub();
    await setupConsignment(stub, 'CONS-I2', 'LOT-I2');
    await contract.recordImplant(makeCtx(stub, 'nurse'),
      'IMPL-002', 'CONS-I2', '', 'L-2024-001', '', 'MRN-456', 'hash456',
      'DR-JOHNSON', 'Total Knee', 'Right Knee', '2026-05-18', '', now()
    );
    const result    = await contract.recordExplant(makeCtx(stub, 'nurse'),
      'IMPL-002', 'Infection', '2026-06-01', 'Sent to lab for analysis', 'DR-JOHNSON', now()
    );
    const explanted = parse(result);
    expect(explanted.status).toBe('explanted');
    expect(explanted.explantReason).toBe('Infection');
    expect(explanted.disposition).toBe('Sent to lab for analysis');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// RECALL NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────
describe('recordRecallNotification', () => {
  test('stores notification with all required fields', async () => {
    const stub = new MockStub();
    await setupImplant(stub, 'IMPL-AFFECTED', 'CONS-NOTIF');
    const result = await contract.recordRecallNotification(
      makeCtx(stub, 'infection_prevention'),
      'NOTIF-001', 'LOT-001', 'IMPL-AFFECTED', 'hash-patient',
      'Memorial Hospital', 'phone', 'patricia-moore', 'Patient contacted', now()
    );
    const notif = parse(result);
    expect(notif.notificationId).toBe('NOTIF-001');
    expect(notif.lotNumber).toBe('LOT-001');
    expect(notif.notificationMethod).toBe('phone');
    expect(notif.notifiedBy).toBe('patricia-moore');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// ADVERSE EVENTS
// ─────────────────────────────────────────────────────────────────────────
describe('recordAdverseEvent', () => {
  test('stores adverse event with correct fields', async () => {
    const stub = new MockStub();
    await setupImplant(stub, 'IMPL-AE', 'CONS-AE');
    const result = await contract.recordAdverseEvent(makeCtx(stub, 'nurse'),
      'AE-001', 'IMPL-AE', 'malfunction', '2026-05-18',
      'Device showed signs of failure', 'false', 'Memorial Hospital', now()
    );
    const ae = parse(result);
    expect(ae.eventId).toBe('AE-001');
    expect(ae.eventType).toBe('malfunction');
    expect(ae.reportedToFDA).toBe(false);
    expect(ae.hospitalId).toBe('Memorial Hospital');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// HISTORY QUERIES
// ─────────────────────────────────────────────────────────────────────────
describe('History queries', () => {
  test('getDeviceHistory returns history for a registered device', async () => {
    const stub = new MockStub();
    await contract.registerDevice(makeCtx(stub, 'government'),
      '(01)HIST', 'History Device', 'mfr', 'orthopedic', 'joint',
      'false', 'true', 'false', 'safe', '', '', now()
    );
    const result  = await contract.getDeviceHistory(makeCtx(stub), '(01)HIST');
    const history = parse(result);
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);
  });

  test('getLotHistory returns history for a lot', async () => {
    const stub = new MockStub();
    await setupClearance(stub, '(01)HIST2', 'K-HIST');
    await contract.createLot(makeCtx(stub, 'manufacturer'),
      'LOT-HIST', '(01)HIST2', 'K-HIST', 'ISO-001', 'LH',
      '2024-01-01', '2027-01-01', '', '10', '', now()
    );
    await contract.releaseLot(makeCtx(stub, 'manufacturer'), 'LOT-HIST', 'QC OK', now());
    const result  = await contract.getLotHistory(makeCtx(stub), 'LOT-HIST');
    const history = parse(result);
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThanOrEqual(2);
  });
});
