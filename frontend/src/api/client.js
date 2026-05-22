// DentalChain API Client
// All calls go through Vite proxy → backend port 4001

function cleanError(message) {
  if (!message) return 'An unexpected error occurred';
  const cc     = message.match(/chaincode response \d+,\s*(.+?)(?:\s*$)/);
  if (cc) return cc[1].trim();
  const nested = message.match(/error="chaincode response \d+,\s*(.+?)"/);
  if (nested) return nested[1].trim();
  const quoted = message.match(/error="([^"]+)"/);
  if (quoted) return cleanError(quoted[1]);
  const aborted = message.match(/\d*\s*ABORTED:\s*(.+)/);
  if (aborted) return cleanError(aborted[1]);
  return message;
}

async function request(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body:    body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(cleanError(data.error || `HTTP ${res.status}`));
  return data;
}

export const api = {

  // ── Auth ──────────────────────────────────────────────────────────
  login:   (creds) => request('POST', '/login',  creds),
  me:      ()      => request('GET',  '/me'),
  logout:  ()      => request('POST', '/logout'),

  // ── Admin — Users ─────────────────────────────────────────────────
  getUsers:       ()                        => request('GET',  '/admin/users'),
  createUser:     (payload)                 => request('POST', '/admin/users', payload),
  setUserActive:  (username, isActive)      => request('PUT',  `/admin/users/${username}/active`, { isActive }),
  setUserEmail:   (username, email)         => request('PUT',  `/admin/users/${username}/email`, { email }),
  getUsersByRole: (role)                    => request('GET',  `/users-by-role/${role}`),

  // ── Admin — Practices ─────────────────────────────────────────────
  getPractices:   ()            => request('GET',    '/admin/practices'),
  createPractice: (payload)     => request('POST',   '/admin/practices', payload),
  updatePractice: (id, payload) => request('PUT',    `/admin/practices/${id}`, payload),
  deletePractice: (id)          => request('DELETE', `/admin/practices/${id}`),

  // ── Admin — DSO Groups ────────────────────────────────────────────
  getDsoGroups:   ()        => request('GET',  '/admin/dso-groups'),
  createDsoGroup: (payload) => request('POST', '/admin/dso-groups', payload),

  // ── Admin — Dentists ──────────────────────────────────────────────
  getDentists:      (practiceId) => request('GET',    `/admin/dentists${practiceId ? '?practiceId=' + practiceId : ''}`),
  createDentist:    (payload)    => request('POST',   '/admin/dentists', payload),
  updateDentist:    (id, payload)=> request('PUT',    `/admin/dentists/${id}`, payload),
  setDentistActive: (id, isActive)=> request('PUT',   `/admin/dentists/${id}/active`, { isActive }),

  // ── Admin — Rep Practice Assignments ─────────────────────────────
  getRepPractices: (username)           => request('GET', `/admin/rep-practices/${username}`),
  setRepPractices: (username, practices)=> request('POST','/admin/rep-practices', { repUsername: username, practices }),

  // ── Admin — Analytics / Audit / Onboarding ───────────────────────
  getAnalytics:  (params) => request('GET', '/admin/analytics?' + new URLSearchParams(params||{}).toString()),
  getOnboarding: ()       => request('GET', '/admin/onboarding'),
  getAuditLog:   (params) => request('GET', '/admin/audit?' + new URLSearchParams(params||{}).toString()),
  getAuditActions: ()     => request('GET', '/admin/audit/actions'),
  getEmailLog:   ()       => request('GET', '/admin/email/log'),

  // ── Stats ─────────────────────────────────────────────────────────
  getStats:        () => request('GET', '/assets/stats'),
  getExpiryAlerts: () => request('GET', '/alerts/expiry'),
  getUDICompliance:() => request('GET', '/reports/udi-compliance'),
  getMDRDeadlines: () => request('GET', '/alerts/mdr-deadlines'),

  // ── Devices ───────────────────────────────────────────────────────
  getDevices:      ()        => request('GET',  '/assets/devices'),
  getDevice:       (udiDI)   => request('GET',  `/device/${encodeURIComponent(udiDI)}`),
  registerDevice:  (payload) => request('POST', '/device', payload),
  getDeviceHistory:(udiDI)   => request('GET',  `/history/device/${encodeURIComponent(udiDI)}`),

  // ── Clearances ────────────────────────────────────────────────────
  getClearances:   ()                      => request('GET',  '/assets/clearances'),
  issueClearance:  (payload)               => request('POST', '/clearance', payload),
  revokeClearance: (num, body)             => request('POST', `/clearance/${num}/revoke`, body),

  // ── ISO 13485 ─────────────────────────────────────────────────────
  getISO13485:    ()        => request('GET',  '/assets/iso13485'),
  uploadISO13485: (payload) => request('POST', '/iso13485', payload),

  // ── Lots ──────────────────────────────────────────────────────────
  getLots:      ()             => request('GET',  '/assets/lots'),
  createLot:    (payload)      => request('POST', '/lot', payload),
  releaseLot:   (lotId, body)  => request('POST', `/lot/${lotId}/release`, body || {}),
  recallLot:    (lotId, body)  => request('POST', `/lot/${lotId}/recall`, body),
  getLotHistory:(lotId)        => request('GET',  `/history/lot/${lotId}`),

  // ── Consignments ──────────────────────────────────────────────────
  getConsignments:   (params)              => request('GET',  `/assets/consignments${params ? '?' + new URLSearchParams(params) : ''}`),
  createConsignment: (payload)             => request('POST', '/consignment', payload),
  returnConsignment: (consignmentId, body) => request('POST', `/consignment/${consignmentId}/return`, body),

  // ── 3-Stage Implant Recording ─────────────────────────────────────
  recordImplantPost: (payload)              => request('POST', '/implant/post', payload),
  recordAbutment:    (implantId, payload)   => request('POST', `/implant/${implantId}/abutment`, payload),
  recordCrown:       (implantId, payload)   => request('POST', `/implant/${implantId}/crown`, payload),
  getImplants:       ()                     => request('GET',  '/assets/implants'),
  getImplantHistory: (implantId)            => request('GET',  `/history/implant/${implantId}`),

  // ── Lab Work ──────────────────────────────────────────────────────
  getLabWork:        (params)              => request('GET',  '/lab-work?' + new URLSearchParams(params||{}).toString()),
  createLabWork:     (payload)             => request('POST', '/lab-work', payload),
  updateLabWorkStatus:(labWorkId, payload) => request('PUT',  `/lab-work/${labWorkId}/status`, payload),

  // ── Follow-ups ────────────────────────────────────────────────────
  getFollowUps:       (params)              => request('GET',  '/follow-ups?' + new URLSearchParams(params||{}).toString()),
  createFollowUp:     (payload)             => request('POST', '/follow-up', payload),
  updateFollowUpStatus:(followUpId, payload)=> request('PUT',  `/follow-up/${followUpId}/status`, payload),

  // ── Treatment Cases ───────────────────────────────────────────────
  getCases:          (params)             => request('GET',  '/cases?' + new URLSearchParams(params||{}).toString()),
  createCase:        (payload)            => request('POST', '/cases', payload),
  updateCaseStatus:  (caseId, status)     => request('PUT',  `/cases/${caseId}/status`, { status }),
  updateCasePhase:   (caseId, phase)      => request('PUT',  `/cases/${caseId}/phase`, { phase }),
  linkImplantToCase: (caseId, implantId)  => request('POST', `/cases/${caseId}/link-implant`, { implantId }),

  // ── Recall ────────────────────────────────────────────────────────
  getPatientsByLot:         (lotNumber) => request('GET',  `/recall/patients-by-lot/${encodeURIComponent(lotNumber)}`),
  recordRecallNotification: (payload)   => request('POST', '/recall/notification', payload),

  // ── Rep Visits ────────────────────────────────────────────────────
  getRepVisits:        (params)           => request('GET',  '/rep-visits?' + new URLSearchParams(params||{}).toString()),
  createRepVisit:      (payload)          => request('POST', '/rep-visits', payload),
  updateRepVisitStatus:(visitId, status)  => request('PUT',  `/rep-visits/${visitId}/status`, { status }),

  // ── Practices (public routes) ─────────────────────────────────────
  getPracticesList: () => request('GET', '/practices'),
  getDentistsList:  (params) => request('GET', '/dentists?' + new URLSearchParams(params||{}).toString()),
  getLookupValues:  (category) => request('GET', `/lookup/${category}`),

  // ── Public Verification ───────────────────────────────────────────
  verifyDevice: (udiDI) => request('GET', `/verify/device/${encodeURIComponent(udiDI)}`),

  getChaincodeVersion: () => request('GET', '/chaincode-version'),
};
