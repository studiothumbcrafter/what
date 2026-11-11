const crypto = require('crypto');
const { verifyWebhookSignature, parseWebhookMessage } = require('../services/whatsapp-cloud');

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

describe('WhatsApp webhook parsing', () => {
  test('parseWebhookMessage extracts phone, text, messageId, timestamp', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: '+919876543210',
                    text: { body: 'Hello' },
                    id: 'msg-1',
                    timestamp: '1234567890',
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const msg = parseWebhookMessage(payload);

    expect(msg.phone).toBe('+919876543210');
    expect(msg.text).toBe('Hello');
    expect(msg.messageId).toBe('msg-1');
    expect(msg.timestamp).toBe('1234567890');
  });

  test('parseWebhookMessage returns null for empty payload', () => {
    const msg = parseWebhookMessage({ object: 'whatsapp_business_account', entry: [] });
    expect(msg).toBeNull();
  });
});
