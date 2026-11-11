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

module.exports = { verifyWebhookSignature };
