-- Consolidated PostgreSQL schema for RentFlow AI.
-- Mirrors the final SQLite schema; safe to run on every start.

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'starter',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TEXT NOT NULL DEFAULT (now()::text),
  UNIQUE (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  price_paise INTEGER NOT NULL,
  billing_interval TEXT NOT NULL DEFAULT 'monthly',
  property_limit INTEGER NOT NULL,
  monthly_match_limit INTEGER NOT NULL,
  monthly_visit_limit INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (now()::text)
);

INSERT INTO plans (id, name, price_paise, billing_interval, property_limit, monthly_match_limit, monthly_visit_limit)
VALUES
  ('plan-starter', 'starter', 49900, 'monthly', 10, 50, 10),
  ('plan-professional', 'professional', 99900, 'monthly', 50, 200, 50),
  ('plan-business', 'business', 199900, 'monthly', 200, 1000, 200)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  title TEXT,
  rent INTEGER NOT NULL,
  location TEXT NOT NULL,
  bedrooms INTEGER,
  bathrooms INTEGER,
  furnishing TEXT,
  parking INTEGER DEFAULT 0,
  balcony INTEGER DEFAULT 0,
  floor INTEGER,
  facilities TEXT,
  availability_date TEXT,
  info TEXT,
  status TEXT DEFAULT 'available',
  created_at TEXT NOT NULL,
  organization_id TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS property_media (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('photo', 'video')),
  file_path TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS property_images (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  url TEXT NOT NULL,
  alt TEXT,
  created_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS customers (
  phone TEXT PRIMARY KEY,
  name TEXT,
  requirements TEXT,
  state TEXT DEFAULT 'collecting',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  organization_id TEXT
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'assistant')),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'inbound',
  body TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  meta_message_id TEXT,
  created_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  property_id TEXT NOT NULL,
  shown_at TEXT NOT NULL,
  organization_id TEXT
);

CREATE TABLE IF NOT EXISTS allowed_contacts (
  phone TEXT PRIMARY KEY,
  name TEXT,
  added_at TEXT NOT NULL,
  organization_id TEXT
);

CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  property_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  visit_date TEXT,
  visit_time TEXT,
  message TEXT,
  created_at TEXT NOT NULL,
  organization_id TEXT
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  tenant_phone TEXT NOT NULL,
  name TEXT,
  requirements TEXT,
  budget INTEGER,
  status TEXT NOT NULL DEFAULT 'new',
  property_ids TEXT,
  created_at TEXT NOT NULL DEFAULT (now()::text),
  updated_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'starter',
  plan_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  price_paise INTEGER,
  currency TEXT DEFAULT 'INR',
  renewal_date TEXT,
  trial_start TEXT,
  trial_end TEXT,
  canceled_at TEXT,
  canceled_reason TEXT,
  payment_method TEXT,
  message_usage INTEGER DEFAULT 0,
  ai_usage INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS usage_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  subscription_id TEXT,
  type TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  event_id TEXT NOT NULL UNIQUE,
  processed_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  target_table TEXT,
  target_id TEXT,
  old_values TEXT,
  new_values TEXT,
  created_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_org ON properties(organization_id);
CREATE INDEX IF NOT EXISTS idx_media_property ON property_media(property_id);
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone);
CREATE INDEX IF NOT EXISTS idx_matches_phone ON matches(phone);
CREATE INDEX IF NOT EXISTS idx_matches_org ON matches(organization_id);
CREATE INDEX IF NOT EXISTS idx_allowed_contacts_org ON allowed_contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_visits_phone ON visits(phone);
CREATE INDEX IF NOT EXISTS idx_visits_property ON visits(property_id);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);
CREATE INDEX IF NOT EXISTS idx_visits_org ON visits(organization_id);
CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_org ON usage_logs(organization_id, type, date);
CREATE INDEX IF NOT EXISTS idx_webhook_events_org ON webhook_events(organization_id);

-- SQLite gave every TEXT PRIMARY KEY a random default. Postgres has no
-- equivalent column default, and some inserts (usage_logs) omit the id,
-- so set one explicitly. ALTER is idempotent and also fixes tables that
-- were created before these defaults existed.
ALTER TABLE organizations ALTER COLUMN id SET DEFAULT (md5(random()::text));
ALTER TABLE profiles ALTER COLUMN id SET DEFAULT (md5(random()::text));
ALTER TABLE memberships ALTER COLUMN id SET DEFAULT (md5(random()::text));
ALTER TABLE plans ALTER COLUMN id SET DEFAULT (md5(random()::text));
ALTER TABLE properties ALTER COLUMN id SET DEFAULT (md5(random()::text));
ALTER TABLE property_media ALTER COLUMN id SET DEFAULT (md5(random()::text));
ALTER TABLE property_images ALTER COLUMN id SET DEFAULT (md5(random()::text));
ALTER TABLE conversations ALTER COLUMN id SET DEFAULT (md5(random()::text));
ALTER TABLE messages ALTER COLUMN id SET DEFAULT (md5(random()::text));
ALTER TABLE matches ALTER COLUMN id SET DEFAULT (md5(random()::text));
ALTER TABLE visits ALTER COLUMN id SET DEFAULT (md5(random()::text));
ALTER TABLE leads ALTER COLUMN id SET DEFAULT (md5(random()::text));
ALTER TABLE subscriptions ALTER COLUMN id SET DEFAULT (md5(random()::text));
ALTER TABLE usage_logs ALTER COLUMN id SET DEFAULT (md5(random()::text));
ALTER TABLE webhook_events ALTER COLUMN id SET DEFAULT (md5(random()::text));
ALTER TABLE audit_logs ALTER COLUMN id SET DEFAULT (md5(random()::text));
