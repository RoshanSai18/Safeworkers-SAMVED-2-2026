const twilio = require('twilio');

function hasTwilioConfig() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID
    && process.env.TWILIO_AUTH_TOKEN
    && process.env.TWILIO_WHATSAPP_NUMBER
  );
}

function normalizePhone(input = '') {
  return String(input).trim().replace(/\s+/g, '');
}

function isValidE164(phone = '') {
  return /^\+?[1-9]\d{1,14}$/.test(phone);
}

function getClient() {
  if (!hasTwilioConfig()) return null;
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

function getSupervisorRecipients() {
  const single = normalizePhone(process.env.SUPERVISOR_WHATSAPP_NUMBER || '');
  const listRaw = String(process.env.SUPERVISOR_WHATSAPP_NUMBERS || '');
  const fromList = listRaw
    .split(',')
    .map((item) => normalizePhone(item))
    .filter(Boolean);

  const deduped = [...new Set([single, ...fromList].filter(Boolean))];
  return deduped.filter(isValidE164);
}

function reasonLabel(reason = '') {
  const normalized = String(reason || '').toLowerCase();
  if (normalized === 'duration_exceeded') return 'Shift time exceeded';
  if (normalized === 'manual') return 'Manual SOS trigger';
  return normalized ? normalized : 'Manual SOS trigger';
}

function buildSosWhatsAppMessage(context = {}) {
  const {
    workerName,
    workerId,
    jobId,
    zone,
    location,
    reason,
    triggeredAt,
  } = context;

  const time = triggeredAt || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return [
    '🚨 *SAMVED SOS ALERT*',
    '',
    `Worker: ${workerName || `Worker ${workerId || 'N/A'}`}`,
    `Worker ID: ${workerId ?? 'N/A'}`,
    `Job: ${jobId || 'N/A'}`,
    `Zone: ${zone || 'Zone N/A'}`,
    `Location: ${location || 'Field location'}`,
    `Reason: ${reasonLabel(reason)}`,
    `Time: ${time}`,
    '',
    'Immediate action required in Supervisor Dashboard.',
  ].join('\n');
}

async function sendWhatsAppMessage(to, message) {
  const client = getClient();
  if (!client) {
    return { success: false, skipped: true, error: 'Twilio credentials are not configured yet.' };
  }

  const target = normalizePhone(to);
  if (!isValidE164(target)) {
    return { success: false, error: 'Invalid phone number format. Use +91XXXXXXXXXX.' };
  }

  try {
    const response = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: `whatsapp:${target}`,
      body: message,
    });

    return { success: true, sid: response.sid };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to send WhatsApp message',
      code: error.code,
    };
  }
}

async function sendSosToSupervisors(context = {}) {
  const recipients = getSupervisorRecipients();
  if (recipients.length === 0) {
    return {
      success: false,
      skipped: true,
      error: 'No supervisor WhatsApp number configured in environment.',
      recipients: [],
      results: [],
    };
  }

  const message = buildSosWhatsAppMessage(context);
  const results = [];

  for (const recipient of recipients) {
    // Sequential send keeps logs easy to trace during incidents.
    // Number of recipients is expected to be small.
    // eslint-disable-next-line no-await-in-loop
    const result = await sendWhatsAppMessage(recipient, message);
    results.push({ to: recipient, ...result });
  }

  const successCount = results.filter((item) => item.success).length;
  return {
    success: successCount > 0,
    successCount,
    recipients,
    results,
  };
}

async function sendWhatsApp(req, res) {
  const { to, message } = req.body || {};
  if (!to || !message) {
    return res.status(400).json({ success: false, error: 'Phone number and message are required.' });
  }

  const result = await sendWhatsAppMessage(to, message);
  if (!result.success) {
    const status = result.skipped ? 503 : 400;
    return res.status(status).json(result);
  }

  return res.status(200).json({ success: true, sid: result.sid, message: 'WhatsApp message sent successfully.' });
}

async function sendSosAlert(req, res) {
  const { workerName, workerId, jobId, zone, location, reason, triggeredAt } = req.body || {};
  const result = await sendSosToSupervisors({ workerName, workerId, jobId, zone, location, reason, triggeredAt });

  if (!result.success) {
    const status = result.skipped ? 503 : 500;
    return res.status(status).json(result);
  }

  return res.status(200).json({ success: true, ...result });
}

module.exports = {
  sendWhatsApp,
  sendSosAlert,
  sendSosToSupervisors,
  buildSosWhatsAppMessage,
};
