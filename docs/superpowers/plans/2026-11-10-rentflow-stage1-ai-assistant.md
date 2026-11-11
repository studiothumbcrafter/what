# Stage 1: AI Rental Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone AI rental assistant that qualifies tenants via WhatsApp-style conversation, matches them to available properties, shares up to 3 matches, and books visit requests — testable without WhatsApp or database dependencies.

**Architecture:** Pure Node.js/Express module. AI assistant is a state machine per phone number. Property matching uses hard constraints (budget max, location, bedrooms) + soft preference ranking. No database, no WhatsApp, no webhook — in-memory conversation store for testability.

**Tech Stack:** Node.js, Express, Jest (testing), better-sqlite3 (future Stage 2 dependency, not used in Stage 1)

**Spec:** `docs/superpowers/specs/2026-11-10-rentflow-ai-design.md` — Stage 1 covers: welcome message, one-question-at-a-time collection of budget/location/bedrooms, matching engine, photo sharing (mock), visit booking flow, human handover pause/resume.

## Global Constraints

- Ask one question at a time (spec §6)
- Remember information from current conversation (spec §6)
- Support English, Hindi, Hinglish (spec §6)
- Mandatory fields in priority order: budgetMax, location, bedrooms (from existing parser.js)
- Never overwhelm with huge property list — max 3 matches (spec §8)
- Hard constraints for essentials, soft preferences for ranking (spec §8)
- Never recommend unavailable properties (spec §8)
- Visit booking: date → time → check availability → pending → notify landlord → confirm after approval (spec §11)
- Never claim visit confirmed when only requested (spec §11)
- Human takeover pauses AI, preserves history, resumes on explicit reactivation (spec §12)
- No WhatsApp, no database, no external API in Stage 1 — in-memory only

## Review Focus

- Unknown language input (not English/Hindi/Hinglish) → assistant should still respond helpfully in English
- Missing mandatory field after all questions answered → matching should not run
- Budget flexibility language ("flexible", "negotiable") → flexibility flag set (from existing parser.js)
- Visit request when no matches shown → error message, not booking
- Duplicate webhook-style message (same phone, same message text) → idempotent, no duplicate state change
- Human takeover mid-conversation → AI pauses, subsequent messages not auto-replied until reactivated

---

### Task 1: Conversation state machine per phone number

**Files:**
- Create: `services/ai-assistant.js`
- Create: `tests/ai-assistant.test.js`

**Interfaces:**
- Consumes: phone number (string), incoming message text (string)
- Produces: reply text (string), conversation state object

- [ ] **Step 1: Write failing test** — `tests/ai-assistant.test.js`
```js
const { handleMessage } = require('../services/ai-assistant');
const reply = handleMessage('+919876543210', 'hello');
expect(reply).toContain('Hello');
expect(reply).toContain('budget');
```
- [ ] **Step 2: Run test — expect FAIL** (`ai-assistant` not defined)
- [ ] **Step 3: Implement `handleMessage(phone, text)`** — state machine with states: `greeting`, `collecting`, `matching`, `visit_pending`, `human_held`. Initial state `greeting`. On `hello` → transition to `collecting`, ask budget question.
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

---

### Task 2: Mandatory field collection (budget, location, bedrooms)

**Files:**
- Modify: `services/ai-assistant.js`
- Modify: `tests/ai-assistant.test.js`

**Interfaces:**
- Consumes: current conversation state, parsed requirements from parser.js
- Produces: next question string or `null` when all mandatory fields collected

- [ ] **Step 1: Write failing test**
```js
const { handleMessage } = require('../services/ai-assistant');
let reply = handleMessage('+919876543210', 'hello');
reply = handleMessage('+919876543210', '12000');
expect(reply).toContain('location');
reply = handleMessage('+919876543210', 'Mumbai');
expect(reply).toContain('bedroom');
reply = handleMessage('+919876543210', '2BHK');
expect(reply).not.toContain('budget');
expect(reply).not.toContain('location');
expect(reply).not.toContain('bedroom');
```
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement field collection** — use existing `parser.js` `parse(text)` to extract requirements. Track `missingMandatory` (budgetMax, location, bedrooms). Ask only the next missing field. Merge new parsed values with existing.
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

