// frontend/src/api/client.js
// Centralized API client for all ImplantChain backend calls.

// ─── Error parsing ────────────────────────────────────────────────
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

// ─── HTTP helper ──────────────────────────────────────────────────
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

// ─── API surface ──────────────────────────────────────────────────
export const api = {

  // ── Auth ─────────────────────────────────────────────────────────
  login:          (creds)   => request('POST', '/login',  creds),
  me:             ()        => request('GET',  '/me'),
  logout:         ()        => request('POST', '/logout'),
  changePassword: (payload) => request('POST', '/change-password', payload),

  // ── Admin — Users ─────────────────────────────────────────────────
  getUsers:       ()         => request('GET',  '/admin/users'),
  createUser:     (payload)  => request('POST', '/admin/users', payload),
  deactivateUser:     (username)            => request('POST', `/admin/users/${username}/deactivate`),
  updateUserFullName: (username, fullName)   => request('PUT',  `/admin/users/${username}/full-name`, { fullName }),
  updateDeviceModelNumber: (udiDI, modelNumber) => request('PUT', `/device/${encodeURIComponent(udiDI)}/model-number`, { modelNumber }),
  activateUser:   (username) => request('POST', `/admin/users/${username}/activate`),
  getRepVisits:       (params)      => request('GET',  '/rep-visits?' + new URLSearchParams(params||{}).toString()),
  createRepVisit:     (data)        => request('POST', '/rep-visits', data),
  updateRepVisitStatus:(visitId, status) => request('PUT', `/rep-visits/${visitId}/status`, { status }),

  getCases:          (params)     => request('GET',  '/cases?' + new URLSearchParams(params||{}).toString()),
  createCase:        (data)       => request('POST', '/cases', data),
  updateCaseStatus:  (caseId, status) => request('PUT',  `/cases/${caseId}/status`, { status }),
  linkImplantToCase: (caseId, implantId) => request('POST', `/cases/${caseId}/link-implant`, { implantId }),

  sendTestEmail:     (to)         => request('POST', '/admin/email/test', { to }),
  getEmailLog:       ()           => request('GET',  '/admin/email/log'),
  getEmailUsers:     ()           => request('GET',  '/admin/email/users'),
  setUserEmail:      (username, email) => request('PUT', `/admin/users/${username}/email`, { email }),

  getAnalytics:      (params)     => request('GET',  '/admin/analytics?' + new URLSearchParams(params||{}).toString()),
  getOnboarding:     ()           => request('GET',  '/admin/onboarding'),
  getAuditLog:       (params)  => request('GET',  '/admin/audit?' + new URLSearchParams(params||{}).toString()),
  getAuditActions:  ()         => request('GET',  '/admin/audit/actions'),

  // ── Users by role (for dropdowns) ────────────────────────────────
  getUsersByRole: (role) => request('GET', `/users-by-role/${role}`),

  // ── Stats & Inventory ────────────────────────────────────────────
  getChaincodeVersion:  () => request('GET', '/chaincode-version'),
  getExpiryAlerts:      () => request('GET', '/alerts/expiry'),
  bulkImport:          (records) => request('POST', '/bulk-import', { records }),
  getStats:     () => request('GET', '/assets/stats'),
  getInventory: () => request('GET', '/assets/inventory'),

  // ── Medical Devices ───────────────────────────────────────────────
  getDevices:       ()        => request('GET',  '/assets/devices'),
  getDevice:        (udiDI)   => request('GET',  `/device/${udiDI}`),
  getDeviceHistory: (udiDI)   => request('GET',  `/history/device/${udiDI}`),
  registerDevice:   (payload) => request('POST', '/device', payload),
  onboardDevice:    (payload) => request('POST', '/device/onboard', payload),

  // ── Regulatory Clearances ─────────────────────────────────────────
  getClearances:       ()                      => request('GET',  '/assets/clearances'),
  issueClearance:      (payload)               => request('POST', '/clearance', payload),
  revokeClearance:     (clearanceNumber, body) => request('POST', `/clearance/${clearanceNumber}/revoke`, body),
  getClearanceHistory: (num)                   => request('GET',  `/history/clearance/${num}`),

  // ── ISO 13485 Certificates ────────────────────────────────────────
  getISO13485:     ()             => request('GET',  '/assets/iso13485'),
  uploadISO13485:  (payload)      => request('POST', '/iso13485', payload),
  revokeISO13485:  (certId, body) => request('POST', `/iso13485/${certId}/revoke`, body),

  // ── Device Lots ───────────────────────────────────────────────────
  getLots:       ()             => request('GET',  '/assets/lots'),
  createLot:     (payload)      => request('POST', '/lot', payload),
  releaseLot:    (lotId, body)  => request('POST', `/lot/${lotId}/release`, body || {}),
  recallLot:     (lotId, body)  => request('POST', `/lot/${lotId}/recall`, body),
  flagBackorder: (lotId, body)  => request('POST', `/lot/${lotId}/backorder`, body),
  getLotHistory: (lotId)        => request('GET',  `/history/lot/${lotId}`),

  // ── Consignments ──────────────────────────────────────────────────
  getConsignments:       (params)              => request('GET',  `/assets/consignments${params ? '?' + new URLSearchParams(params) : ''}`),
  createConsignment:     (payload)             => request('POST', '/consignment', payload),
  returnConsignment:     (consignmentId, body) => request('POST', `/consignment/${consignmentId}/return`, body),
  openedNotImplanted:    (consignmentId, body) => request('POST', `/consignment/${consignmentId}/opened-not-implanted`, body),
  recallConsignment:     (consignmentId, body) => request('POST', `/consignment/${consignmentId}/recall`, body),
  getConsignmentHistory: (consignmentId)       => request('GET',  `/history/consignment/${consignmentId}`),

  // ── Implant Records ───────────────────────────────────────────────
  getImplantsByPatient:     (patientId)       => request('GET',  `/assets/implants?patientId=${encodeURIComponent(patientId)}`),
  getImplantsByPatientHash: (hash)            => request('GET',  `/assets/implants?patientIdHash=${encodeURIComponent(hash)}`),
  getAllImplants:            ()                => request('GET',  '/assets/implants/all'),
  getImplantsByHospital:    (hospitalId)      => request('GET',  `/assets/implants/by-hospital${hospitalId ? '?hospitalId=' + encodeURIComponent(hospitalId) : ''}`),
  getImplantsBySurgeon:     (surgeonId)       => request('GET',  `/assets/implants/by-surgeon${surgeonId ? '?surgeonId=' + encodeURIComponent(surgeonId) : ''}`),
  getImplantsByDevice:      (udiDI)           => request('GET',  `/assets/implants/by-device/${encodeURIComponent(udiDI)}`),
  recordImplant:            (payload)         => request('POST', '/implant', payload),
  recordExplant:            (implantId, body) => request('POST', `/implant/${implantId}/explant`, body),
  getImplantHistory:        (implantId)       => request('GET',  `/history/implant/${implantId}`),

  // ── Adverse Events (MDR) ──────────────────────────────────────────
  recordAdverseEvent:  (payload) => request('POST', '/adverse-event', payload),
  getAdverseEvents:    ()        => request('GET',  '/assets/adverse-events'),

  // ── Recall & Infection Prevention ────────────────────────────────
  getPatientsByLot:             (lotNumber) => request('GET', `/recall/patients-by-lot/${encodeURIComponent(lotNumber)}`),
  getActiveImplantsByRecalledLot:(lotNumber) => request('GET', `/recall/active-implants-by-lot/${encodeURIComponent(lotNumber)}`),

  // ── Admin — Organizations ─────────────────────────────────────────
  getOrganizations:   ()            => request('GET',    '/admin/organizations'),
  createOrganization: (payload)     => request('POST',   '/admin/organizations', payload),
  updateOrganization: (id, payload) => request('PUT',    `/admin/organizations/${id}`, payload),
  deleteOrganization: (id)          => request('DELETE', `/admin/organizations/${id}`),

  // ── Admin — Hospitals ─────────────────────────────────────────────
  getHospitals:   ()            => request('GET',    '/admin/hospitals'),
  createHospital: (payload)     => request('POST',   '/admin/hospitals', payload),
  updateHospital: (id, payload) => request('PUT',    `/admin/hospitals/${id}`, payload),
  deleteHospital: (id)          => request('DELETE', `/admin/hospitals/${id}`),

  // ── Admin — Surgeons ──────────────────────────────────────────────
  getSurgeons:   (hospitalId)   => request('GET',    `/admin/surgeons${hospitalId ? '?hospitalId=' + encodeURIComponent(hospitalId) : ''}`),
  createSurgeon: (payload)      => request('POST',   '/admin/surgeons', payload),
  updateSurgeon: (id, payload)  => request('PUT',    `/admin/surgeons/${id}`, payload),
  deleteSurgeon: (id)           => request('DELETE', `/admin/surgeons/${id}`),

  // ── Admin — Lookup Values ─────────────────────────────────────────
  getLookupValues:  (category) => request('GET',    `/admin/lookup${category ? '?category=' + encodeURIComponent(category) : ''}`),
  createLookupValue:(payload)  => request('POST',   '/admin/lookup', payload),
  deleteLookupValue:(id)       => request('DELETE', `/admin/lookup/${id}`),

  // ── Device Submissions (manufacturer → FDA approval) ─────────────
  submitDevice:           (payload)     => request('POST', '/device-submissions', payload),
  getDeviceSubmissions:   (status)      => request('GET',  `/device-submissions${status ? '?status=' + status : ''}`),
  reviewDeviceSubmission: (id, payload) => request('POST', `/device-submissions/${id}/review`, payload),

  // ── Brownfield Onboarding Requests ───────────────────────────────
  createOnboardingRequest: (payload)     => request('POST', '/onboarding-requests', payload),
  getOnboardingRequests:   (status)      => request('GET',  `/onboarding-requests${status ? '?status=' + status : ''}`),
  reviewOnboardingRequest: (id, payload) => request('POST', `/onboarding-requests/${id}/review`, payload),

  // ── ISO Cert Uploads ──────────────────────────────────────────────
  createIsoCertUpload: (payload)     => request('POST', '/iso-cert-uploads', payload),
  getIsoCertUploads:   (mfrId)       => request('GET',  `/iso-cert-uploads${mfrId ? '?manufacturerId=' + encodeURIComponent(mfrId) : ''}`),
  markIsoCertOnChain:  (id, payload) => request('POST', `/iso-cert-uploads/${id}/mark-on-chain`, payload),

  // ── Consignment Transfer ─────────────────────────────────────────
  transferConsignment: (consignmentId, body) => request('POST', `/consignment/${consignmentId}/transfer`, body),

  // ── AI Proxy ──────────────────────────────────────────────────────
  // Calls backend proxy which forwards to Anthropic — keeps API key server-side
  aiComplete: (prompt, maxTokens) => request('POST', '/ai/complete', { prompt, maxTokens: maxTokens || 1000 }),

  // ── Rep Hospital Assignments ──────────────────────────────────────
  // Admin assigns which hospitals a rep can serve — enforced on consignment creation
  getRepHospitals:  (username)            => request('GET', `/admin/rep-hospitals/${username}`),
  setRepHospitals:  (username, hospitals) => request('PUT', `/admin/rep-hospitals/${username}`, { hospitals }),

  getUDICompliance:  ()           => request('GET',  '/reports/udi-compliance'),
  getMDRDeadlines:   ()           => request('GET',  '/alerts/mdr-deadlines'),

  // ── Recall Notifications ─────────────────────────────────────────────
  recordRecallNotification: (payload)    => request('POST', '/recall/notification', payload),
  bulkRecallNotification:   (payload)    => request('POST', '/recall/notifications/bulk', payload),
  getRecallNotifications:   (lotNumber)  => request('GET',  `/recall/notifications/${encodeURIComponent(lotNumber)}`),

  // ── Public Verification (no auth required) ────────────────────────
  verifyDevice: (udiDI) => request('GET', `/verify/device/${encodeURIComponent(udiDI)}`),
  verifyLot:    (lotId) => request('GET', `/verify/lot/${encodeURIComponent(lotId)}`),
};
