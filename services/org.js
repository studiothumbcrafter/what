// Owner organization resolution.
// The current admin app signs in with a single owner account. That account is
// mapped to one organization so subscription and usage queries stay tenant-scoped.

const OWNER_ORG_ID = 'org-owner-default';

async function ensureOwnerOrg(db) {
  const own = await db.get('SELECT id FROM organizations WHERE id = ?', [OWNER_ORG_ID]);
  if (own) return own.id;

  // Legacy databases already have an organization; attach the owner to it.
  const existing = await db.get('SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1');
  if (existing) return existing.id;

  await db.run(
    "INSERT INTO organizations (id, name, plan, status) VALUES (?, 'Owner Organization', 'starter', 'active')",
    [OWNER_ORG_ID]
  );
  return OWNER_ORG_ID;
}

async function backfillOrganization(db, orgId) {
  const tables = ['properties', 'visits', 'customers', 'matches', 'allowed_contacts'];
  await db.transaction(async function (tx) {
    for (const table of tables) {
      await tx.run(
        `UPDATE ${table} SET organization_id = ? WHERE organization_id IS NULL OR organization_id = ''`,
        [orgId]
      );
    }
  });
}

module.exports = { ensureOwnerOrg, backfillOrganization, OWNER_ORG_ID };
