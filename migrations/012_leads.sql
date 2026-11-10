CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  organization_id TEXT NOT NULL,
  tenant_phone TEXT NOT NULL,
  name TEXT,
  requirements TEXT,
  budget INTEGER,
  status TEXT NOT NULL DEFAULT 'new',
  property_ids TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
