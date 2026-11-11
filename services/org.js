// Owner organization resolution.
// The current admin app signs in with a single owner account. That account is
// mapped to one organization so subscription and usage queries stay tenant-scoped.

const OWNER_ORG_ID = 'org-owner-default';

function ensureOwnerOrg(db) {
  const own = db.prepare('SELECT id FROM organizations WHERE id = ?').get(OWNER_ORG_ID);
  if (own) return own.id;

  // Legacy databases already have an organization; attach the owner to it.
  const existing = db.prepare('SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1').get();
  if (existing) return existing.id;

  db.prepare(
    "INSERT INTO organizations (id, name, plan, status) VALUES (?, 'Owner Organization', 'starter', 'active')"
  ).run(OWNER_ORG_ID);
  return OWNER_ORG_ID;
}

function backfillOrganization(db, orgId) {
  const tables = ['properties', 'visits', 'customers', 'matches', 'allowed_contacts'];
  const stmt = tables.map((table) =>
    db.prepare(`UPDATE ${table} SET organization_id = ? WHERE organization_id IS NULL OR organization_id = ''`)
  );
  const run = db.transaction(() => {
    stmt.forEach((s) => s.run(orgId));
  });
  run();
}

module.exports = { ensureOwnerOrg, backfillOrganization, OWNER_ORG_ID };
