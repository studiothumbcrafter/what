CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  organization_id TEXT NOT NULL,
  lead_id TEXT,
  property_id TEXT,
  requested_date TEXT,
  requested_time TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (property_id) REFERENCES properties(id)
);
