// Subscription helpers: activation and plan-limit enforcement (Stage 5).

function getSubscription(db, orgId) {
  const row = db.prepare(`
    SELECT s.*, p.name AS plan_name,
           COALESCE(s.price_paise, p.price_paise) AS effective_price_paise,
           p.property_limit, p.monthly_match_limit, p.monthly_visit_limit
    FROM subscriptions s
    LEFT JOIN plans p ON s.plan_id = p.id
    WHERE s.organization_id = ?
  `).get(orgId);

  if (row && row.status === 'trialing' && row.trial_end) {
    if (new Date(row.trial_end).getTime() < Date.now()) {
      db.prepare("UPDATE subscriptions SET status = 'expired' WHERE id = ?").run(row.id);
      row.status = 'expired';
    }
  }
  return row;
}

function ensureTrialSubscription(db, orgId, days) {
  if (!orgId) return null;
  const existing = db.prepare(
    'SELECT id FROM subscriptions WHERE organization_id = ?'
  ).get(orgId);
  if (existing) return getSubscription(db, orgId);

  const trialEnd = new Date(Date.now() + (days || 14) * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO subscriptions
      (id, organization_id, plan, plan_id, status, price_paise, currency,
       trial_start, trial_end, created_at)
    VALUES (?, ?, 'starter', 'plan-starter', 'trialing', 49900, 'INR', datetime('now'), ?, datetime('now'))
  `).run('sub-' + orgId, orgId, trialEnd);

  return getSubscription(db, orgId);
}

function addMonth(from) {
  const date = from ? new Date(from) : new Date();
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString();
}

function activateSubscription(db, orgId, plan, payment) {
  if (!orgId) throw new Error('organization_id is required');
  if (!plan) throw new Error('plan is required');

  const renewal = addMonth();

  db.prepare(`
    INSERT INTO subscriptions
      (id, organization_id, plan, plan_id, status, price_paise, currency,
       renewal_date, payment_method, created_at)
    VALUES
      (?, ?, ?, ?, 'active', ?, 'INR', ?, 'razorpay', datetime('now'))
    ON CONFLICT(organization_id) DO UPDATE SET
      plan = excluded.plan,
      plan_id = excluded.plan_id,
      status = 'active',
      price_paise = excluded.price_paise,
      currency = excluded.currency,
      renewal_date = excluded.renewal_date,
      payment_method = excluded.payment_method
  `).run(
    'sub-' + orgId,
    orgId,
    plan.name,
    plan.id,
    plan.price_paise,
    renewal
  );

  db.prepare(`
    INSERT INTO audit_logs (organization_id, action, target_table, target_id, new_values)
    VALUES (?, 'subscription.activated', 'subscriptions', ?, ?)
  `).run(
    orgId,
    'sub-' + orgId,
    JSON.stringify({
      plan_id: plan.id,
      plan_name: plan.name,
      price_paise: plan.price_paise,
      payment_id: payment && payment.paymentId,
      order_id: payment && payment.orderId,
    })
  );

  return getSubscription(db, orgId);
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

function monthlyUsage(db, orgId, type) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(count), 0) AS total
    FROM usage_logs
    WHERE organization_id = ? AND type = ? AND date >= ?
  `).get(orgId, type, startOfMonth());
  return row ? row.total : 0;
}

function recordUsage(db, orgId, type, count) {
  db.prepare(`
    INSERT INTO usage_logs (organization_id, type, count, date)
    VALUES (?, ?, ?, ?)
  `).run(orgId, type, count || 1, new Date().toISOString().slice(0, 10));
}

// Returns the subscription or throws when no plan covers the action.
function enforceLimit(db, orgId, kind) {
  const sub = getSubscription(db, orgId);
  if (!sub) throw limitError(kind === 'property' ? 'properties' : kind, 0);

  if (['expired', 'cancelled'].includes(sub.status)) {
    throw limitError(kind === 'property' ? 'properties' : kind + 's', 0);
  }

  if (kind === 'property') {
    const count = db.prepare(
      'SELECT COUNT(*) AS count FROM properties WHERE organization_id = ?'
    ).get(orgId).count;
    if (sub.property_limit != null && count >= sub.property_limit) {
      throw limitError('properties', sub.property_limit);
    }
    return sub;
  }

  if (kind === 'match') {
    const used = monthlyUsage(db, orgId, 'match');
    if (sub.monthly_match_limit != null && used >= sub.monthly_match_limit) {
      throw limitError('matches this month', sub.monthly_match_limit);
    }
    return sub;
  }

  if (kind === 'visit') {
    const used = monthlyUsage(db, orgId, 'visit');
    if (sub.monthly_visit_limit != null && used >= sub.monthly_visit_limit) {
      throw limitError('visits this month', sub.monthly_visit_limit);
    }
    return sub;
  }

  throw new Error('Unknown limit kind: ' + kind);
}

module.exports = {
  getSubscription,
  ensureTrialSubscription,
  activateSubscription,
  enforceLimit,
  recordUsage,
  monthlyUsage,
  addMonth,
};