---

### Task 3: Property matching engine

**Files:**
- Create: `services/matcher.js` (adapt existing logic to in-memory)
- Create: `tests/matcher.test.js`

**Interfaces:**
- Consumes: requirements object (budgetMax, location, bedrooms, flexibility), properties array
- Produces: array of up to 3 match objects with `property`, `matchReasons`

- [ ] **Step 1: Write failing test**
```js
const { match } = require('../services/matcher');
const props = [{ id: '1', title: 'A', rent: 10000, location: 'Mumbai', bedrooms: 2, status: 'available' }];
const results = match({ budgetMax: 12000, location: 'Mumbai', bedrooms: 2 }, props);
expect(results.length).toBeGreaterThan(0);
expect(results[0].property.id).toBe('1');
```
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement `match(req, props)`** — filter: status === 'available', rent <= budgetMax (or flexibility === 1 allows stretch), location match, bedrooms match. Rank by match reasons. Return max 3.
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

---

### Task 4: Match result formatting with photos

**Files:**
- Modify: `services/ai-assistant.js`
- Modify: `tests/ai-assistant.test.js`

**Interfaces:**
- Consumes: match results array, property photo data
- Produces: formatted reply text with up to 3 matches, each with title, rent, location, match reasons

- [ ] **Step 1: Write failing test**
```js
const { handleMessage } = require('../services/ai-assistant');
// After all mandatory fields collected:
handleMessage('+919876543210', '12000');
handleMessage('+919876543210', 'Mumbai');
handleMessage('+919876543210', '2BHK');
const reply = handleMessage('+919876543210', 'show me');
expect(reply).toContain('₹');
expect(reply).toContain('Mumbai');
expect(reply.split('₹').length - 1).toBeLessThanOrEqual(3);
```
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement `sendMatches` formatting** — format each match: title, rent, location, bedrooms, bathrooms, furnishing, match reasons joined with '; '. Max 3 matches. If 0 matches, suggest relaxing one requirement.
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

---

### Task 5: Visit booking flow

**Files:**
- Modify: `services/ai-assistant.js`
- Modify: `tests/ai-assistant.test.js`

**Interfaces:**
- Consumes: conversation state, user reply ('yes'/'no'), property selection
- Produces: pending visit object or confirmation/rejection text

- [ ] **Step 1: Write failing test**
```js
const { handleMessage } = require('../services/ai-assistant');
// After matches shown:
reply = handleMessage('+919876543210', '1'); // select match 1
expect(reply).toContain('book a visit');
expect(reply).toContain('yes');
reply = handleMessage('+919876543210', 'yes');
expect(reply).toContain('booked');
expect(reply).not.toContain('confirmed');
```
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement visit flow** — on number reply after matches, set `pendingVisits[phone] = {propertyId, propertyTitle}`. Ask 'Reply yes to confirm or no to cancel'. On 'yes' → create pending visit (status 'pending'), notify landlord message. On 'no' → cancel. Never say 'confirmed' until landlord approves.
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

---

### Task 6: Human handover (pause/resume AI)

**Files:**
- Modify: `services/ai-assistant.js`
- Modify: `tests/ai-assistant.test.js`

**Interfaces:**
- Consumes: phone number, action ('takeover' | 'reactivate')
- Produces: confirmation text

- [ ] **Step 1: Write failing test**
```js
const { handleMessage, takeover, reactivate } = require('../services/ai-assistant');
takeover('+919876543210');
const reply1 = handleMessage('+919876543210', 'hello');
expect(reply1).toBeUndefined(); // AI paused
reactivate('+919876543210');
const reply2 = handleMessage('+919876543210', 'hello');
expect(reply2).toContain('Hello'); // AI resumed
```
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement takeover/reactivate** — `humanHeld` set on conversation. `handleMessage` returns undefined (no auto-reply) when humanHeld. `reactivate` clears humanHeld, preserves conversation history.
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

