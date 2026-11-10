CREATE TABLE IF NOT EXISTS usage_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  organization_id TEXT NOT NULL,
  type TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  date TEXT NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
