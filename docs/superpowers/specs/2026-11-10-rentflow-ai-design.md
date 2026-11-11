# RentFlow AI — Design Document

**Date:** 2026-11-10  
**Status:** Draft — awaiting human approval  
**Project:** RentFlow AI — Multi-tenant WhatsApp rental automation SaaS  
**Approach:** A (Meta WhatsApp Cloud API + Supabase + cloud hosting)

---

## 1. Intent and Why

RentFlow AI is a production-ready, multi-tenant WhatsApp rental automation SaaS for landlords, property managers, brokers, and commercial property owners. It automates rental enquiries through each landlord's own WhatsApp Business number, matching tenant requirements to available properties, booking visits, and qualifying leads — all without the landlord manually replying to every message.

The existing codebase is a single-owner SmartRent AI (Express + SQLite + unofficial whatsapp-web.js). It cannot be sold as-is because it runs on localhost, uses a single owner account, and relies on unofficial WhatsApp Web automation that violates WhatsApp's Terms of Service and breaks in headless environments.

## 2. Goals

- Multi-tenant SaaS: multiple landlords, each with completely isolated data
- Each landlord connects their own official WhatsApp Business number via Meta WhatsApp Cloud API
- AI rental assistant that qualifies tenants, matches properties, shares photos, books visits
- Landlord dashboard (properties, conversations, leads, visits, WhatsApp integration, AI settings, staff, subscription)
- Super-admin dashboard (organizations, subscriptions, revenue, usage, audit logs)
- Subscription plans (Starter ₹499/mo, Professional ₹999/mo, Business ₹1,999/mo)
- 24/7 cloud-hosted operation, no localhost dependency

## 3. Non-Goals

- Unofficial WhatsApp Web automation (whatsapp-web.js) — explicitly prohibited by spec
- Single-owner localhost deployment
- Fake/demo data replacing real authentication or database functionality
- Building a customer-facing mobile app (customers interact via WhatsApp only)

## 4. Anti-Goals (what would make this a failure even if technically works)

- One landlord can see another landlord's properties, customers, or conversations
- WhatsApp messages sent without opt-in or outside messaging window
- Meta access tokens, Supabase service-role keys, or webhook secrets exposed in frontend
- A buyer installing the APK and finding it doesn't work because no backend is running

## 5. Constraints

- Must use official Meta WhatsApp Cloud API (not whatsapp-web.js/puppeteer)
- Must use Supabase PostgreSQL with Row Level Security for data isolation
- Must use Supabase Auth for authentication
- Must use Supabase Storage for property photos
- All secrets (Meta access tokens, Supabase service-role keys, webhook secrets) stored server-side only
- Webhook signature verification required
- Idempotent message processing (duplicate webhook events must not create duplicate leads)
- Rate limiting on all endpoints
- Audit logging for all mutations

## 6. Approaches Considered

| Approach | Stack | Trade-offs | Verdict |
|----------|-------|------------|---------|
| A: Full spec | Meta Cloud API + Supabase + cloud | Requires Meta Business verification + phone number costs; production-ready, sellable | **Selected** |
| B: Hybrid MVP | Unofficial whatsapp-web.js + PostgreSQL + cloud | Violates spec, ban risk, headless Chrome issues; not sellable | Rejected |
| C: Staged backend first | Supabase + Node.js backend + dashboard, WhatsApp later | Delays WhatsApp functionality; can't test core loop until Stage 3 | Rejected |

**Why Approach A:** It's the only approach that produces a commercially sellable, secure, compliant product. The missing pieces (Meta Business account, WhatsApp phone number, Supabase project) are prerequisites the buyer/owner must set up regardless of which approach is taken.

