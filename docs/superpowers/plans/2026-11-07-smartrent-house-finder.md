# SmartRent AI House Finder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A free WhatsApp rental agent where owners upload real properties and customers describe their ideal home naturally; the AI matches only relevant listings with genuine photos, max 3 at a time.

**Architecture:** Node.js + Express local server. SQLite (`better-sqlite3`) stores properties, media, customers, conversations. `whatsapp-web.js` connects via the owner's phone (QR-paired, no Twilio). Ollama (local LLM) parses English/Hindi/Hinglish requirements, falling back to rule-based keyword matching. A separate owner web dashboard handles property CRUD and viewing matches/interested customers.

**Tech Stack:** Node.js, Express, better-sqlite3, whatsapp-web.js, multer, Ollama (optional, with rule-based fallback), SQLite.

**Spec:** `DESIGN.md` — travels with this plan; executors read both.

## Global Constraints

- All tools/services must be free (no Twilio, no paid AI API, no paid hosting)
- Never show unavailable properties (`status='available'` only)
- Never show properties over max budget unless customer allows flexibility
- Max 3 matches per message; if one matches, show one
- Never invent properties or photos — media comes from `property_media` only
- Ask permission before booking a visit; never auto-approve tenants
- Never disclose private owner information
- Remember customer requirements across the conversation; allow natural edits

## Review Focus

- Missing mandatory field → asks only the next missing question, not a long questionnaire
- Customer changes budget mid-conversation → re-searches with updated budget, doesn't re-ask answered questions
- No properties match → polite explanation + offer to relax one requirement
- Over-budget listing when flexibility not allowed → excluded from results
- Unavailable property → excluded from results
- Media sent for a match → only genuine files from `property_media`, never AI-generated substitutes

---

### Task 1: Project scaffold + SQLite schema

**Files:**
- Create: `package.json`
- Create: `server.js`
- Create: `db.js`
- Create: `migrations/001_initial.sql`

**Interfaces:**
- `db.js` exports `db` (better-sqlite3 instance) and `init()` that runs migrations
- `server.js` starts Express on port 3000, serves static owner dashboard, mounts API routes

- [ ] **Step 1: Write failing test**
```js
const { execSync } = require('child_process')
// Node and npm available
const result = execSync('node -e "console.log(process.version)"', { encoding: 'utf8' })
console.assert(result.includes('v'), 'Node not available')
```

- [ ] **Step 2: Initialize npm project** — `npm init -y`, install `express better-sqlite3 multer cors`, save dev `nodemon`

- [ ] **Step 3: Write `db.js`** — open `data/smartrent.sqlite`, enable WAL, export `db` and `init()`

- [ ] **Step 4: Write migration `001_initial.sql`** — tables: `properties`, `property_media`, `customers`, `conversations`, `matches` with columns per DESIGN.md

- [ ] **Step 5: Wire `init()` into `server.js`** — call on startup before listening

- [ ] **Step 6: Verify** — `node server.js` starts, `data/smartrent.sqlite` created with all tables, `Ctrl-C` stops it

- [ ] **Step 7: Commit**

---

### Task 2: Property CRUD model

**Files:**
- Create: `models/Property.js`

**Interfaces:**
- Consumes: `db` from `db.js`
- Produces: `Property.create(props)`, `Property.get(id)`, `Property.getAll()`, `Property.update(id, props)`, `Property.remove(id)`, `Property.setStatus(id, status)`, each returning the affected row or `null`

- [ ] **Step 1: Write failing test** — create a property, assert `get(id)` returns it with the same fields

- [ ] **Step 2: Implement `Property.js`** — parameterized queries, `id` generated as `PRP-<timestamp>-<random4>`, `created_at` ISO timestamp

- [ ] **Step 3: Run test** — PASS

- [ ] **Step 4: Commit**

---

### Task 3: Property media model + upload endpoint

**Files:**
- Create: `models/Media.js`
- Create: `routes/owner.js` (media upload routes only)
- Create: `uploads/photos/`, `uploads/videos/`

