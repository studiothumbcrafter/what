const { init } = require('../../db');

describe('Database migrations - remaining tables', () => {
  let db;

  beforeAll(() => {
    db = init();
  });

  test('tenant_requirements table exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tenant_requirements'").get();
    expect(result.name).toBe('tenant_requirements');
  });

  test('leads table exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='leads'").get();
    expect(result.name).toBe('leads');
  });

  test('visits table exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='visits'").get();
    expect(result.name).toBe('visits');
  });

  test('subscriptions table exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='subscriptions'").get();
    expect(result.name).toBe('subscriptions');
  });

  test('usage_logs table exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='usage_logs'").get();
    expect(result.name).toBe('usage_logs');
  });

  test('webhook_events table exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='webhook_events'").get();
    expect(result.name).toBe('webhook_events');
  });

  test('audit_logs table exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_logs'").get();
    expect(result.name).toBe('audit_logs');
  });

  test('leads table has organization_id', () => {
    const columns = db.prepare("PRAGMA table_info(leads)").all();
    const colNames = columns.map(c => c.name);
    expect(colNames).toContain('organization_id');
  });

  test('subscriptions table has organization_id', () => {
    const columns = db.prepare("PRAGMA table_info(subscriptions)").all();
    const colNames = columns.map(c => c.name);
    expect(colNames).toContain('organization_id');
  });
});
