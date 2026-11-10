CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  organization_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  UNIQUE(event_id)
);