**Interfaces:**
- Consumes: `db` from `db.js`
- Produces: `Media.add(property_id, type, file_path)`, `Media.getByProperty(property_id)` returns array of `{id, type, file_path}`
- Route `POST /api/properties/:id/media` — multipart, saves file under `uploads/<type>/`, calls `Media.add`
- Route `GET /api/properties/:id/media` — returns media list
- Route `GET /uploads/:type/:filename` — serves the file

- [ ] **Step 1: Write failing test** — add media to a property, `getByProperty` returns it with correct `type` and `file_path`

- [ ] **Step 2: Implement `Media.js`** and register upload/serve routes in `routes/owner.js`

- [ ] **Step 3: Mount `routes/owner.js` in `server.js`**

- [ ] **Step 4: Run test** — PASS; also manually POST a file and GET it back with 200

- [ ] **Step 5: Commit**

---

### Task 4: Remaining property CRUD routes (owner)

**Files:**
- Modify: `routes/owner.js`

**Interfaces:**
- `GET /api/properties` — list all properties (with media count)
- `POST /api/properties` — create property (JSON body per DESIGN.md fields)
- `GET /api/properties/:id` — get one property with its media
- `PUT /api/properties/:id` — update property fields
- `DELETE /api/properties/:id` — remove property and its media files
- `PATCH /api/properties/:id/status` — toggle available/rented

- [ ] **Step 1: Write failing tests** — create, list, get, update, delete, status-toggle each assert correct DB state

- [ ] **Step 2: Implement routes** using `Property` and `Media` models; delete also removes files from `uploads/`

- [ ] **Step 3: Run tests** — PASS

- [ ] **Step 4: Commit**

---

### Task 5: Owner dashboard UI

**Files:**
- Create: `public/index.html`
- Create: `public/app.js`
- Create: `public/style.css`

**Interfaces:**
- Single-page owner dashboard: property list table, add/edit form, media upload, status toggle, delete with confirmation
- Calls the `routes/owner.js` API; no backend changes needed beyond Task 4

- [ ] **Step 1: Write `index.html` + `app.js` + `style.css`** — functional CRUD UI

- [ ] **Step 2: Verify** — start server, open `http://localhost:3000`, add a property with a photo, see it in the list, edit rent, toggle status, delete

- [ ] **Step 3: Commit**

---

### Task 6: Customer model + conversation memory

**Files:**
- Create: `models/Customer.js`

**Interfaces:**
- Consumes: `db` from `db.js`
- Produces: `Customer.upsert(phone, name)`, `Customer.get(phone)`, `Customer.updateRequirements(phone, requirementsJson)`, `Customer.getRequirements(phone)`, `Customer.setState(phone, state)`, `Customer.getState(phone)`, `Customer.logMessage(phone, role, message)`, `Customer.getConversation(phone, limit)`
- `requirements` stored as JSON: `{budgetMax, location, bedrooms, bathrooms, furnishing, parking, balcony, floor, facilities, availabilityDate, flexibility, info}`

- [ ] **Step 1: Write failing test** — upsert a customer, update requirements, get them back as parsed JSON; log a message and retrieve conversation

- [ ] **Step 2: Implement `Customer.js`**

- [ ] **Step 3: Run test** — PASS

- [ ] **Step 4: Commit**

---

### Task 7: Requirement parser (Ollama + rule-based fallback)

**Files:**
- Create: `services/parser.js`

**Interfaces:**
- Consumes: raw customer message string
- Produces: `{requirements: {...missingFields: string[]}, confidence: number}`
- Understands English/Hindi/Hinglish: "2BHK under ₹12,000", "furnished house with parking", "available next month", "मुंबई में घर चाहिए"
- Tries Ollama (`http://localhost:11434/api/generate`, model `llama3.2`); if unreachable, uses rule-based keyword/number extraction

- [ ] **Step 1: Write failing tests** — parse "2BHK under ₹12,000" → bedrooms=2, budgetMax=12000; parse "फर्निश्ड घर पार्किंग के साथ" → furnishing=furnished, parking=true; parse "available next month" → availabilityDate next month

