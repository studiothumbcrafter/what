const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpDb = path.join(os.tmpdir(), `smartrent-limits-${Date.now()}.sqlite`);
process.env.SMARTRENT_TEST_DB = tmpDb;

process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.WHATSAPP_APP_SECRET = 'test-secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');
const { init } = require('../db');

describe('Plan limit enforcement on property creation', () => {
  let db;
  let token;
  let orgId;
  let limit;

  beforeAll(async () => {
    db = init();
    const loginRes = await request(app)
      .post('/api/owner/login')
      .send({ username: 'admin', password: 'admin123' });
    token = loginRes.body.token;
    orgId = jwt.decode(token).org_id;

    const existing = db.prepare(
      'SELECT COUNT(*) AS count FROM properties WHERE organization_id = ?'
    ).get(orgId).count;
    limit = existing + 2;

    db.prepare(`
      INSERT INTO plans (id, name, price_paise, property_limit, monthly_match_limit, monthly_visit_limit)
      VALUES ('plan-test-limit', 'test-limit', 100, ?, 100, 100)
      ON CONFLICT(name) DO UPDATE SET property_limit = excluded.property_limit
    `).run(limit);

    db.prepare(`
      INSERT INTO subscriptions (id, organization_id, plan, plan_id, status, price_paise, currency, created_at)
      VALUES ('sub-limit-test', ?, 'test-limit', 'plan-test-limit', 'active', 100, 'INR', datetime('now'))
      ON CONFLICT(organization_id) DO UPDATE SET
        plan = 'test-limit', plan_id = 'plan-test-limit', status = 'active', price_paise = 100
    `).run(orgId);
  });

  test('allows property creation below the plan limit', async () => {
    for (let i = 0; i < 2; i++) {
      const res = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Limit test ' + i, rent: 5000, location: 'Test City' });

      expect(res.status).toBe(201);
      expect(res.body.organization_id).toBe(orgId);
    }
  });

  test('rejects property creation at the plan limit with 403', async () => {
    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Over limit', rent: 5000, location: 'Test City' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/limit/i);
  });

  test('status endpoint reports the limit and current usage', async () => {
    const res = await request(app)
      .get('/api/subscription/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.property_limit).toBe(limit);
    expect(res.body.usage.properties).toBe(limit);
  });
});
