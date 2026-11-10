-- Add organization_id to existing properties table
ALTER TABLE properties ADD COLUMN organization_id TEXT NOT NULL DEFAULT '';

-- Add foreign key constraint via index for lookup
CREATE INDEX IF NOT EXISTS idx_properties_org ON properties(organization_id);
