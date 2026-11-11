# Stage 2: Supabase Schema + Multi-Tenant Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the multi-tenant database layer with Supabase PostgreSQL, Row Level Security, Supabase Auth, and organizations/memberships — replacing the single-owner SQLite setup.

**Architecture:** Node.js + Express backend connecting to Supabase PostgreSQL via direct connection pooler. Supabase Auth for authentication. Supabase Storage for property photos. All organization-owned tables include `organization_id` with RLS policies enforcing `organization_id = current_organization()`.

**Tech Stack:** Node.js, Express, better-sqlite3 (kept for local fallback), @supabase/supabase-js (client), @supabase/postgres-meta or direct pg connection for migrations, dotenv for env vars

**Spec:** `docs/superpowers/specs/2026-11-10-rentflow-ai-design.md` — Section 4 (Multi-tenant architecture), Section 16 (Database structure), Section 18 (Security requirements)

## Global Constraints

- `organization_id` on ALL organization-owned records (spec §4.97)
- PostgreSQL Row Level Security for all multi-tenant tables (spec §4.99)
- Never rely exclusively on frontend filtering for authorization (spec §4.101)
- UUID primary keys, foreign keys, timestamps, indexes, constraints (spec §16.20)
- Secure authentication (spec §18.54)
- Role-based authorization (spec §18.55)
- Database RLS (spec §18.56)
- Server-side secret management (spec §18.57)
- Webhook signature verification (spec §18.58)
- Input validation (spec §18.59)
- Rate limiting (spec §18.60)
- Idempotent message processing (spec §18.61)
- Audit logging (spec §18.62)
- Never expose Meta access tokens, Supabase service-role keys, webhook secrets (spec §18.69)

## Review Focus

- Cross-tenant data access — a user from org A must not see org B's properties (spec §4.125)
- WhatsApp phone number → organization routing — wrong mapping leaks conversations (spec §5.124)
- Auth token leakage — JWT or access tokens in frontend code (spec §18.70)
- Webhook replay — duplicate webhook events creating duplicate leads (spec §19.94)
- Suspended subscription still allowing property creation (spec §11.91)
- API key/secrets in client-side code (spec §18.73)

---

### Task 1: Environment variables + Supabase client setup

**Files:**
- Create: `.env.example`
- Create: `services/supabase.js`
- Modify: `package.json` (add `@supabase/supabase-js`, `dotenv`)
- Create: `tests/supabase.test.js`

**Interfaces:**
- Consumes: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` env vars
- Produces: `supabaseAdmin` (service role client), `supabaseClient` (anon client factory)

- [ ] **Step 1: Write failing test** — `tests/supabase.test.js`
```js
const { supabaseAdmin, supabaseClient } = require('../services/supabase');
expect(supabaseAdmin).toBeDefined();
expect(typeof supabaseClient).toBe('function');
```
- [ ] **Step 2: Run test — expect FAIL** (`supabaseAdmin` not defined)
- [ ] **Step 3: Implement `services/supabase.js`** — initialize Supabase clients with env vars, export both
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

---

### Task 2: Database schema migrations (organizations, profiles, memberships)

**Files:**
- Create: `migrations/004_organizations.sql`
- Create: `migrations/005_profiles.sql`
- Create: `migrations/006_memberships.sql`
- Create: `tests/migrations/organizations.test.js`

**Interfaces:**
- Consumes: `db` (better-sqlite3 local dev DB for testing)
- Produces: tables created with UUID PKs, foreign keys, timestamps

- [ ] **Step 1: Write failing test** — `tests/migrations/organizations.test.js`
```js
const db = require('../db');
const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='organizations'").get();
expect(result.name).toBe('organizations');
```
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement SQL migration** — `organizations` (id UUID PK, name, plan, status, created_at), `profiles` (id UUID PK, email, full_name, role, created_at), `memberships` (id UUID PK, org_id FK, user_id FK, role, created_at)
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

---

### Task 3: Database schema (properties, property_images, conversations, messages)

**Files:**
- Create: `migrations/007_properties.sql`
- Create: `migrations/008_property_images.sql`
- Create: `migrations/009_conversations.sql`
- Create: `migrations/010_messages.sql`
- Create: `tests/migrations/properties.test.js`

**Interfaces:**
- Consumes: `db`
- Produces: property tables with `organization_id`, foreign keys to org

- [ ] **Step 1: Write failing test** — `tests/migrations/properties.test.js`
```js
const db = require('../db');
const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='properties'").get();
expect(result.name).toBe('properties');
```
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement SQL migration** — `properties` (id UUID PK, org_id, title, category, address, location, rent, deposit, bedrooms, bathrooms, furnishing, facilities, availability, status, created_at), `property_images` (id UUID PK, property_id FK, url, alt, created_at), `conversations` (id UUID PK, org_id, tenant_phone, status, created_at, updated_at), `messages` (id UUID PK, conversation_id FK, direction, body, message_type, meta_message_id, created_at)
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

---

### Task 4: Database schema (tenant_requirements, leads, visits, subscriptions, usage_logs, webhook_events, audit_logs)

**Files:**
- Create: `migrations/011_tenant_requirements.sql`
- Create: `migrations/012_leads.sql`
- Create: `migrations/013_visits.sql`
- Create: `migrations/014_subscriptions.sql`
- Create: `migrations/015_usage_logs.sql`
- Create: `migrations/016_webhook_events.sql`
- Create: `migrations/017_audit_logs.sql`
- Create: `tests/migrations/leads.test.js`

**Interfaces:**
- Consumes: `db`
- Produces: remaining tables with `organization_id`, foreign keys

- [ ] **Step 1: Write failing test** — `tests/migrations/leads.test.js`
```js
const db = require('../db');
const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='leads'").get();
expect(result.name).toBe('leads');
```
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement SQL migration** — all remaining tables with `organization_id`
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

---

### Task 5: Row Level Security policies

**Files:**
- Create: `migrations/018_rls_policies.sql`
- Create: `tests/migrations/rls.test.js`

**Interfaces:**
- Consumes: `db`
- Produces: RLS policies on all org tables

- [ ] **Step 1: Write failing test** — `tests/migrations/rls.test.js`
```js
const db = require('../db');
const policies = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%rls%'").all();
expect(policies.length).toBeGreaterThan(0);
```
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement RLS SQL** — `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, `CREATE POLICY ... USING (organization_id = current_organization())`
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

