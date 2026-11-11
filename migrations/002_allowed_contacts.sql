CREATE TABLE IF NOT EXISTS allowed_contacts (
  phone TEXT PRIMARY KEY,
  name TEXT,
  added_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_allowed_contacts_phone ON allowed_contacts(phone);
