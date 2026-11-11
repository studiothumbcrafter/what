const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpDb = path.join(os.tmpdir(), `smartrent-migration-subs-${Date.now()}.sqlite`);
process.env.SMARTRENT_TEST_DB = tmpDb;

const { init } = require('../../db');

describe('Database migrations - subscriptions and plans', () => {
  let db;

  beforeAll(() => {
    db = init();
  });

  test('plans table exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='plans'").get();
    expect(result.name).toBe('plans');
  });

  test('plans table has required columns', () => {
    const columns = db.prepare("PRAGMA table_info(plans)").all();
    const colNames = columns.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('name');
    expect(colNames).toContain('price_paise');
    expect(colNames).toContain('billing_interval');
    expect(colNames).toContain('property_limit');
    expect(colNames).toContain('monthly_match_limit');
    expect(colNames).toContain('monthly_visit_limit');
    expect(colNames).toContain('is_active');
    expect(colNames).toContain('created_at');
  });

  test('plans table has three plans with correct prices', () => {
    const plans = db.prepare("SELECT * FROM plans ORDER BY price_paise ASC").all();
    expect(plans.length).toBe(3);
    const plansByName = {};
    plans.forEach(p => { plansByName[p.name] = p; });
    expect(plansByName.starter.price_paise).toBe(49900);
    expect(plansByName.professional.price_paise).toBe(99900);
    expect(plansByName.business.price_paise).toBe(199900);
    expect(plansByName.starter.property_limit).toBe(10);
    expect(plansByName.starter.monthly_match_limit).toBe(50);
    expect(plansByName.starter.monthly_visit_limit).toBe(10);
    expect(plansByName.professional.property_limit).toBe(50);
    expect(plansByName.business.property_limit).toBe(200);
  });

  test('subscriptions table has plan_id column', () => {
    const columns = db.prepare("PRAGMA table_info(subscriptions)").all();
    const colNames = columns.map(c => c.name);
    expect(colNames).toContain('plan_id');
    expect(colNames).toContain('price_paise');
    expect(colNames).toContain('currency');
    expect(colNames).toContain('trial_start');
    expect(colNames).toContain('trial_end');
    expect(colNames).toContain('canceled_at');
    expect(colNames).toContain('canceled_reason');
    expect(colNames).toContain('payment_method');
  });

  test('usage_logs table has subscription_id column', () => {
    const columns = db.prepare("PRAGMA table_info(usage_logs)").all();
    const colNames = columns.map(c => c.name);
    expect(colNames).toContain('subscription_id');
  });
});
