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

module.exports = { ensureOwnerOrg, OWNER_ORG_ID };
