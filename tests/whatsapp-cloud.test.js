const crypto = require('crypto');
const { verifyWebhookSignature } = require('../services/whatsapp-cloud');

describe('WhatsApp webhook signature verification', () => {
  const secret = 'test-webhook-secret';

  test('verifyWebhookSignature returns true for valid signature', () => {
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
    expect(verifyWebhookSignature(secret, signature, payload)).toBe(true);
  });

  test('verifyWebhookSignature returns false for invalid signature', () => {
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    expect(verifyWebhookSignature(secret, 'sha256=invalid', payload)).toBe(false);
  });

  test('verifyWebhookSignature returns false for tampered payload', () => {
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const tampered = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changed: true }] });
    expect(verifyWebhookSignature(secret, signature, tampered)).toBe(false);
  });
});
