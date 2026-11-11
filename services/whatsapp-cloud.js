// WhatsApp Cloud API service
// Stage 3: Official WhatsApp Business API integration

const crypto = require('crypto');
const https = require('https');

/**
 * Verify WhatsApp webhook signature using HMAC-SHA256
 * Meta signs webhook payloads with the app secret
 */
function verifyWebhookSignature(secret, signature, payload) {
  if (!signature || !secret || !payload) {
    return false;
  }

  // Meta sends signature as 'sha256=<hex>'
  const expectedSignature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  // Buffers must be same length; if different lengths, they can't match
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(sigBuf, expectedBuf);
}

/**
 * Parse WhatsApp webhook payload to extract message details
 * Meta webhook format: { entry: [{ changes: [{ value: { messages: [{ from, text: { body }, id, timestamp }] }] }] }
 */
function parseWebhookMessage(payload) {
  if (!payload || !payload.entry || !Array.isArray(payload.entry)) {
    return null;
  }

  for (const entry of payload.entry) {
    if (!entry.changes || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      if (!change.value || !change.value.messages || !Array.isArray(change.value.messages)) continue;
      const msg = change.value.messages[0];
      if (msg && msg.from && msg.text) {
        return {
          phone: msg.from,
          text: msg.text.body,
          messageId: msg.id,
          timestamp: msg.timestamp,
        };
      }
    }
  }

  return null;
}

/**
 * Send WhatsApp message via Cloud API
 * @param {string} phoneNumberId - WhatsApp Business Phone Number ID
 * @param {string} to - Recipient phone number
 * @param {string} text - Message text
 * @returns {Promise<{messageId: string, status: string}>}
 */
function sendMessage(phoneNumberId, to, text) {
  return new Promise((resolve, reject) => {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!accessToken) {
      reject(new Error('WHATSAPP_ACCESS_TOKEN not configured'));
      return;
    }

    const data = JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'text',
      text: { body: text },
    });

    const options = {
      hostname: 'graph.facebook.com',
      port: 443,
      path: `/v18.0/${phoneNumberId}/messages`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            resolve({
              messageId: parsed.messages?.[0]?.id || 'msg-' + Date.now(),
              status: 'sent',
            });
          } catch (e) {
            resolve({ messageId: 'msg-' + Date.now(), status: 'sent' });
          }
        } else {
          reject(new Error(`WhatsApp API error: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`WhatsApp API request failed: ${e.message}`));
    });

    req.write(data);
    req.end();
  });
}

module.exports = { verifyWebhookSignature, parseWebhookMessage, sendMessage };
