const path = require('path');
const os = require('os');

const tmpDb = path.join(os.tmpdir(), `smartrent-tenant-isolation-${Date.now()}.sqlite`);
process.env.SMARTRENT_TEST_DB = tmpDb;
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.WHATSAPP_APP_SECRET = 'test-secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');
const { init } = require('../db');

const SECRET = 'test-jwt-secret-for-testing';
const ORG_A = 'ti-org-a';
const ORG_B = 'ti-org-b';

function tokenFor(orgId) {
  return jwt.sign({ sub: 'owner-' + orgId, username: 'owner-' + orgId, role: 'owner', org_id: orgId }, SECRET);
}

describe('Tenant isolation between organizations', () => {
  let db;
  let tokenA;
  let tokenB;

  beforeAll(() => {
    db = init();
    tokenA = tokenFor(ORG_A);
    tokenB = tokenFor(ORG_B);

    const insertOrg = db.prepare(
      "INSERT OR IGNORE INTO organizations (id, name, plan, status) VALUES (?, ?, 'starter', 'active')"
    );
    insertOrg.run(ORG_A, 'Tenant A');
    insertOrg.run(ORG_B, 'Tenant B');

    const insertSub = db.prepare(`
      INSERT OR REPLACE INTO subscriptions
        (id, organization_id, plan, plan_id, status, price_paise, currency, created_at)
      VALUES (?, ?, 'starter', 'plan-starter', 'active', 49900, 'INR', datetime('now'))
    `);
    insertSub.run('ti-sub-a', ORG_A);
    insertSub.run('ti-sub-b', ORG_B);

    db.prepare(`
      INSERT OR REPLACE INTO properties (id, title, rent, location, status, created_at, organization_id)
      VALUES (?, ?, ?, ?, 'available', ?, ?)
    `).run('ti-prop-a', 'Property A', 8000, 'Pune', new Date().toISOString(), ORG_A);
    db.prepare(`
      INSERT OR REPLACE INTO properties (id, title, rent, location, status, created_at, organization_id)
      VALUES (?, ?, ?, ?, 'available', ?, ?)
    `).run('ti-prop-b', 'Property B', 12000, 'Mumbai', new Date().toISOString(), ORG_B);

    const now = new Date().toISOString();

    db.prepare(`
      INSERT OR REPLACE INTO matches (id, phone, property_id, shown_at, organization_id)
      VALUES ('ti-match-a', '9100000001', 'ti-prop-a', ?, ?)
    `).run(now, ORG_A);
    db.prepare(`
      INSERT OR REPLACE INTO matches (id, phone, property_id, shown_at, organization_id)
      VALUES ('ti-match-b', '9100000002', 'ti-prop-b', ?, ?)
    `).run(now, ORG_B);

    const insertCustomer = db.prepare(`
      INSERT OR REPLACE INTO customers (phone, name, requirements, state, created_at, updated_at, organization_id)
      VALUES (?, ?, '{}', 'collecting', ?, ?, ?)
    `);
    insertCustomer.run('9100000001', 'Customer A', now, now, ORG_A);
    insertCustomer.run('9100000002', 'Customer B', now, now, ORG_B);

    const insertContact = db.prepare(
      'INSERT OR REPLACE INTO allowed_contacts (phone, name, added_at, organization_id) VALUES (?, ?, ?, ?)'
    );
    insertContact.run('9100000001', 'Contact A', now, ORG_A);
    insertContact.run('9100000002', 'Contact B', now, ORG_B);

    const insertVisit = db.prepare(`
      INSERT OR REPLACE INTO visits (id, phone, property_id, status, created_at, organization_id)
      VALUES (?, ?, ?, 'pending', ?, ?)
    `);
    insertVisit.run('ti-visit-a', '9100000001', 'ti-prop-a', now, ORG_A);
    insertVisit.run('ti-visit-b', '9100000002', 'ti-prop-b', now, ORG_B);
  });

  test('matches are scoped to the caller organization', async () => {
    const res = await request(app)
      .get('/api/matches')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.map((m) => m.id)).toEqual(['ti-match-a']);
  });

  test('customers are scoped to the caller organization', async () => {
    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.map((c) => c.phone)).toEqual(['9100000001']);
  });

  test('allowed contacts are scoped to the caller organization', async () => {
    const res = await request(app)
      .get('/api/allowed-contacts')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.map((c) => c.phone)).toEqual(['9100000001']);
  });

  test('a phone number owned by another organization cannot be claimed', async () => {
    const res = await request(app)
      .post('/api/allowed-contacts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ phone: '9100000002', name: 'Hijack attempt' });

    expect(res.status).toBe(409);
    const row = db.prepare('SELECT organization_id, name FROM allowed_contacts WHERE phone = ?').get('9100000002');
    expect(row.organization_id).toBe(ORG_B);
    expect(row.name).toBe('Contact B');
  });

  test('deleting another organization contact has no effect', async () => {
    const res = await request(app)
      .delete('/api/allowed-contacts/9100000002')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(db.prepare('SELECT phone FROM allowed_contacts WHERE phone = ?').get('9100000002')).toBeDefined();
  });

  test('visit lists are scoped to the caller organization', async () => {
    const all = await request(app)
      .get('/api/visits')
      .set('Authorization', `Bearer ${tokenA}`);
    const pending = await request(app)
      .get('/api/visits/pending')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(all.status).toBe(200);
    expect(all.body.map((v) => v.id)).toEqual(['ti-visit-a']);
    expect(pending.status).toBe(200);
    expect(pending.body.map((v) => v.id)).toEqual(['ti-visit-a']);
  });

  test('another organization visit cannot be approved', async () => {
    const res = await request(app)
      .patch('/api/visits/ti-visit-b/status')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'approved' });

    expect(res.status).toBe(404);
    expect(db.prepare('SELECT status FROM visits WHERE id = ?').get('ti-visit-b').status).toBe('pending');
  });

  test('another organization visit cannot be rescheduled', async () => {
    const res = await request(app)
      .patch('/api/visits/ti-visit-b/schedule')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ visit_date: '2026-12-01', visit_time: '11:00' });

    expect(res.status).toBe(404);
    const row = db.prepare('SELECT visit_date, visit_time FROM visits WHERE id = ?').get('ti-visit-b');
    expect(row.visit_date).toBeNull();
    expect(row.visit_time).toBeNull();
  });

  test('a visit cannot be requested for another organization property', async () => {
    const res = await request(app)
      .post('/api/visits/request')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ property_id: 'ti-prop-b' });

    expect(res.status).toBe(404);
  });

  test('a valid visit request is stored in the property organization and counted', async () => {
    const before = db.prepare(
      "SELECT COALESCE(SUM(count), 0) AS total FROM usage_logs WHERE organization_id = ? AND type = 'visit'"
    ).get(ORG_A).total;

    const res = await request(app)
      .post('/api/visits/request')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ property_id: 'ti-prop-a', message: 'Please show me this flat' });

    expect(res.status).toBe(200);
    expect(res.body.visit.organization_id).toBe(ORG_A);

    const after = db.prepare(
      "SELECT COALESCE(SUM(count), 0) AS total FROM usage_logs WHERE organization_id = ? AND type = 'visit'"
    ).get(ORG_A).total;
    expect(after).toBe(before + 1);
  });
});
