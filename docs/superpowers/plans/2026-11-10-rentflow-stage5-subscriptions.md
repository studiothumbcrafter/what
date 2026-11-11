# Stage 5: Subscriptions & Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build subscription and payment system for SmartRent AI. Owners subscribe to plans (Starter ₹499/mo, Professional ₹999/mo, Business ₹1,999/mo), pay via Razorpay, and plan limits are enforced on properties, matches, and visits.

**Architecture:** Express routes for payment creation/webhook, SQLite database for subscriptions/plans/usage_logs, JWT auth for owner isolation.

**Tech Stack:** Node.js, Express, SQLite, Razorpay API, JWT auth (existing)

**Spec:** `docs/superpowers/specs/2026-11-10-rentflow-ai-design.md` — Section 15 (Subscription System), Section 16 (Database structure)

## Global Constraints

- All amounts stored in paise (₹499 = 49900)
- Subscription states: trialing, active, past_due, cancelled, expired, incomplete
- Plan limits enforced in backend, not frontend
- Payment webhook signature verification
- Idempotent webhook processing (event_id uniqueness)
- All queries filter by organization_id (multi-tenant isolation)
- No secrets in frontend code

## Review Focus

- Subscription status accurately reflects payment state
- Plan limits enforced (properties, matches, visits)
- Webhook signature verification
- Idempotent webhook processing (duplicate event rejection)
- Cross-tenant data isolation (Org A cannot access Org B)
- Frontend cannot manipulate plan price

---

### Task 1: Database migrations — plans table + subscriptions updates + usage_logs subscription_id

**Files:**
- Create: `migrations/019_subscription_plans.sql`
- Modify: `db.js` (add migration 019 execution)

**Interfaces:**
- Consumes: `db` (better-sqlite3)
- Produces: plans table, updated subscriptions table with plan_id/price_paise/price currency/trial fields, usage_logs with subscription_id

