// backend/services/email.js
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const FROM = process.env.EMAIL_FROM || 'noreply@implantchain.dapparchitects.com';
const APP_URL = process.env.APP_URL || 'https://implantchain.dapparchitects.com';

// ── Core send function ──────────────────────────────────────────
export async function sendEmail({ to, subject, html, text }) {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('[Email] SENDGRID_API_KEY not set — skipping email to', to);
    return { skipped: true };
  }
  if (!to || (Array.isArray(to) && to.length === 0)) return { skipped: true };
  try {
    await sgMail.send({ from: FROM, to, subject, html, text: text || subject });
    console.log('[Email] Sent:', subject, '→', Array.isArray(to) ? to.join(', ') : to);
    return { sent: true };
  } catch (err) {
    console.error('[Email] Failed:', err.message, err.response?.body?.errors);
    throw err;
  }
}

// ── Email log helper (uses pool passed in) ─────────────────────
export async function logEmail(pool, { recipients, subject, type, triggeredBy, details }) {
  try {
    await pool.query(
      `INSERT INTO email_log (recipients, subject, type, triggered_by, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [recipients.join(','), subject, type, triggeredBy, JSON.stringify(details||{})]
    );
  } catch(e) { console.warn('[Email] Log failed:', e.message); }
}

// ── HTML wrapper ────────────────────────────────────────────────
function wrap(title, body) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f4f5;margin:0;padding:24px}
  .container{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)}
  .header{background:#1a1a2e;padding:24px 32px;display:flex;align-items:center;gap:12px}
  .logo{color:#ff8000;font-size:22px;font-weight:800;letter-spacing:1px}
  .logo span{color:transparent;-webkit-text-stroke:1.5px #ff8000}
  .body{padding:32px}
  .title{font-size:20px;font-weight:700;color:#1a1a2e;margin-bottom:16px}
  .field{margin-bottom:12px}
  .field-label{font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#999;margin-bottom:3px}
  .field-value{font-size:14px;color:#1a1a2e;font-weight:500}
  .field-value.mono{font-family:monospace;font-size:13px}
  .alert-box{padding:16px 20px;border-radius:6px;margin:20px 0;font-size:14px;line-height:1.6}
  .alert-red{background:#fee2e2;border-left:4px solid #ef4444;color:#991b1b}
  .alert-amber{background:#fef9c3;border-left:4px solid #f59e0b;color:#854d0e}
  .alert-blue{background:#dbeafe;border-left:4px solid #3b82f6;color:#1e40af}
  .btn{display:inline-block;padding:12px 24px;background:#ff8000;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;margin-top:20px}
  .footer{padding:20px 32px;background:#f8f9fa;border-top:1px solid #e0e0e0;font-size:11px;color:#999;text-align:center}
  .divider{border:none;border-top:1px solid #e0e0e0;margin:20px 0}
</style></head><body>
<div class="container">
  <div class="header">
    <div class="logo">Implant<span>Chain</span></div>
    <div style="color:#999;font-size:12px;margin-left:auto">Medical Device Traceability</div>
  </div>
  <div class="body">
    <div class="title">${title}</div>
    ${body}
  </div>
  <div class="footer">
    ImplantChain · ${APP_URL}<br>
    All device records are immutably stored on Hyperledger Fabric blockchain.<br>
    This is an automated notification — do not reply to this email.
  </div>
</div>
</body></html>`;
}

// ── Templates ───────────────────────────────────────────────────

export function recallAlertTemplate({ deviceName, lotNumber, lotId, hospitalId, recalledBy, reason }) {
  const subject = `⚠ URGENT: Device Recall Alert — ${deviceName}`;
  const html = wrap('⚠ Device Recall Alert', `
    <div class="alert-box alert-red">
      <strong>Immediate Action Required</strong><br>
      A medical device lot has been recalled. Check your inventory and quarantine affected devices immediately.
    </div>
    <div class="field"><div class="field-label">Device</div><div class="field-value">${deviceName}</div></div>
    <div class="field"><div class="field-label">Lot Number</div><div class="field-value mono">${lotNumber}</div></div>
    <div class="field"><div class="field-label">Lot ID</div><div class="field-value mono">${lotId}</div></div>
    <div class="field"><div class="field-label">Hospital</div><div class="field-value">🏥 ${hospitalId}</div></div>
    <div class="field"><div class="field-label">Recalled By</div><div class="field-value">${recalledBy}</div></div>
    ${reason ? '<div class="field"><div class="field-label">Reason</div><div class="field-value">'+reason+'</div></div>' : ''}
    <hr class="divider">
    <div style="font-size:13px;color:#555;line-height:1.7">
      <strong>Required actions:</strong><br>
      1. Identify all consignments containing this lot at your facility<br>
      2. Quarantine affected devices — do not use<br>
      3. Contact the sales rep immediately<br>
      4. Document any devices already implanted and file an MDR if applicable
    </div>
    <a href="${APP_URL}/infection-prevention" class="btn">View Recall Details →</a>
  `);
  return { subject, html };
}

export function adverseEventTemplate({ eventId, eventType, implantId, hospitalId, deviceName, reportedBy }) {
  const subject = `⚠ Adverse Event Recorded — ${deviceName} [${eventId}]`;
  const html = wrap('⚠ Adverse Event Report', `
    <div class="alert-box alert-amber">
      A device-related adverse event has been recorded. FDA MDR reporting may be required within 30 days.
    </div>
    <div class="field"><div class="field-label">Event ID</div><div class="field-value mono">${eventId}</div></div>
    <div class="field"><div class="field-label">Event Type</div><div class="field-value">${eventType.replace(/_/g,' ').toUpperCase()}</div></div>
    <div class="field"><div class="field-label">Device</div><div class="field-value">${deviceName||'—'}</div></div>
    <div class="field"><div class="field-label">Implant Record</div><div class="field-value mono">${implantId}</div></div>
    <div class="field"><div class="field-label">Hospital</div><div class="field-value">🏥 ${hospitalId}</div></div>
    <div class="field"><div class="field-label">Reported By</div><div class="field-value">${reportedBy}</div></div>
    <hr class="divider">
    <div style="font-size:13px;color:#555;line-height:1.7">
      <strong>FDA 21 CFR Part 803:</strong> Mandatory Device Reports (MDRs) must be filed within
      <strong>30 days</strong> of becoming aware of a device-related serious injury or death,
      and within <strong>5 days</strong> if the event requires remedial action.
    </div>
    <a href="${APP_URL}/infection-prevention" class="btn">View Event & Draft MDR →</a>
  `);
  return { subject, html };
}

export function mdrReminderTemplate({ eventId, deviceName, eventDate, daysLeft, hospitalId }) {
  const urgent = daysLeft <= 3;
  const subject = `${urgent?'🚨 URGENT':'⏰'} MDR Deadline in ${daysLeft} day${daysLeft!==1?'s':''} — ${deviceName}`;
  const html = wrap(`${urgent?'🚨':'⏰'} MDR Reporting Deadline`, `
    <div class="alert-box ${urgent?'alert-red':'alert-amber'}">
      <strong>${urgent?'URGENT: ':''}FDA MDR deadline in ${daysLeft} day${daysLeft!==1?'s':''}.</strong>
      ${urgent?'File the MedWatch report immediately.':'File at FDA MedWatch before the deadline.'}
    </div>
    <div class="field"><div class="field-label">Event ID</div><div class="field-value mono">${eventId}</div></div>
    <div class="field"><div class="field-label">Device</div><div class="field-value">${deviceName}</div></div>
    <div class="field"><div class="field-label">Event Date</div><div class="field-value">${eventDate}</div></div>
    <div class="field"><div class="field-label">Hospital</div><div class="field-value">🏥 ${hospitalId}</div></div>
    <div class="field"><div class="field-label">Days Remaining</div>
      <div class="field-value" style="color:${urgent?'#ef4444':'#f59e0b'};font-size:20px;font-weight:800">${daysLeft} days</div>
    </div>
    <a href="https://www.accessdata.fda.gov/scripts/medwatch" class="btn" style="margin-right:12px">File at FDA MedWatch →</a>
    <a href="${APP_URL}/infection-prevention" class="btn" style="background:#1a1a2e">View in ImplantChain →</a>
  `);
  return { subject, html };
}

export function welcomeTemplate({ username, role, hospitalId, loginUrl }) {
  const subject = `Welcome to ImplantChain — Your account is ready`;
  const html = wrap('Welcome to ImplantChain', `
    <div class="alert-box alert-blue">
      Your ImplantChain account has been created. You can now log in and access your portal.
    </div>
    <div class="field"><div class="field-label">Username</div><div class="field-value mono">${username}</div></div>
    <div class="field"><div class="field-label">Role</div><div class="field-value">${role.replace(/_/g,' ')}</div></div>
    ${hospitalId?'<div class="field"><div class="field-label">Hospital</div><div class="field-value">🏥 '+hospitalId+'</div></div>':''}
    <div class="alert-box alert-amber" style="margin-top:16px">
      <strong>Security:</strong> Please log in and change your password immediately.
      Contact your system administrator if you did not request this account.
    </div>
    <a href="${loginUrl||APP_URL+'/login'}" class="btn">Log In to ImplantChain →</a>
  `);
  return { subject, html };
}

export function testEmailTemplate(sentTo) {
  const subject = 'ImplantChain — Email Configuration Test';
  const html = wrap('✅ Email Configuration Working', `
    <div class="alert-box alert-blue">
      Your ImplantChain email notifications are configured correctly.
      This test email was sent to confirm your SendGrid integration is working.
    </div>
    <div class="field"><div class="field-label">Sent To</div><div class="field-value mono">${sentTo}</div></div>
    <div class="field"><div class="field-label">From</div><div class="field-value mono">${FROM}</div></div>
    <div class="field"><div class="field-label">Timestamp</div><div class="field-value">${new Date().toLocaleString()}</div></div>
    <p style="font-size:13px;color:#555;margin-top:16px">
      Notifications will now be sent automatically for: device recalls, adverse events,
      MDR deadline reminders, and new user welcome emails.
    </p>
  `);
  return { subject, html };
}
