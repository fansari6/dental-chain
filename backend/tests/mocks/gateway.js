// __tests__/__mocks__/gateway.js
// Mock Hyperledger Fabric gateway for testing
// All chaincode responses are configurable via mockResponses

const mockStore = new Map();

// Default mock data
const defaults = {
  getStats:    { devices:24, clearances:21, lots:47, activeImplants:312 },
  getAllDevices:  [],
  getAllLots:     [],
  getAllClearances: [],
  getAllConsignments: [],
  getAllImplants: [],
  getAllAdverseEvents: [],
  getAllISO13485: [],
  getVersion:    '1.20',
};

export const mockResponses = new Map(Object.entries(defaults));

export function setMockResponse(fn, data) {
  mockResponses.set(fn, data);
}

export function resetMocks() {
  mockResponses.clear();
  Object.entries(defaults).forEach(([k,v]) => mockResponses.set(k,v));
}

export const submittedTransactions = [];

export async function submitTransaction(identityLabel, fcn, ...args) {
  submittedTransactions.push({ identityLabel, fcn, args, timestamp: new Date() });
  if (mockResponses.has(fcn)) {
    const r = mockResponses.get(fcn);
    return typeof r === 'function' ? r(...args) : r;
  }
  // Default: return a simple success object with the args baked in
  return { success: true, fcn, args };
}

export async function evaluateTransaction(identityLabel, fcn, ...args) {
  if (mockResponses.has(fcn)) {
    const r = mockResponses.get(fcn);
    return typeof r === 'function' ? r(...args) : r;
  }
  return { success: true, fcn, args };
}

export function parseFabricError(err) {
  return err?.message || String(err);
}
