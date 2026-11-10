const { init } = require('../../db');

describe('Cross-tenant isolation', () => {
  let db;

  beforeAll(() => {
    db = init();
  });

  test('org A properties not visible to org B queries', () => {
    // Insert properties for two different orgs
    db.prepare("INSERT OR IGNORE INTO properties (id, organization_id, title, rent, location, bedrooms, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
      'prop-a-1', 'org-a', 'Org A Property 1', 12000, 'mumbai', 2, 'available', new Date().toISOString()
    );
    db.prepare("INSERT OR IGNORE INTO properties (id, organization_id, title, rent, location, bedrooms, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
      'prop-b-1', 'org-b', 'Org B Property 1', 15000, 'delhi', 3, 'available', new Date().toISOString()
    );

    // Query as org A - should only see org A's properties
    const orgAProps = db.prepare("SELECT * FROM properties WHERE organization_id = ? AND status = 'available'").all('org-a');
    expect(orgAProps.length).toBe(1);
    expect(orgAProps[0].title).toBe('Org A Property 1');

    // Query as org B - should only see org B's properties
    const orgBProps = db.prepare("SELECT * FROM properties WHERE organization_id = ? AND status = 'available'").all('org-b');
    expect(orgBProps.length).toBe(1);
    expect(orgBProps[0].title).toBe('Org B Property 1');

    // Org B should NOT see org A's properties
    const orgBPropsWrong = db.prepare("SELECT * FROM properties WHERE organization_id = ? AND id = ?").all('org-b', 'prop-a-1');
    expect(orgBPropsWrong.length).toBe(0);
  });

  test('visits table isolation by org_id', () => {
    db.prepare("INSERT OR IGNORE INTO visits (id, organization_id, property_id, status, phone, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      'visit-a-1', 'org-a', 'prop-a-1', 'pending', '+919876543210', new Date().toISOString()
    );
    db.prepare("INSERT OR IGNORE INTO visits (id, organization_id, property_id, status, phone, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      'visit-b-1', 'org-b', 'prop-b-1', 'pending', '+919876543211', new Date().toISOString()
    );

    const orgAVisits = db.prepare("SELECT * FROM visits WHERE organization_id = ?").all('org-a');
    expect(orgAVisits.length).toBe(1);
    expect(orgAVisits[0].id).toBe('visit-a-1');

    const orgBVisits = db.prepare("SELECT * FROM visits WHERE organization_id = ?").all('org-b');
    expect(orgBVisits.length).toBe(1);
    expect(orgBVisits[0].id).toBe('visit-b-1');
  });

  test('ledger table has organization_id', () => {
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
