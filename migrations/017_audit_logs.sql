CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  organization_id TEXT,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  target_table TEXT,
  target_id TEXT,
  old_values TEXT,
  new_values TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
