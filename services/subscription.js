// Subscription helpers: trials and plan-limit enforcement (Stage 5).
// All queries go through the async db adapter (SQLite for tests, Postgres in production).

async function getSubscription(db, orgId) {
  const row = await db.get(`
    SELECT s.*, p.name AS plan_name,
           COALESCE(s.price_paise, p.price_paise) AS effective_price_paise,
           p.property_limit, p.monthly_match_limit, p.monthly_visit_limit
    FROM subscriptions s
    LEFT JOIN plans p ON s.plan_id = p.id
    WHERE s.organization_id = ?
  `, [orgId]);

  if (row && row.status === 'trialing' && row.trial_end) {
    if (new Date(row.trial_end).getTime() < Date.now()) {
      await db.run("UPDATE subscriptions SET status = 'expired' WHERE id = ?", [row.id]);
      row.status = 'expired';
    }
  }
  return row;
}

async function ensureTrialSubscription(db, orgId, days) {
  if (!orgId) return null;
  const existing = await db.get(
    'SELECT id FROM subscriptions WHERE organization_id = ?',
    [orgId]
  );
  if (existing) return await getSubscription(db, orgId);

  const nowIso = new Date().toISOString();
  const trialEnd = new Date(Date.now() + (days || 14) * 24 * 60 * 60 * 1000).toISOString();
  await db.run(`
    INSERT INTO subscriptions
      (id, organization_id, plan, plan_id, status, price_paise, currency,
       trial_start, trial_end, created_at)
    VALUES (?, ?, 'starter', 'plan-starter', 'trialing', 49900, 'INR', ?, ?, ?)
  `, ['sub-' + orgId, orgId, nowIso, trialEnd, nowIso]);

  return await getSubscription(db, orgId);
}

function limitError(kind, limit) {
  const err = new Error(
    'Plan limit reached: your plan allows ' + limit + ' ' + kind + '. Upgrade to add more.'
  );
  err.statusCode = 403;
  err.code = 'PLAN_LIMIT_REACHED';
  return err;
}

function startOfMonth() {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

async function monthlyUsage(db, orgId, type) {
  const row = await db.get(`
    SELECT COALESCE(SUM(count), 0) AS total
    FROM usage_logs
    WHERE organization_id = ? AND type = ? AND date >= ?
  `, [orgId, type, startOfMonth()]);
  return row ? Number(row.total) : 0;
}

async function recordUsage(db, orgId, type, count) {
  await db.run(`
    INSERT INTO usage_logs (organization_id, type, count, date)
    VALUES (?, ?, ?, ?)
  `, [orgId, type, count || 1, new Date().toISOString().slice(0, 10)]);
}

// Returns the subscription or throws when no plan covers the action.
async function enforceLimit(db, orgId, kind) {
  const sub = await getSubscription(db, orgId);
  if (!sub) throw limitError(kind === 'property' ? 'properties' : kind, 0);

  if (['expired', 'cancelled'].includes(sub.status)) {
    throw limitError(kind === 'property' ? 'properties' : kind + 's', 0);
  }

  if (kind === 'property') {
    const row = await db.get(
      'SELECT COUNT(*) AS count FROM properties WHERE organization_id = ?',
      [orgId]
    );
    const count = Number(row ? row.count : 0);
    if (sub.property_limit != null && count >= Number(sub.property_limit)) {
      throw limitError('properties', sub.property_limit);
    }
    return sub;
  }

  if (kind === 'match') {
    const used = await monthlyUsage(db, orgId, 'match');
    if (sub.monthly_match_limit != null && used >= Number(sub.monthly_match_limit)) {
      throw limitError('matches this month', sub.monthly_match_limit);
    }
    return sub;
  }

  if (kind === 'visit') {
    const used = await monthlyUsage(db, orgId, 'visit');
    if (sub.monthly_visit_limit != null && used >= Number(sub.monthly_visit_limit)) {
      throw limitError('visits this month', sub.monthly_visit_limit);
    }
    return sub;
  }

  throw new Error('Unknown limit kind: ' + kind);
}

module.exports = {
  getSubscription,
  ensureTrialSubscription,
  enforceLimit,
  recordUsage,
  monthlyUsage,
};
