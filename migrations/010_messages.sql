CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  conversation_id TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'inbound',
  body TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  meta_message_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);
