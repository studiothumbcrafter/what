const { init } = require('../../db');

describe('Database migrations - Row Level Security', () => {
  let db;

  beforeAll(() => {
    db = init();
  });

  test('organizations_rls view exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='view' AND name='organizations_rls'").get();
    expect(result.name).toBe('organizations_rls');
  });

  test('properties_rls view exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='view' AND name='properties_rls'").get();
    expect(result.name).toBe('properties_rls');
  });

  test('leads_rls view exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='view' AND name='leads_rls'").get();
    expect(result.name).toBe('leads_rls');
  });

  test('visits_rls view exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='view' AND name='visits_rls'").get();
    expect(result.name).toBe('visits_rls');
  });

  test('subscriptions_rls view exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='view' AND name='subscriptions_rls'").get();
    expect(result.name).toBe('subscriptions_rls');
  });

  test('conversations_rls view exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='view' AND name='conversations_rls'").get();
    expect(result.name).toBe('conversations_rls');
  });
});
