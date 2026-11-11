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

INSERT OR IGNORE INTO plans (id, name, price_paise, billing_interval, property_limit, monthly_match_limit, monthly_visit_limit) VALUES
  ('plan-starter', 'starter', 49900, 'monthly', 10, 50, 10),
  ('plan-professional', 'professional', 99900, 'monthly', 50, 200, 50),
  ('plan-business', 'business', 199900, 'monthly', 200, 1000, 200);
