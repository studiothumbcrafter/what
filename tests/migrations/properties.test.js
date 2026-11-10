const { init } = require('../../db');

describe('Database migrations - properties, property_images, conversations, messages', () => {
  let db;

  beforeAll(() => {
    db = init();
  });

  test('properties table exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='properties'").get();
    expect(result.name).toBe('properties');
  });

  test('properties has organization_id column', () => {
    const columns = db.prepare("PRAGMA table_info(properties)").all();
    const colNames = columns.map(c => c.name);
    expect(colNames).toContain('organization_id');
    expect(colNames).toContain('id');
    expect(colNames).toContain('title');
    expect(colNames).toContain('rent');
    expect(colNames).toContain('location');
    expect(colNames).toContain('status');
  });

  test('property_images table exists with foreign key', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='property_images'").get();
    expect(result.name).toBe('property_images');
    const fkInfo = db.prepare("PRAGMA foreign_key_list(property_images)").all();
    const fkTables = fkInfo.map(f => f.table);
    expect(fkTables).toContain('properties');
  });

  test('conversations table exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='conversations'").get();
    expect(result.name).toBe('conversations');
  });

  test('messages table exists', () => {
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'").get();
    expect(result.name).toBe('messages');
  });
});
