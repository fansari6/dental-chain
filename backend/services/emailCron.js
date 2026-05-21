// backend/services/emailCron.js
// Daily MDR deadline reminder cron job
import { sendEmail, logEmail, mdrReminderTemplate } from './email.js';
import { getIPOfficerEmails } from '../db/index.js';
import { pool } from '../db/index.js';

async function checkMDRDeadlines() {
  console.log('[EmailCron] Checking MDR deadlines…');
  try {
    // Get adverse events where 30-day deadline is within 7 days and not yet reported
    const { rows: events } = await pool.query(`
      SELECT ae.*
      FROM audit_log ae
      WHERE ae.action = 'RECORD_ADVERSE_EVENT'
        AND (ae.details->>'reportedToFDA')::boolean IS NOT TRUE
        AND (ae.details->>'eventDate')::date + INTERVAL '30 days'
            BETWEEN NOW() AND NOW() + INTERVAL '7 days'
    `);

    for (const event of events) {
      try {
        const details = typeof event.details==='string' ? JSON.parse(event.details) : (event.details||{});
        const eventDate = details.eventDate || event.created_at?.toISOString().split('T')[0];
        const deadline  = new Date(new Date(eventDate).getTime() + 30*86400000);
        const daysLeft  = Math.ceil((deadline - new Date()) / 86400000);
        const hospitalId = details.hospitalId || '';

        const ipEmails = await getIPOfficerEmails(hospitalId);
        if (ipEmails.length === 0) continue;

        const { subject, html } = mdrReminderTemplate({
          eventId:    details.eventId || event.target,
          deviceName: details.deviceName || '—',
          eventDate,
          daysLeft,
          hospitalId,
        });

        await sendEmail({ to: ipEmails, subject, html });
        await logEmail(pool, { recipients:ipEmails, subject, type:'MDR_REMINDER',
          triggeredBy:'system', details:{ eventId:details.eventId, daysLeft } });

        console.log('[EmailCron] MDR reminder sent for', details.eventId, '— days left:', daysLeft);
      } catch(e) { console.warn('[EmailCron] MDR reminder failed:', e.message); }
    }
    console.log('[EmailCron] MDR check complete —', events.length, 'events checked');
  } catch(e) { console.error('[EmailCron] Error:', e.message); }
}

export function startEmailCron() {
  if (!process.env.SENDGRID_API_KEY) {
    console.log('[EmailCron] No SENDGRID_API_KEY — cron disabled');
    return;
  }
  // Run at startup (after 30s delay) then every 24h
  setTimeout(checkMDRDeadlines, 30000);
  setInterval(checkMDRDeadlines, 24 * 60 * 60 * 1000);
  console.log('[EmailCron] MDR deadline reminder cron started');
}