- [ ] **Step 2: Implement `parser.js`** — Ollama call with JSON prompt, fallback regex/keyword extraction

- [ ] **Step 3: Run tests** — PASS (rule-based path; Ollama path only if running)

- [ ] **Step 4: Commit**

---

### Task 8: Smart matching engine

**Files:**
- Create: `services/matcher.js`
- Create: `models/Match.js`

**Interfaces:**
- Consumes: `customer requirements`, all `properties` where `status='available'`
- Produces: array of `{property, matchScore, matchReasons: string[]}`, sorted best first, max 3
- Separates mandatory (budgetMax, location, bedrooms if stated) from preferences (furnishing, parking, balcony, floor, facilities, availabilityDate)
- Excludes over-budget unless `flexibility=true`
- `Match.record(phone, propertyId)` and `Match.getForPhone(phone)` to avoid re-showing

- [ ] **Step 1: Write failing tests** — match a 2BHK under ₹12,000 against a fixture set; assert over-budget and unavailable excluded; assert best match first; assert max 3 returned

- [ ] **Step 2: Implement `matcher.js`** (scoring + reasons) and `Match.js` (record/retrieve)

- [ ] **Step 3: Run tests** — PASS

- [ ] **Step 4: Commit**

---

### Task 9: WhatsApp customer flow

**Files:**
- Create: `services/whatsapp.js`
- Create: `routes/webhook.js`
- Modify: `server.js` (mount webhook, start whatsapp client)

**Interfaces:**
- `whatsapp.js` initializes `whatsapp-web.js` client, on `message` calls the flow handler
- Flow: parse requirements → store in customer → if mandatory missing, reply with next missing question only → else match → reply with up to 3 matches (photos, rent, location, beds, facilities, why-it-matches) → if none, polite explanation + offer to relax
- Handles natural budget edits ("increase to ₹13,000") by merging into existing requirements
- Before a visit booking: replies "Shall I book a visit for [property]?" and waits for yes

- [ ] **Step 1: Write failing test** — simulate incoming message "2BHK under ₹12,000", assert reply asks next missing question or returns matches; simulate budget edit, assert re-search

- [ ] **Step 2: Implement `whatsapp.js` + `routes/webhook.js`** — message handler orchestrating Customer, parser, matcher, Media

- [ ] **Step 3: Mount webhook route in `server.js`**, initialize whatsapp client on startup (QR code logged to console)

- [ ] **Step 4: Verify** — run server, scan QR with phone, send a test message, receive a matching reply

- [ ] **Step 5: Commit**

---

### Task 10: Match requests + interested customers view (owner)

**Files:**
- Modify: `routes/owner.js`

**Interfaces:**
- `GET /api/matches` — list all match events (phone, propertyId, shownAt)
- `GET /api/customers` — list customers with their requirements and last activity

- [ ] **Step 1: Write failing tests** — record a match, assert it appears in `/api/matches`; customer listed in `/api/customers`

- [ ] **Step 2: Implement routes** using `Match` and `Customer` models

- [ ] **Step 3: Run tests** — PASS

- [ ] **Step 4: Commit**

---

### Task 11: End-to-end smoke test + cleanup

**Files:**
- Create: `tests/e2e.js`

**Interfaces:**
- Runs the full flow: start server, add property via API, send WhatsApp-style message via direct function call, assert match returned with media path

- [ ] **Step 1: Write e2e test** covering add property → customer query → match response → budget edit → re-match → no-match case

- [ ] **Step 2: Run e2e** — PASS

- [ ] **Step 3: Commit**

---

Plan complete and saved to `docs/superpowers/plans/2026-11-07-smartrent-house-finder.md`. Please review the plan. Does it capture what you want?

For execution, I recommend **Native** — I implement every task myself in this session with one final review. The tasks are tightly coupled through shared interfaces (Customer, parser, matcher), so subagent hand-offs would cost more context-switching than they save, and a shipped mistake (e.g., showing an over-budget property) directly violates a hard business rule that the plan pins in tests.

Which approach should we use, or shall I start implementing?