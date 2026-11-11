// WhatsApp Cloud API service
// Stage 3: Official WhatsApp Business API integration

const crypto = require('crypto');

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

module.exports = { verifyWebhookSignature, parseWebhookMessage };

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
