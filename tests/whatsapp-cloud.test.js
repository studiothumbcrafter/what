const crypto = require('crypto');

// Mock https module before requiring whatsapp-cloud
jest.mock('https', () => {
  return {
    request: jest.fn((options, callback) => {
      if (!options.path || options.path.includes('//')) {
        const res = { statusCode: 400, on: (event, cb) => { if (event === 'data') cb(JSON.stringify({ error: { message: 'Invalid request' } })); if (event === 'end') cb(); } };
        setTimeout(() => callback(res), 10);
        return { write: jest.fn(), end: jest.fn(), on: jest.fn() };
      }
      const res = {
        statusCode: 200,
        on: (event, cb) => {
          if (event === 'data') cb(JSON.stringify({ messages: [{ id: 'msg-123' }] }));
          if (event === 'end') cb();
        },
      };
      setTimeout(() => callback(res), 10);
      return {
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
      };
    }),
  };
});

const { verifyWebhookSignature, parseWebhookMessage, sendMessage, registerPhoneNumber } = require('../services/whatsapp-cloud');

process.env.SUPABASE_ACCESS_TOKEN = 'test-supabase-secret';
process.env.WHATSAPP_ACCESS_TOKEN = 'test-whatsapp-token';

describe('WhatsApp webhook signature verification', () => {
  test('verifyWebhookSignature returns true for valid signature', () => {
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const signature = 'sha256=' + crypto.createHmac('sha256', 'test-webhook-secret').update(payload).digest('hex');
    expect(verifyWebhookSignature('test-webhook-secret', signature, payload)).toBe(true);
  });

  test('verifyWebhookSignature returns false for invalid signature', () => {
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    expect(verifyWebhookSignature('test-webhook-secret', 'sha256=invalid', payload)).toBe(false);
  });

  test('verifyWebhookSignature returns false for tampered payload', () => {
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const signature = 'sha256=' + crypto.createHmac('sha256', 'test-webhook-secret').update(payload).digest('hex');
    const tampered = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changed: true }] });
    expect(verifyWebhookSignature('test-webhook-secret', signature, tampered)).toBe(false);
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

describe('WhatsApp message sending', () => {
  test('sendMessage returns messageId on success', async () => {
    const result = await sendMessage('123456789', '+919876543210', 'Hello');
    expect(result.messageId).toBeDefined();
    expect(result.status).toBe('sent');
  });

  test('sendMessage throws on API error', async () => {
    await expect(sendMessage('', '+919876543210', 'Hello')).rejects.toThrow();
  });
});
