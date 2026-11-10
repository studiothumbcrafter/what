const { init } = require('../../db');

describe('Database migrations - organizations, profiles, memberships', () => {
  let db;

  beforeAll(() => {
    db = init();
  });

  test('organizations table exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='organizations'").get();
    expect(result.name).toBe('organizations');
  });

  test('organizations has required columns', () => {
    const columns = db.prepare("PRAGMA table_info(organizations)").all();
    const colNames = columns.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('name');
    expect(colNames).toContain('plan');
    expect(colNames).toContain('status');
    expect(colNames).toContain('created_at');
  });

  test('profiles table exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='profiles'").get();
    expect(result.name).toBe('profiles');
  });

  test('memberships table exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='memberships'").get();
    expect(result.name).toBe('memberships');
  });

  test('memberships has foreign keys to organizations and profiles', () => {
    const fkInfo = db.prepare("PRAGMA foreign_key_list(memberships)").all();
    const fkTables = fkInfo.map(f => f.table);
    expect(fkTables).toContain('organizations');
    expect(fkTables).toContain('profiles');
  });
});
