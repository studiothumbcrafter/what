const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpDb = path.join(os.tmpdir(), `smartrent-payment-service-${Date.now()}.sqlite`);
process.env.SMARTRENT_TEST_DB = tmpDb;

process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test';

jest.mock('https', () => ({
  request: jest.fn((options, callback) => {
    const respond = (statusCode, body) => {
      const res = {
        statusCode,
        on: (event, cb) => {
          if (event === 'data') cb(JSON.stringify(body));
          if (event === 'end') cb();
        },
      };
      setTimeout(() => callback(res), 5);
    };

    if (options.method === 'POST' && options.path === '/v1/orders') {
      respond(200, { id: 'order_test', amount: 99900, currency: 'INR', status: 'created' });
    } else if (options.method === 'GET' && options.path === '/v1/orders/order_test') {
      respond(200, {
        id: 'order_test',
        amount: 99900,
        currency: 'INR',
        status: 'paid',
        notes: { plan_id: 'plan-professional', organization_id: 'org-1' },
      });
    } else {
      respond(404, { error: { description: 'Not found' } });
    }

    return { write: jest.fn(), end: jest.fn(), on: jest.fn() };
  }),
}));

const crypto = require('crypto');
const { init } = require('../db');
const {
  createCheckoutSession,
  fetchOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
} = require('../services/payment');

describe('Razorpay payment service', () => {
  let db;

  beforeAll(() => {
    db = init();
  });

  test('createCheckoutSession returns order for a plan', async () => {
    const result = await createCheckoutSession(db, 'professional', 'org-1');
    expect(result.orderId).toBe('order_test');
    expect(result.amount).toBe(99900);
    expect(result.currency).toBe('INR');
    expect(result.planId).toBe('plan-professional');
    expect(result.keyId).toBe('rzp_test_key');
  });

  test('createCheckoutSession rejects an unknown plan', async () => {
    await expect(createCheckoutSession(db, 'missing-plan', 'org-1')).rejects.toMatchObject({
      code: 'PLAN_NOT_FOUND',
    });
  });

  test('fetchOrder returns the order with notes', async () => {
    const order = await fetchOrder('order_test');
    expect(order.amount).toBe(99900);
    expect(order.notes.organization_id).toBe('org-1');
  });

  test('verifyPaymentSignature accepts a valid signature', () => {
    const signature = crypto
      .createHmac('sha256', 'rzp_test_secret')
      .update('order_test|pay_test')
      .digest('hex');
    expect(verifyPaymentSignature('order_test', 'pay_test', signature)).toBe(true);
  });

  test('verifyPaymentSignature rejects a tampered signature', () => {
    expect(verifyPaymentSignature('order_test', 'pay_test', 'deadbeef')).toBe(false);
  });

  test('verifyWebhookSignature accepts a valid body signature', () => {
    const body = Buffer.from(JSON.stringify({ event: 'payment.captured' }));
    const signature = crypto
      .createHmac('sha256', 'whsec_test')
      .update(body)
      .digest('hex');
    expect(verifyWebhookSignature(body, signature)).toBe(true);
  });

  test('verifyWebhookSignature rejects a tampered body', () => {
    const body = Buffer.from(JSON.stringify({ event: 'payment.captured' }));
    const signature = crypto
      .createHmac('sha256', 'whsec_test')
      .update(body)
      .digest('hex');
    expect(verifyWebhookSignature(Buffer.from('{"event":"refunded"}'), signature)).toBe(false);
  });
});