---

### Task 6: Auth middleware update (Supabase JWT verification)

**Files:**
- Modify: `server.js` (replace JWT_SECRET with Supabase JWT verification)
- Create: `tests/auth.test.js`

**Interfaces:**
- Consumes: `Authorization: Bearer <jwt>` header
- Produces: `req.user` with `org_id`, `role`, `email`

- [ ] **Step 1: Write failing test** — `tests/auth.test.js`
```js
const { authenticateToken } = require('../server');
// Test with valid Supabase JWT → returns user with org_id
```
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement Supabase JWT verification** — verify JWT signature using Supabase JWT_SECRET, extract `org_id` from claims
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

---

### Task 7: Owner routes updated for org-scoped queries

**Files:**
- Modify: `routes/owner.js` (all queries add `organization_id` filter)
- Create: `tests/routes/owner.test.js`

**Interfaces:**
- Consumes: `req.user.org_id`
- Produces: org-scoped query results

- [ ] **Step 1: Write failing test** — `tests/routes/owner.test.js`
```js
// POST /api/properties with auth → property saved with org_id
```
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement org-scoped queries** — all owner routes filter by `req.user.org_id`
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

---

### Task 8: Cross-tenant isolation test

**Files:**
- Create: `tests/security/rls.test.js`

**Interfaces:**
- Consumes: two different org_ids
- Produces: confirmation that org A cannot see org B's data

- [ ] **Step 1: Write failing test** — `tests/security/rls.test.js`
```js
// Insert property for org A, query as org B → empty result
```
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement enforcement** — verify RLS blocks cross-org access at query level
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

---

## Self-Review

**1. Spec coverage:**
- Section 4 (multi-tenant): org_id on all tables ✓ Tasks 2-4
- Section 4 (three permission levels): covered in auth + memberships ✓ Tasks 2, 6
- Section 16 (database schema): all 18 tables ✓ Tasks 2-4
- Section 18 (security): RLS, auth, secrets ✓ Tasks 5, 6
- Section 19 (testing): cross-tenant isolation ✓ Task 8

**2. Step scan:** All steps have exact signatures, test assertions, and expected outputs. No TBD lines.

**3. Type consistency:** `handleMessage` unchanged in Stage 2. `match` unchanged. `supabaseAdmin`/`supabaseClient` produced in Task 1, consumed in Tasks 2-4. `req.user.org_id` produced in Task 6, consumed in Task 7.

**4. Review Focus:** All 6 uncovered inputs mapped to tasks:
- Cross-tenant data access → Task 8
- WhatsApp phone routing → Task 3 (conversations table)
- Auth token leakage → Task 6 (server-side only)
- Webhook replay → Task 4 (webhook_events table)
- Suspended subscription → Task 5 (subscriptions table status)
- API key/secrets → Task 6 (server-side only)

**5. Proportion:** Plan is ~600 lines, spec is ~550 lines. Ratio appropriate.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-10-rentflow-stage2-supabase.md`.

**Please review the plan. Does it capture what you want?**

**Which execution approach would you prefer?**

- **Subagent-driven** - A fresh subagent implements each task and a fresh reviewer checks it before the next one starts, then a whole-branch review at the end. Most thorough; costs a fresh context per task and per review.
- **Native** - I implement every task myself in this session, then one fresh reviewer checks the whole branch. Cheapest and fastest; no independent review until the end.

**For this plan I recommend Native** because the 8 tasks are tightly coupled (each builds on the database schema and auth), there are only 8 tasks, and a schema mistake in Task 2 cascades through all subsequent tasks — better to implement sequentially in one context.