## 7. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Tenant WhatsApp → Meta Cloud API → Webhook → Backend API   │
│                              ↓                              │
│                    Supabase PostgreSQL (RLS)               │
│              ← organization_id isolates all data           │
│                              ↓                              │
│  Landlord Dashboard → Supabase Auth → Backend API          │
│  Super-admin Dashboard → Supabase Auth → Backend API       │
```

**Components:**
- **OpenBot:** AI agent orchestration (rental assistant conversation flow)
- **Meta WhatsApp Cloud API:** Official WhatsApp messaging (webhook inbound, messages outbound)
- **Supabase PostgreSQL:** Multi-tenant database with Row Level Security
- **Supabase Auth:** Authentication for landlords, staff, super-admin
- **Supabase Storage:** Property photographs and documents
- **Backend (Node.js/Express):** API endpoints, webhook processing, business logic, Excel export
- **Frontend (React/Vue):** Responsive web app — landlord dashboard + super-admin dashboard
- **Cloud hosting:** Render/Railway/Fly.io — 24/7 operation

## 8. Database Schema (PostgreSQL)

All organization-owned records include `organization_id`. RLS policies enforce `organization_id = current_organization()`.

### Core tables:
- `profiles` — user profiles (id UUID, email, full_name, role, created_at)
- `organizations` — landlord organizations (id UUID, name, plan, status, created_at)
- `memberships` — user ↔ org membership (id UUID, org_id, user_id, role, created_at)
- `whatsapp_connections` — Meta phone number per org (id UUID, org_id, phone_number_id, wa_id, access_token, verified, created_at)
- `properties` — rental listings (id UUID, org_id, title, category, address, location, rent, deposit, bedrooms, bathrooms, furnishing, facilities, availability, status, photos[], created_at)
- `property_images` — photo URLs per property (id UUID, property_id, url, alt, created_at)
- `conversations` — WhatsApp threads (id UUID, org_id, tenant_phone, status, created_at, updated_at)
- `messages` — message history (id UUID, conversation_id, direction, body, message_type, meta_message_id, created_at)
- `tenant_requirements` — collected requirements (id UUID, org_id, tenant_phone, category, location, budget, bedrooms, bathrooms, furnishing, family_bachelor, amenities, move_in_date, visit_preference, updated_at)
- `leads` — CRM leads (id UUID, org_id, tenant_phone, name, requirements, budget, status, property_ids[], created_at, updated_at)
- `visits` — visit requests (id UUID, org_id, lead_id, property_id, requested_date, requested_time, status, approved_by, created_at)
- `subscriptions` — billing (id UUID, org_id, plan, status, renewal_date, message_usage, ai_usage, created_at)
- `usage_logs` — message/AI usage tracking (id UUID, org_id, type, count, date)
- `webhook_events` — idempotency log (id UUID, org_id, event_id, processed_at)
- `audit_logs` — mutation audit (id UUID, org_id, actor_user_id, action, target_table, target_id, old_values, new_values, created_at)

### RLS Policies:
- `organizations`: members can read their own org; super-admin can read all
- `whatsapp_connections`: org members read own org's; super-admin reads all
- `properties`, `property_images`, `conversations`, `messages`, `tenant_requirements`, `leads`, `visits`: org members read/write own org's records only
- `subscriptions`, `usage_logs`, `audit_logs`: super-admin reads all; org members read own org's

## 9. AI Agent Workflow (Rental Assistant)

```
Incoming WhatsApp message
         ↓
Verify webhook signature → Check idempotency (webhook_events)
         ↓
Route by phone_number_id → organization_id
         ↓
Load conversation context + tenant_requirements
         ↓
AI Assistant (OpenBot):
  1. Welcome new enquiries
  2. Ask one question at a time (budget, location, bedrooms, etc.)
  3. Remember info from current conversation
  4. Run property matching engine (hard constraints + soft preferences)
  5. Recommend up to 3 best matches with photos
  6. Handle visit booking flow (date → time → check availability → pending request → notify landlord → confirm after approval)
  7. Escalate to human on complaints/disputes/uncertainty
         ↓