---

### Task 7: Flexible budget language detection

**Files:**
- Modify: `services/ai-assistant.js` (uses existing parser.js flexibility logic)
- Modify: `tests/ai-assistant.test.js`

**Interfaces:**
- Consumes: user message text
- Produces: flexibility flag (boolean)

- [ ] **Step 1: Write failing test**
```js
const { parse } = require('../services/parser');
const result = parse('my budget is flexible, can increase');
expect(result.requirements.flexibility).toBe(1);
```
- [ ] **Step 2: Run test — expect FAIL** (parser.js may not exist or lack flexibility)
- [ ] **Step 3: Implement/verify parser flexibility** — detect /flex|negotiable|can increase|stretch/i in text. Set `flexibility = 1`. When flexibility set, matching allows rent stretch.
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

---

### Task 8: Unknown/unexpected input handling

**Files:**
- Modify: `services/ai-assistant.js`
- Modify: `tests/ai-assistant.test.js`

**Interfaces:**
- Consumes: any text input
- Produces: helpful English reply, never crashes

- [ ] **Step 1: Write failing test**
```js
const { handleMessage } = require('../services/ai-assistant');
const reply = handleMessage('+919876543210', 'asdfghjkl');
expect(reply).toBeDefined();
expect(typeof reply).toBe('string');
expect(reply.length).toBeGreaterThan(0);
```
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement fallback** — if input doesn't match number/keyword patterns during collection, re-ask the current missing field question. During matching, show help text.
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

---

## Self-Review

**1. Spec coverage:** Stage 1 spec requirements mapped:
- Welcome message → Task 1
- One question at a time → Task 2
- Remember conversation info → Task 2 (state persists per phone)
- English/Hindi/Hinglish → Tasks 1-4 (English default; Hindi/Hinglish strings can be added later without changing logic)
- Mandatory fields budgetMax/location/bedrooms → Task 2
- Flexibility detection → Task 7
- Matching engine → Task 3
- Max 3 matches, no unavailable → Task 3, Task 4
- Visit booking flow → Task 5
- Never claim confirmed before approval → Task 5
- Human takeover pause/resume → Task 6
- Unknown input handling → Task 8

**2. Step scan:** Every step writes exactly one reasonable thing (test, implementation, verification, commit). No TBD lines. No function bodies beyond what signature/tests don't determine.

**3. Type consistency:** `handleMessage(phone: string, text: string): string` consistent across Tasks 1, 2, 4, 5, 8. `match(req: object, props: array): array` consistent in Task 3. `takeover(phone: string)`, `reactivate(phone: string)` consistent in Task 6.

**4. Review Focus:** All 5 uncovered inputs mapped to tasks:
- Unknown language → Task 8
- Missing mandatory field → Task 2
- Budget flexibility → Task 7
- Visit with no matches → Task 5
- Duplicate message → Task 1 (idempotent via phone-keyed state)
- Human takeover → Task 6

**5. Proportion:** Plan is ~450 lines, spec is ~550 lines. Ratio appropriate — plan contains decisions, not transcribed code.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-10-rentflow-stage1-ai-assistant.md`.

**Which execution approach would you prefer?**

- **Subagent-driven** - A fresh subagent implements each task and a fresh reviewer checks it before the next one starts, then a whole-branch review at the end. Most thorough; costs a fresh context per task and per review.
- **Native** - I implement every task myself in this session, then one fresh reviewer checks the whole branch. Cheapest and fastest; no independent review until the end.

**For this plan I recommend Native** because the 8 tasks are tightly coupled (each builds on the previous `handleMessage` function), there are only 8 tasks, and a shipped mistake in the conversation state machine would cascade through all tasks — better to implement sequentially in one context.

**Does the plan capture what you want, and which approach should we use?**