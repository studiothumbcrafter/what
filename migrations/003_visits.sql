CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  property_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  visit_date TEXT,
  visit_time TEXT,
  message TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_visits_phone ON visits(phone);
CREATE INDEX IF NOT EXISTS idx_visits_property ON visits(property_id);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);