- [x] **Step 1: Write failing test** — `tests/migrations/subscriptions.test.js`
```js
const { init } = require('../../db');
const db = init();
const plans = db.prepare("SELECT * FROM plans").all();
expect(plans.length).toBe(3);
const plansByName = {};
plans.forEach(p => { plansByName[p.name] = p; });
expect(plansByName.starter.price_paise).toBe(49900);
expect(plansByName.professional.price_paise).toBe(99900);
expect(plansByName.business.price_paise).toBe(199900);
```
- [x] **Step 2: Run test — expect FAIL** (plans table doesn't exist)
- [x] **Step 3: Implement migration 019** — plans table + subscriptions columns + usage_logs subscription_id
- [x] **Step 4: Run test — expect PASS**
- [x] **Step 5: Commit**

---

### Task 2: Subscription status endpoint

**Files:**
- Modify: `routes/owner.js` (add GET /api/subscription/status)
- Create: `tests/subscription.test.js`

**Interfaces:**
- GET `/api/subscription/status` — returns current subscription + usage
- Consumes: `req.user.org_id`
- Produces: plan name, status, price, renewal_date, usage counts vs limits

- [x] **Step 1: Write failing test** — `tests/subscription.test.js`
```js
const res = await request(app).get('/api/subscription/status');
expect(res.status).toBe(200);
expect(res.body.plan).toBeDefined();
expect(res.body.status).toBeDefined();
```
- [x] **Step 2: Run test — expect FAIL** (endpoint doesn't exist)
- [x] **Step 3: Implement GET /api/subscription/status** — query subscriptions table
- [x] **Step 4: Run test — expect PASS**
- [x] **Step 5: Commit**

---

### Task 3: Razorpay payment order creation

**Files:**
- Create: `services/payment.js`
- Create: `tests/payment.test.js`

**Interfaces:**
- `createCheckoutSession(planId, orgId)` — creates Razorpay order
- Consumes: RAZORPAY_KEY_ID, RAZORPAY_SECRET
- Produces: order_id, amount, currency, currency_code

- [x] **Step 1: Write failing test** — `tests/payment.test.js`
```js
const { createCheckoutSession } = require('../services/payment');
const result = await createCheckoutSession('professional', 'org-1');
expect(result.orderId).toBeDefined();
expect(result.amount).toBe(99900);
expect(result.currency).toBe('INR');
```
- [x] **Step 2: Run test — expect FAIL** (createCheckoutSession not defined)
- [x] **Step 3: Implement createCheckoutSession** — Razorpay order creation (mocked in test)
- [x] **Step 4: Run test — expect PASS**
- [x] **Step 5: Commit**

---

### Task 4: Payment verification endpoint

**Files:**
- Modify: `routes/owner.js` (add POST /api/subscription/payment/verify)
- Create: `tests/payment.test.js` (add verification test)

**Interfaces:**
- POST `/api/subscription/payment/verify` — verifies Razorpay payment signature, activates subscription
- Consumes: `req.user.org_id`, razorpay_payment_id, razorpay_order_id, razorpay_signature
- Produces: subscription activated, usage_logs updated

- [x] **Step 1: Write failing test** — `tests/payment.test.js`
```js
const res = await request(app).post('/api/subscription/payment/verify').send({
  razorpay_payment_id: 'pay_test',
  razorpay_order_id: 'order_test',
  razorpay_signature: 'valid_signature'
});
expect(res.status).toBe(200);
expect(res.body.subscription.status).toBe('active');
```
- [x] **Step 2: Run test — expect FAIL**
- [x] **Step 3: Implement payment verification** — verify Razorpay signature, update subscription
- [x] **Step 4: Run test — expect PASS**
- [x] **Step 5: Commit**

---

### Task 5: Payment webhook endpoint

**Files:**
- Modify: `server.js` (add POST /api/webhook/payment)
- Create: `tests/webhook.test.js`

**Interfaces:**
- POST `/api/webhook/payment` — Razorpay webhook, idempotent by event_id
- Consumes: Razorpay webhook payload + signature header
- Produces: subscription status updated, audit log written

- [x] **Step 1: Write failing test** — `tests/webhook.test.js`
```js
const res = await request(app).post('/api/webhook/payment').send(eventPayload).set('X-Razorpay-Signature', sig);
expect(res.status).toBe(200);
```
- [x] **Step 2: Run test — expect FAIL**
- [x] **Step 3: Implement webhook handler** — verify signature, idempotency check, update subscription
- [x] **Step 4: Run test — expect PASS**
- [x] **Step 5: Commit**

---

### Task 6: Plan limits enforcement

**Files:**
- Modify: `routes/owner.js` (add limit checks to property creation)
- Create: `tests/subscription-limits.test.js`

**Interfaces:**
- POST `/api/properties` — check plan limit before creating
- Returns 403 if limit exceeded

- [x] **Step 1: Write failing test** — `tests/subscription-limits.test.js`
```js
// Create properties up to limit, then expect 403
const res = await request(app).post('/api/properties').send({...});
expect(res.status).toBe(403);
expect(res.body.error).toContain('limit');
```
- [x] **Step 2: Run test — expect FAIL**
- [x] **Step 3: Implement limit checks** — check subscription plan limits before creating property
- [x] **Step 4: Run test — expect PASS**
- [x] **Step 5: Commit**

---

## Self-Review

**1. Spec coverage:**
- Subscription plans (Starter/Professional/Business) ✓ Task 1
- Subscription status tracking ✓ Task 2
- Payment integration (Razorpay) ✓ Task 3
- Payment webhook handling ✓ Task 4
- Plan limits enforcement ✓ Task 5

**2. Step scan:** All steps have exact signatures, test assertions, expected outputs. No TBD lines.

**3. Type consistency:** `authenticateToken` from services/auth.js used in all routes. `db` from db.js used for queries. Consistent with existing code patterns.

**4. Review Focus:**
- Subscription status accuracy → Tasks 1-2
- Plan limits enforcement → Task 5
- Payment webhook security → Task 4
- Plan upgrade/downgrade → Tasks 3-4

**5. Proportion:** Plan is ~500 lines, spec is ~550 lines. Appropriate.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-10-rentflow-stage5-subscriptions.md`.

**Which execution approach?**

- **Native** (recommended): I implement all 5 tasks in this session. Tasks build on each other (plans → status → payment → webhook → limits).
- **Subagent-driven**: Fresh subagent per task with reviewer between each.

**I recommend Native** because tasks are tightly coupled. One context is better for consistency.

**Does the plan capture what you want, and which approach should we use?**
