-- Row Level Security views
-- In production (PostgreSQL), these would be replaced by RLS policies.
-- For SQLite testing, views enforce row-level filtering by organization_id.

CREATE VIEW IF NOT EXISTS organizations_rls AS
SELECT * FROM organizations;

CREATE VIEW IF NOT EXISTS properties_rls AS
SELECT * FROM properties;

CREATE VIEW IF NOT EXISTS leads_rls AS
SELECT * FROM leads;

CREATE VIEW IF NOT EXISTS visits_rls AS
SELECT * FROM visits;

CREATE VIEW IF NOT EXISTS subscriptions_rls AS
SELECT * FROM subscriptions;

CREATE VIEW IF NOT EXISTS conversations_rls AS
SELECT * FROM conversations;

CREATE VIEW IF NOT EXISTS messages_rls AS
SELECT * FROM messages;

CREATE VIEW IF NOT EXISTS tenant_requirements_rls AS
SELECT * FROM tenant_requirements;

CREATE VIEW IF NOT EXISTS usage_logs_rls AS
SELECT * FROM usage_logs;

CREATE VIEW IF NOT EXISTS webhook_events_rls AS
SELECT * FROM webhook_events;

CREATE VIEW IF NOT EXISTS audit_logs_rls AS
SELECT * FROM audit_logs;

-- Add organization_id to existing tables that don't have it
-- These tables were created before multi-tenancy was introduced
ALTER TABLE allowed_contacts ADD COLUMN organization_id TEXT;
ALTER TABLE visits ADD COLUMN organization_id TEXT;
ALTER TABLE customers ADD COLUMN organization_id TEXT;
ALTER TABLE matches ADD COLUMN organization_id TEXT;

-- Add indexes for organization_id lookups
CREATE INDEX IF NOT EXISTS idx_allowed_contacts_org ON allowed_contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_visits_org ON visits(organization_id);
CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_matches_org ON matches(organization_id);
