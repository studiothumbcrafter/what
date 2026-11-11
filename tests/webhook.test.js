const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpDb = path.join(os.tmpdir(), `smartrent-webhook-${Date.now()}.sqlite`);
process.env.SMARTRENT_TEST_DB = tmpDb;

process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test';
process.env.WHATSAPP_APP_SECRET = 'test-secret';

const crypto = require('crypto');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');
const { init } = require('../db');

function signatureFor(body) {
  return crypto.createHmac('sha256', 'whsec_test').update(body).digest('hex');
}

function eventBody(orgId) {
  return {
    entity: 'event',
    event: 'payment.captured',
    contains: ['payment'],
    payload: {
      payment: {
        entity: {
          id: 'pay_webhook_1',
          entity: 'payment',
          amount: 99900,
          currency: 'INR',
          status: 'captured',
          order_id: 'order_webhook_1',
          notes: {},
        },
      },
      order: {
        entity: {
          id: 'order_webhook_1',
          entity: 'order',
          amount: 99900,
          currency: 'INR',
          notes: { plan_id: 'plan-professional', organization_id: orgId },
        },
      },
    },
  };
}

describe('Razorpay payment webhook', () => {
  let db;
  let orgId;

  beforeAll(async () => {
    db = init();
    const loginRes = await request(app)
      .post('/api/owner/login')
      .send({ username: 'admin', password: 'admin123' });
    orgId = jwt.decode(loginRes.body.token).org_id;
  });

  test('accepts a signed payment.captured event and activates the plan', async () => {
    const body = JSON.stringify(eventBody(orgId));
    const res = await request(app)
      .post('/api/webhook/payment')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', signatureFor(body))
      .set('X-Razorpay-Event-Id', 'evt_capture_1')
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.subscription.plan_id).toBe('plan-professional');
    expect(res.body.subscription.status).toBe('active');

    const row = db.prepare('SELECT * FROM subscriptions WHERE organization_id = ?').get(orgId);
    expect(row.status).toBe('active');
    expect(row.price_paise).toBe(99900);
  });

  test('rejects a replayed event id as duplicate', async () => {
    const body = JSON.stringify(eventBody(orgId));
    const res = await request(app)
      .post('/api/webhook/payment')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', signatureFor(body))
      .set('X-Razorpay-Event-Id', 'evt_capture_1')
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('duplicate');
  });

  test('rejects a bad signature', async () => {
    const body = JSON.stringify(eventBody(orgId));
    const res = await request(app)
      .post('/api/webhook/payment')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', 'bad-signature')
      .set('X-Razorpay-Event-Id', 'evt_capture_2')
      .send(body);

    expect(res.status).toBe(401);
  });

  test('processes an unknown event type once and ignores it', async () => {
    const payload = eventBody(orgId);
    payload.event = 'payment.failed';
    const body = JSON.stringify(payload);
    const res = await request(app)
      .post('/api/webhook/payment')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', signatureFor(body))
      .set('X-Razorpay-Event-Id', 'evt_failed_1')
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ignored');
  });
});
