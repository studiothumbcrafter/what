CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL UNIQUE,
  price_paise INTEGER NOT NULL,
  billing_interval TEXT NOT NULL DEFAULT 'monthly',
  property_limit INTEGER NOT NULL,
  monthly_match_limit INTEGER NOT NULL,
  monthly_visit_limit INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert default plans
INSERT OR IGNORE INTO plans (id, name, price_paise, billing_interval, property_limit, monthly_match_limit, monthly_visit_limit) VALUES
  ('plan-starter', 'starter', 49900, 'monthly', 10, 50, 10),
  ('plan-professional', 'professional', 99900, 'monthly', 50, 200, 50),
  ('plan-business', 'business', 199900, 'monthly', 200, 1000, 200);

-- Add subscription columns if they don't exist
ALTER TABLE subscriptions ADD COLUMN plan_id TEXT REFERENCES plans(id);
ALTER TABLE subscriptions ADD COLUMN price_paise INTEGER;
ALTER TABLE subscriptions ADD COLUMN currency TEXT DEFAULT 'INR';
ALTER TABLE subscriptions ADD COLUMN trial_start TEXT;
ALTER TABLE subscriptions ADD COLUMN trial_end TEXT;
ALTER TABLE subscriptions ADD COLUMN canceled_at TEXT;
ALTER TABLE subscriptions ADD COLUMN canceled_reason TEXT;
ALTER TABLE subscriptions ADD COLUMN payment_method TEXT;

-- Add subscription_id to usage_logs if not exists
ALTER TABLE usage_logs ADD COLUMN subscription_id TEXT;
