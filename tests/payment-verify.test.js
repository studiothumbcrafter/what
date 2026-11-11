const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpDb = path.join(os.tmpdir(), `smartrent-payment-${Date.now()}.sqlite`);
process.env.SMARTRENT_TEST_DB = tmpDb;

process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
process.env.WHATSAPP_APP_SECRET = 'test-secret';

let mockOrderOrgId = 'org-1';

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
        notes: { plan_id: 'plan-professional', organization_id: mockOrderOrgId },
      });
    } else {
      respond(404, { error: { description: 'Not found' } });
    }

    return { write: jest.fn(), end: jest.fn(), on: jest.fn() };
  }),
}));

const crypto = require('crypto');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');
const { init } = require('../db');

function sign(orderId, paymentId) {
  return crypto
    .createHmac('sha256', 'rzp_test_secret')
    .update(orderId + '|' + paymentId)
    .digest('hex');
}

describe('Subscription payment endpoints', () => {
  let db;
  let token;
  let orgId;

  beforeAll(async () => {
    db = init();
    const loginRes = await request(app)
      .post('/api/owner/login')
      .send({ username: 'admin', password: 'admin123' });
    token = loginRes.body.token;
    orgId = jwt.decode(token).org_id;
    mockOrderOrgId = orgId;
  });

  test('POST /api/subscription/checkout creates an order', async () => {
    const res = await request(app)
      .post('/api/subscription/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan_id: 'professional' });

    expect(res.status).toBe(200);
    expect(res.body.orderId).toBe('order_test');
    expect(res.body.amount).toBe(99900);
    expect(res.body.currency).toBe('INR');
  });

  test('POST /api/subscription/payment/verify activates the plan', async () => {
    const res = await request(app)
      .post('/api/subscription/payment/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({
        razorpay_order_id: 'order_test',
        razorpay_payment_id: 'pay_test',
        razorpay_signature: sign('order_test', 'pay_test'),
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.subscription.status).toBe('active');
    expect(res.body.subscription.plan_id).toBe('plan-professional');
    expect(res.body.subscription.price_paise).toBe(99900);
    expect(res.body.subscription.renewal_date).toBeDefined();
  });

  test('verify rejects an invalid signature', async () => {
    const res = await request(app)
      .post('/api/subscription/payment/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({
        razorpay_order_id: 'order_test',
        razorpay_payment_id: 'pay_test',
        razorpay_signature: 'deadbeef',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/signature/i);
  });

  test('verify rejects an order from another organization', async () => {
    mockOrderOrgId = 'org-someone-else';
    const res = await request(app)
      .post('/api/subscription/payment/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({
        razorpay_order_id: 'order_test',
        razorpay_payment_id: 'pay_test',
        razorpay_signature: sign('order_test', 'pay_test'),
      });

    expect(res.status).toBe(403);
    mockOrderOrgId = orgId;
  });

  test('verify requires all payment fields', async () => {
    const res = await request(app)
      .post('/api/subscription/payment/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ razorpay_order_id: 'order_test' });

    expect(res.status).toBe(400);
  });
});
