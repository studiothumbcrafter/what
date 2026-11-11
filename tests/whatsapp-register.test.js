const crypto = require('crypto');

// Mock https module before requiring whatsapp-cloud
jest.mock('https', () => {
  return {
    request: jest.fn((options, callback) => {
      const res = {
        statusCode: 200,
        on: (event, cb) => {
          if (event === 'data') cb(JSON.stringify({ id: 'phone-123' }));
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

const { registerPhoneNumber } = require('../services/whatsapp-cloud');

process.env.WHATSAPP_ACCESS_TOKEN = 'test-whatsapp-token';

describe('WhatsApp phone number registration', () => {
  test('registerPhoneNumber returns phoneNumberId on success', async () => {
    const result = await registerPhoneNumber('+919876543210', 'Test Business');
    expect(result.phoneNumberId).toBeDefined();
    expect(result.status).toBe('registered');
  });

  test('registerPhoneNumber throws on missing phone', async () => {
    await expect(registerPhoneNumber('', 'Test Business')).rejects.toThrow();
  });
});
