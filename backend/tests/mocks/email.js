// __tests__/__mocks__/email.js
// Mock email service — captures all sent emails for assertions

export const sentEmails = [];

export function resetEmails() {
  sentEmails.length = 0;
}

export async function sendEmail({ to, subject, html }) {
  sentEmails.push({ to, subject, html, sentAt: new Date() });
  return { accepted: Array.isArray(to) ? to : [to] };
}

export async function logEmail(pool, { recipients, subject, type, triggeredBy, details }) {
  sentEmails.push({ recipients, subject, type, triggeredBy, details, logged: true });
}

export function recallAlertTemplate({ deviceName, lotNumber, lotId, hospitalId, recalledBy, reason }) {
  return {
    subject: `[URGENT] Device Recall — ${deviceName} · Lot ${lotNumber}`,
    html: `<h1>Recall Alert</h1><p>Lot: ${lotId} recalled by ${recalledBy}. Reason: ${reason}</p>`,
  };
}

export function adverseEventTemplate({ eventId, eventType, implantId, hospitalId, deviceName, reportedBy }) {
  return {
    subject: `Adverse Event Reported — ${eventType} · ${implantId}`,
    html: `<h1>Adverse Event</h1><p>Event: ${eventId} at ${hospitalId} reported by ${reportedBy}</p>`,
  };
}

export function mdrReminderTemplate({ eventId, deviceName, eventDate, daysLeft, hospitalId }) {
  return {
    subject: `MDR Deadline Reminder — ${eventId} · ${daysLeft} days remaining`,
    html: `<h1>MDR Reminder</h1><p>Event: ${eventId} · Device: ${deviceName} · ${daysLeft} days left</p>`,
  };
}

export function welcomeTemplate({ username, role, hospitalId, loginUrl }) {
  return {
    subject: `Welcome to ImplantChain — ${username}`,
    html: `<h1>Welcome ${username}</h1><p>Role: ${role}</p>`,
  };
}

export function testEmailTemplate(sentTo) {
  return {
    subject: 'ImplantChain — Test Email',
    html: `<h1>Test Email</h1><p>Sent to: ${sentTo}</p>`,
  };
}
