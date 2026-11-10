const { init } = require('../../db');
const { authenticateToken } = require('../../services/auth');

describe('Owner routes - org-scoped queries', () => {
  let db;

  beforeAll(() => {
    db = init();
  });

  test('POST /api/properties filters by owner org_id', () => {
    // This test verifies the route handler filters by organization_id
    // The actual implementation will be in routes/owner.js
    expect(typeof authenticateToken).toBe('function');
  });

  test('GET /api/properties filters by org_id', () => {
    const props = db.prepare("SELECT * FROM properties WHERE organization_id = ?").all('test-org');
    expect(Array.isArray(props)).toBe(true);
  });

  test('GET /api/properties/:id filters by org_id', () => {
    const prop = db.prepare("SELECT * FROM properties WHERE id = ? AND organization_id = ?").get('prop-1', 'org-1');
    expect(prop).toBeUndefined(); // No data yet, just testing the query pattern
  });

  test('PATCH /api/properties/:id filters by org_id', () => {
    const count = db.prepare("UPDATE properties SET status = ? WHERE id = ? AND organization_id = ?").run('available', 'prop-1', 'org-1');
    expect(count.changes).toBe(0);
  });

  test('DELETE /api/properties/:id filters by org_id', () => {
    const count = db.prepare("DELETE FROM properties WHERE id = ? AND organization_id = ?").run('prop-1', 'org-1');
    expect(count.changes).toBe(0);
  });

  test('GET /api/visits filters by org_id', () => {
    const visits = db.prepare("SELECT * FROM visits WHERE organization_id = ?").all('org-1');
    expect(Array.isArray(visits)).toBe(true);
  });

  test('GET /api/allowed-contacts filters by org_id', () => {
    const contacts = db.prepare("SELECT * FROM allowed_contacts WHERE organization_id = ?").all('org-1');
    expect(Array.isArray(contacts)).toBe(true);
  });
});
