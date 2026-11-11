const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpDb = path.join(os.tmpdir(), `smartrent-subscription-${Date.now()}.sqlite`);
process.env.SMARTRENT_TEST_DB = tmpDb;

process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.WHATSAPP_ACCESS_TOKEN = 'test-whatsapp-token';
process.env.WHATSAPP_APP_SECRET = 'test-secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');
const { init } = require('../db');

describe('Subscription status endpoint', () => {
  let db;
  let token;
  let orgId;
  let initialSubscription;

  beforeAll(async () => {
    db = init();

    const loginRes = await request(app)
      .post('/api/owner/login')
      .send({ username: 'admin', password: 'admin123' });

    token = loginRes.body.token;
    orgId = jwt.decode(token).org_id;

    initialSubscription = db.prepare(
      'SELECT * FROM subscriptions WHERE organization_id = ?'
    ).get(orgId);

    db.prepare(`
      INSERT INTO subscriptions (id, organization_id, plan_id, status, price_paise, currency, created_at)
      VALUES ('sub-status-test', ?, 'plan-starter', 'active', 49900, 'INR', datetime('now'))
      ON CONFLICT(organization_id) DO UPDATE SET
        plan_id = excluded.plan_id,
        status = excluded.status,
        price_paise = excluded.price_paise,
        currency = excluded.currency
    `).run(orgId);
  });

  test('owner login returns a token with organization context', () => {
    expect(token).toBeDefined();
    expect(orgId).toBeDefined();
    expect(jwt.decode(token).role).toBe('owner');
  });

  test('a fresh owner organization starts on a starter trial', () => {
    expect(initialSubscription).toBeDefined();
    expect(initialSubscription.status).toBe('trialing');
    expect(initialSubscription.plan_id).toBe('plan-starter');
    expect(new Date(initialSubscription.trial_end).getTime()).toBeGreaterThan(Date.now());
  });

  test('GET /api/subscription/status returns subscription info', async () => {
    const res = await request(app)
      .get('/api/subscription/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
    expect(res.body.plan).toBe('plan-starter');
    expect(res.body.plan_name).toBe('starter');
    expect(res.body.price_paise).toBe(49900);
    expect(res.body.property_limit).toBe(10);
    expect(res.body.usage.properties).toBeGreaterThanOrEqual(0);
  });

  test('GET /api/subscription/status returns 401 without token', async () => {
    const res = await request(app).get('/api/subscription/status');
    expect(res.status).toBe(401);
  });

  test('GET /api/subscription/status rejects a token signed with another secret', async () => {
    const badToken = jwt.sign({ role: 'owner', org_id: orgId }, 'wrong-secret', { expiresIn: '1h' });
    const res = await request(app)
      .get('/api/subscription/status')
      .set('Authorization', `Bearer ${badToken}`);
    expect(res.status).toBe(403);
  });
});
