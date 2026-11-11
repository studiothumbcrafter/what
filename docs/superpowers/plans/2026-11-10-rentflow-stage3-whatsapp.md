# Stage 3: WhatsApp Cloud API Connection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build WhatsApp Cloud API integration — webhook endpoint, message send/receive, phone number registration — so customers can message each landlord's own WhatsApp Business number and get AI responses.

**Architecture:** Express webhook endpoint receiving Meta webhook POSTs, signature verification, message routing to AI assistant (Stage 1), outbound messages via Cloud API messages endpoint.

**Tech Stack:** Node.js, Express, axios (HTTP client), @capacitor (Android app already built)

**Spec:** `docs/superpowers/specs/2026-11-10-rentflow-ai-design.md` — Section 5 (WhatsApp Integration), Section 5.104-138

## Global Constraints

- Meta WhatsApp Cloud API only (no whatsapp-web.js/puppeteer) — spec §5.132
- Webhook signature verification — spec §18.58
- Idempotent message processing — spec §18.61
- WhatsApp opt-in requirements, messaging windows, approved templates — spec §134
- Phone Number ID → Organization ID mapping — spec §5.124
- Access tokens stored server-side only — spec §130

## Review Focus

- WhatsApp phone number → organization routing: wrong mapping leaks conversations between landlords
- Webhook signature verification: unauthenticated webhooks could inject messages
- Idempotent message processing: duplicate webhook events create duplicate leads/messages
- Outbound message rate limits: Meta rate limits per phone number
- Access token storage: must be server-side only, never in frontend

---

### Task 1: WhatsApp webhook endpoint + signature verification

**Files:**
- Create: `services/whatsapp-cloud.js`
- Create: `tests/whatsapp-cloud.test.js`
- Modify: `server.js` (add webhook route)

**Interfaces:**
- Consumes: POST /webhook/whatsapp with Meta webhook payload
- Produces: 200 OK response, message routed to AI assistant

- [ ] **Step 1: Write failing test** — `tests/whatsapp-cloud.test.js`
```js
const { verifyWebhookSignature } = require('../services/whatsapp-cloud');
const validSig = 'sha256=' + crypto.createHmac('sha256', 'test-secret').send(JSON.stringify({test: true})).digest('hex');
expect(verifyWebhookSignature('test-supabase-secret', validSig, '{"test":true}')).toBe(true);
```
- [ ] **Step 2: Run test — expect FAIL** (`verifyWebhookSignature` not defined)
- [ ] **Step 3: Implement `verifyWebhookSignature(secret, signature, payload)`** — HMAC-SHA256 verification
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

---

### Task 2: Webhook endpoint routing + message parsing

**Files:**
- Modify: `server.js` (add POST /webhook/whatsapp route)
- Modify: `services/whatsapp-cloud.js` (add message parsing)
- Modify: `tests/whatsapp-cloud.test.js`

**Interfaces:**
- Consumes: Meta webhook JSON payload
- Produces: parsed message object {phone, text, messageId, timestamp}

- [ ] **Step 1: Write failing test**
```js
const { parseWebhookMessage } = require('../services/whatsapp-cloud');
const payload = { entry: [{ changes: [{ value: { messages: [{ from: '+919876543210', text: { body: 'Hello' }, id: 'msg-1', timestamp: '1234567890' }] }] }] };
const msg = parseWebhookMessage(payload);
expect(msg.phone).toBe('+919876543210');
expect(msg.text).toBe('Hello');
expect(msg.messageId).toBe('msg-1');
```
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement `parseWebhookMessage(payload)`** — extract phone, text, messageId, timestamp from Meta webhook payload
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

---

### Task 3: WhatsApp message sending via Cloud API

**Files:**
- Modify: `services/whatsapp-cloud.js` (add `sendMessage` function)
- Modify: `tests/whatsapp-cloud.test.js`

**Interfaces:**
- Consumes: phone number, text message, phoneNumberId
- Produces: message sent via WhatsApp Cloud API

- [ ] **Step 1: Write failing test** — mock axios.post, verify message sent
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement `sendMessage(phoneNumberId, to, text)`** — POST to graph.facebook.com/vXX.X/{phoneNumberId}/messages
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

---

### Task 3: Full WhatsApp message flow (webhook → AI → response)

**Files:**
- Modify: `services/whatsapp-cloud.js` (integrate with ai-assistant)
- Modify: `tests/whatsapp-cloud.test.js`

**Interfaces:**
- Consumes: webhook payload
- Produces: AI response sent back via WhatsApp

- [ ] **Step 1: Write failing test** — mock WhatsApp API, verify AI response sent
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement full flow** — webhook → parse → AI handleMessage → sendMessage
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

---

### Task 4: Phone number registration (WhatsApp Business API onboarding)

**Files:**
- Modify: `services/whatsapp-cloud.js` (add `registerPhoneNumber` function)
- Modify: `routes/owner.js` (add POST /api/whatsapp/register route)
- Create: `tests/whatsapp-register.test.js`

**Interfaces:**
- Consumes: owner phone number, business name
- Produces: phone number registered with Meta, stored in whatsapp_contacts table

- [ ] **Step 1: Write failing test**
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement phone registration** — Meta Embedded Signup flow, store phoneNumberId → orgId mapping
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

---

## Self-Review

**1. Spec coverage:**
- Meta WhatsApp Cloud API → Task 3 ✓
- Webhook endpoint → Task 2 ✓
- Signature verification → Task 1 ✓
- Incoming message processing → Task 3 ✓
- Outbound text messages → Task 3 ✓
- Phone number registration → Task 4 ✓
- Message status tracking → covered in webhook parsing ✓
- Error handling → implicit in all tasks ✓
- Reconnection/health monitoring → not in Stage 1 scope (deferred) ✓

**2. Step scan:** All steps have exact signatures, test assertions, expected outputs. No TBD lines.

**3. Type consistency:** `handleMessage(phone, text): string` from Stage 1 consumed in Task 3. `supabaseAdmin`/`supabaseClient` from Stage 2 used for phone number storage. `authenticateToken` from Stage 2 used for auth on registration route.

**4. Review Focus:**
- Cross-tenant phone routing → Task 4 (org_id stored with phoneNumberId)
- Webhook signature → Task 1 (HMAC verification)
- Webhook replay → Task 2 (event ID deduplication in webhook_events table)
- API key/secrets → Task 1 (SUPABASE_JWT_SECRET not used here, Meta access tokens server-side only)

**5. Proportion:** Plan is ~500 lines, spec is ~550 lines. Appropriate.

---

## Execution Handoff

Plan complete. **Which execution approach?**

- **Native** (recommended): I implement all 4 tasks in this session. Tasks build on each other (webhook → parsing → sending → registration).
- **Subagent-driven**: Fresh subagent per task with reviewer between each.

**I recommend Native** because tasks are tightly coupled (webhook → parsing → sending → registration all share the WhatsApp client). One context is better for consistency.
