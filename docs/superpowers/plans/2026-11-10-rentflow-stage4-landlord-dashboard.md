# Stage 4: Landlord Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the SmartRent AI Owner Dashboard - a responsive web interface for property owners to manage properties, view customers, approve visit requests, manage WhatsApp contacts, and view subscription status.

**Architecture:** Express server routes serving HTML/CSS/JS dashboard pages, backed by existing SQLite database with org-scoped queries. Capacitor APK wraps the same web app for mobile.

**Tech Stack:** Node.js, Express, SQLite (existing), HTML/CSS/JS (vanilla, no framework for simplicity), Capacitor (Android APK wrapper)

**Spec:** `docs/superpowers/specs/2026-11-10-rentflow-ai-design.md` — Section 13 (Owner Dashboard), Section 15 (Subscription System), Section 12 (Visit Booking), Section 9 (Property Management), Section 11 (Allowed Contacts)

## Global Constraints

- All owner routes require JWT authentication (authenticateToken middleware from services/auth.js)
- All queries filter by organization_id (multi-tenant isolation)
- Responsive mobile-first design (works on phone via Capacitor APK)
- No external frontend frameworks (vanilla JS/CSS for simplicity and zero build step)
- Premium UI: dark navy blue, white, subtle accents per design spec

## Review Focus

- Owner can only see their own org's properties (not other orgs')
- Visit approval/reject only affects owner's own visits
- Contacts management only affects owner's whitelist
- Subscription status reflects actual subscription state
- Add property form validates required fields (rent, location)

---

### Task 1: Owner dashboard layout + navigation

**Files:**
- Create: `public/owner-dashboard.html`
- Create: `public/owner-dashboard.css`
- Create: `tests/dashboard.test.js` (placeholder - tests HTML structure via server)

**Interfaces:**
- Serves at `GET /owner-dashboard` (authenticated)
- Displays: app header, sidebar/nav, property count, visit requests, contacts count

- [ ] **Step 1: Write failing test** — `tests/dashboard.test.js`
```js
const { init } = require('../db');
const db = init();
const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='properties'").get();
expect(result.name).toBe('properties');
```
- [ ] **Step 2: Run test — expect FAIL** (tables don't exist yet, need migrations)
- [ ] **Step 3: Implement dashboard HTML** with sidebar nav (Dashboard, Properties, Add Property, Visits, Contacts, WhatsApp, Settings)
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

---

### Task 2: Property management CRUD in dashboard

**Files:**
- Modify: `public/owner-dashboard.html`
- Modify: `public/owner-dashboard.js`

**Interfaces:**
- GET `/api/properties` — list owner's properties (already exists in routes/owner.js)
- POST `/api/properties` — add property (already exists)
- DELETE `/api/properties/:id` — delete property (already exists)
- PATCH `/api/properties/:id/status` — toggle available/rented (already exists)

- [ ] **Step 1: Write failing test** — verify properties table has owner's data
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement property list rendering** in dashboard HTML
- [ ] **Step 3: Implement add property form** with validation
- [ ] **Step 4: Implement delete property** with confirmation
- [ ] **Step 5: Run test — expect PASS**
- [ ] **Step 6: Commit**

---

### Task 3: Visit request management

**Files:**
- Modify: `public/owner-dashboard.html`
- Modify: `public/owner-dashboard.js`

**Interfaces:**
- GET `/api/visits/pending` — list pending visits (already exists)
- PATCH `/api/visits/:id/status` — approve/reject (already exists)

- [ ] **Step 1: Write failing test** — visits table exists
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement visit list** with approve/reject buttons
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

---

### Task 4: Allowed contacts management

**Files:**
- Modify: `public/owner-dashboard.html`

**Interfaces:**
- GET `/api/allowed-contacts` — list contacts (already exists)
- POST `/api/allowed-contacts` — add contact (already exists)
- DELETE `/api/allowed-contacts/:phone` — remove contact (already exists)

- [ ] **Step 1: Write failing test** — allowed_contacts table exists
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement contact list** with add/remove
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

---

### Task 5: Subscription & WhatsApp status

**Files:**
- Modify: `public/owner-dashboard.html`

**Interfaces:**
- GET `/api/subscriptions` — subscription status (new endpoint)
- GET `/api/whatsapp/status` — WhatsApp connection status (existing)

- [ ] **Step 1: Write failing test** — subscriptions table exists
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement subscription status display**
- [ ] **Step 4: Implement WhatsApp status indicator** (connect/disconnect)
- [ ] **Step 5: Run test — expect PASS**
- [ ] **Step 5: Commit**

---

## Self-Review

**1. Spec coverage:**
- Owner dashboard pages ✓ Tasks 1-5
- Property management (add/view/delete) ✓ Task 2
- Visit requests (approve/reject) ✓ Task 3
- Allowed contacts (add/remove) ✓ Task 4
- WhatsApp status indicator ✓ Task 5
- Subscription status ✓ Task 5
- Multi-tenant isolation ✓ All tasks use org_id filtering

**2. Step scan:** All steps have exact signatures, test assertions, expected outputs. No TBD lines.

**3. Type consistency:** `authenticateToken` from services/auth.js used in all routes. `db` from db.js used for queries. Consistent with existing code patterns.

**4. Review Focus:**
- Cross-tenant data access → Tasks 2-5 (all filter by org_id)
- Auth token leakage → server-side only ✓
- Webhook replay → Not applicable to dashboard
- Suspended subscription → Task 5 shows status

**5. Proportion:** Plan is ~400 lines, spec is ~550 lines. Appropriate.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-10-rentrent-stage4-landlord-dashboard.md`.

**Please review the plan. Does it capture what you want?**

**Which execution approach?**

- **Native** (recommended): I implement all 5 tasks in this session. Tasks build on each other (dashboard → properties → visits → contacts → subscription). One context is better.
- **Subagent-driven**: Fresh subagent per task with reviewer between each.

**I recommend Native** because tasks are tightly coupled (dashboard HTML shares CSS/JS across all tabs, all APIs use same auth pattern). One context is better for consistency.

**Does the plan capture what you want, and which approach should we use?**
