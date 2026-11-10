CREATE TABLE IF NOT EXISTS tenant_requirements (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  organization_id TEXT NOT NULL,
  tenant_phone TEXT NOT NULL,
  category TEXT,
  location TEXT,
  budget_max INTEGER,
  bedrooms INTEGER,
  bathrooms INTEGER,
  furnishing TEXT,
  family_bachelor TEXT,
  amenities TEXT,
  move_in_date TEXT,
  visit_preference TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