Send WhatsApp reply via Cloud API
         ↓
Log message + update conversation state
```

**Language support:** English, Hindi, Hinglish  
**Human handover:** Landlord takes over → AI pauses → preserves history → resumes on explicit reactivation

## 10. WhatsApp Webhook Workflow

```
Meta sends webhook POST to /webhook/whatsapp
         ↓
Verify X-Hub-Signature-256 with app secret
         ↓
Check webhook_events for event_id (idempotency)
         ↓
Extract phone_number_id → lookup organization via whatsapp_connections
         ↓
Extract tenant phone + message body
         ↓
Route to AI agent workflow
         ↓
Send reply via Cloud API (messages endpoint)
         ↓
Log inbound + outbound messages
         ↓
Return 200 OK to Meta
```

**Supported message types:** text, image (outbound), interactive (where supported)  
**Compliance:** Opt-in requirements, messaging windows, approved templates for out-of-window messages

## 11. Development Sequence (Stages)

| Stage | Work | Deliverable |
|-------|------|-------------|
| 1 | AI rental assistant conversation flow | Working chat logic (testable standalone) |
| 2 | Supabase schema + RLS + multi-tenant auth | Secure database, org isolation verified |
| 3 | WhatsApp Cloud API connection + webhook | Meta Business setup, phone number registered, webhook verified |
| 4 | Landlord dashboard | Properties, conversations, leads, visits, WhatsApp settings |
| 5 | Super-admin dashboard | Orgs, subscriptions, revenue, usage, audit logs |
| 6 | Subscriptions + usage tracking | Stripe/Razorpay integration, plan limits enforced |
| 7 | Security + integration + E2E tests | All 14 test scenarios from spec pass |
| 8 | Deployment + launch docs | Render/Railway deploy, APK rebuild guide, buyer onboarding |

## 12. Testing Strategy

14 test scenarios from spec:
1. Two landlords connect different WhatsApp numbers ✓
2. Tenant messages landlord A → correct properties returned ✓
3. Tenant messages landlord B → never receives landlord A's data ✓
4. Property photos delivered correctly ✓
5. Unavailable properties excluded ✓
6. Visit requests correctly recorded ✓
7. Human takeover pauses automated messages ✓
8. Failed webhook events retryable ✓
9. Suspended subscriptions enforce restrictions ✓
10. Unauthorized users cannot access protected data ✓
11. Database RLS denies cross-tenant access ✓
12. Duplicate webhook events don't create duplicate leads/messages ✓
13. Plus conversations, visits, lead qualification workflows

## 13. Required Accounts & Credentials (you must set up)

| Service | Purpose | Cost |
|---------|---------|------|
| Meta Business / WhatsApp Business API | Official WhatsApp integration | ~₹0.6–1.5 per conversation (India) |
| Supabase | PostgreSQL + Auth + Storage | Free tier available |
| Render / Railway / Fly.io | Cloud hosting | Free–$7/mo |
| Stripe / Razorpay | Subscription payments | Per-transaction |
| Domain name | Custom domain (optional) | ~₹1,000/yr |

## 14. What's Left to the Builder

- Meta Business account creation and WhatsApp phone number registration
- Supabase project setup and schema migration execution
- Render/Railway deployment with environment variables
- Stripe/Razorpay integration for subscription billing
- APK rebuild with cloud API_BASE_URL (not localhost)
- Frontend React/Vue dashboard implementation (currently HTML/JS only)

---

## Approval Required

**This design doc covers:** intent, why, goals, non-goals, anti-goals, constraints, approaches considered, architecture, database schema with RLS, AI agent workflow, WhatsApp webhook workflow, development sequence, testing strategy, required credentials, and what's left to build.

**Please review and approve.** Once approved, I'll invoke `writing-plans` to create the implementation plan, then begin Stage 1 (AI rental assistant).

Say "approved" to proceed, or list changes you want made first.