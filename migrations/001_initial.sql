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
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS property_media (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('photo', 'video')),
  file_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customers (
  phone TEXT PRIMARY KEY,
  name TEXT,
  requirements TEXT,
  state TEXT DEFAULT 'collecting',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'assistant')),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  property_id TEXT NOT NULL,
  shown_at TEXT NOT NULL,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_media_property ON property_media(property_id);
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone);
CREATE INDEX IF NOT EXISTS idx_matches_phone ON matches(phone);
