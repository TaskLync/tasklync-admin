# TaskLync: Admin Panel
### Internal Engineering Documentation · v1.0.0
> **Classification:** Internal · Engineering Team Only
> **Owner:** Backend Platform Team
> **Last Updated:** October 2026
> **Status:** 🟡 In Development
> **URL:** `https://admin.tasklync.pk` · dev `http://localhost:3000`
> **Repo location of this file:** `docs/ADMIN_PANEL.md`

This is the first full document for the admin panel. It was written from the real code (folder structure, 15 migrations, `lib/`, `types/`, `hooks/`, all 121 API route handlers). Domain UI components (about 150 files in `components/<module>`) were not read line by line; their behaviour is described through the hooks, types and routes they call. Section 21 lists everything that does not match the other service docs. **Read section 21 before the first production deploy.**

---

## Table of Contents

1. [Service Overview](#1-service-overview)
2. [Architecture](#2-architecture)
3. [Repository Structure](#3-repository-structure)
4. [Database](#4-database)
5. [Authentication & Sessions](#5-authentication--sessions)
6. [RBAC (Roles & Permissions)](#6-rbac-roles--permissions)
7. [API Reference](#7-api-reference)
8. [Modules & Business Rules](#8-modules--business-rules)
9. [Cross-Service Contract](#9-cross-service-contract)
10. [Security](#10-security)
11. [Configuration & Environment Variables](#11-configuration--environment-variables)
12. [Redis Keys](#12-redis-keys)
13. [Audit Log](#13-audit-log)
14. [Error Handling Standard](#14-error-handling-standard)
15. [Frontend Conventions](#15-frontend-conventions)
16. [Local Development Setup](#16-local-development-setup)
17. [Testing](#17-testing)
18. [Deployment](#18-deployment)
19. [Runbooks & Troubleshooting](#19-runbooks--troubleshooting)
20. [Architecture Decision Records](#20-architecture-decision-records-adrs)
21. [Known Issues & Roadmap](#21-known-issues--roadmap)
22. [Changelog](#22-changelog)

---

## 1. Service Overview

### What is this?

The **Admin Panel** is the internal operations dashboard of TaskLync. It is the only web UI for the team: moderation of users and workers, KYC verification, booking operations, disputes, finance views, reviews moderation, broadcast notifications, live map, analytics, catalog and pricing.

It is **not a microservice in the Express sense**. It is one Next.js (App Router) application that contains the UI and a BFF layer (`app/api/admin/*`). It talks to the **shared PostgreSQL (Supabase) database directly through `pg`** and to Redis. It has its own authentication, separate from auth-service.

### Stack

| Layer | Technology |
|---|---|
| Framework | Next.js `16.2.10` (App Router), React `19.2.4`, TypeScript 5 |
| Styling | Tailwind CSS 4 (`@theme inline` tokens in `globals.css`), `lucide-react` icons |
| Data fetching | SWR (`swr`), plain `fetch`; `@tanstack/react-query` and `axios` are installed but unused in the files reviewed |
| Client state | `zustand` (sidebar collapse, persisted) |
| DB | `pg` pool, raw SQL, no ORM |
| Cache / sessions | `ioredis` |
| Auth | `jose` (HS256 JWT), `bcryptjs`, `otplib` (TOTP), `qrcode` |
| Validation | `zod` on the auth routes, hand-written checks elsewhere |
| Maps | `mapbox-gl` |
| Charts | `recharts` |
| Push | `firebase-admin` (FCM v1, direct from the admin server) |
| Hosting | Vercel (per README); also runs behind nginx/Cloudflare per comments in `lib/audit.ts` |

> **AGENTS.md warning:** this Next.js version has breaking changes compared with older versions. Read `node_modules/next/dist/docs/` before changing routing, middleware or caching code. Next 16 renames the `middleware` file convention to `proxy`; this repo still uses `middleware.ts`. Verify against the installed version before upgrading.

### What this service does NOT do

- Customer or worker login: auth-service. Admins never get tokens that other services accept, and auth-service never issues an admin role (auth-service ADR-010).
- Booking, payment, review, notification **business logic**: those stay in their services. The admin panel mostly reads their tables and, for a few actions, writes their tables directly (see section 9; this is the main architectural risk).
- Customer / worker apps and the public website.

### Service boundaries

```
OWNS (writes, created by admin migrations):
  ├── admin_users, admin_mfa_backup_codes, admin_trusted_devices, admin_audit_log
  ├── admin_event_outbox                       (transactional outbox, relay NOT built yet)
  ├── platform_events                          (dashboard activity feed, filled by DB triggers)
  ├── platform_pricing_config                  (singleton)
  ├── booking_status_history, booking_admin_notes
  ├── dispute_admin_notes, review_admin_notes
  ├── worker_badges, worker_verification_reviews
  └── search_demand_log                        (table is ours, search-service must write to it)

ADDS COLUMNS to tables owned by other services (additive, IF NOT EXISTS):
  ├── users      suspension / ban / warning columns                       (004)
  ├── workers    suspension / ban / warning / featured / KYC columns      (006, 007)
  ├── bookings   refund_amount, refund_percentage                         (008)
  ├── disputes   assigned_* / is_escalated / escalation_*                 (010)
  └── reviews, review_reports   moderation + resolution columns           (014)

WRITES DIRECTLY to tables owned by others (see section 9):
  users, workers, worker_documents, bookings, disputes, reviews, review_reports,
  categories, services, waitlist, broadcast_campaigns, notifications, notification_deliveries

READS: payments, worker_payouts, refunds, worker_wallets, dead_letters, messages,
       worker_locations, user_addresses, user_blocks, worker_skills, worker_service_offerings,
       worker_recurring_availability, worker_blocked_dates, reviewable_bookings,
       notification_preferences

CALLS via HTTP (server side only):
  └── payment-service  POST /internal/refunds, POST /internal/payouts/:id/retry   (x-internal-key)

SENDS directly:
  └── Firebase Cloud Messaging (FCM v1) for broadcast and test pushes
```

### Key numbers

| Metric | Value |
|---|---|
| Admin roles | 4: `SUPER_ADMIN`, `OPS`, `FINANCE`, `SUPPORT` |
| Permissions | 48 (section 6) |
| Admin pages | 13 modules + 3 auth pages |
| API route handlers | 121 |
| Migrations | 15 (`db/migrations/001` to `015`) |
| Access token TTL | 15 min (`ADMIN_ACCESS_TOKEN_TTL=900`) |
| Session life | 8 h (not remembered) or 7 d (remembered device), absolute, never extended by refresh |
| Concurrent sessions per admin | 3 |
| Failed logins before lockout | 5, lockout 30 min |
| MFA | mandatory for every role by default (`ADMIN_MFA_REQUIRED=true`) |
| DB pool | max 10 connections |
| Max super admins via seed script | 2 |
| Page auto-refresh | 5 s (live map workers) to 60 s (analytics, finance) |
| Day boundary for all KPIs | Asia/Karachi |

---

## 2. Architecture

### System context

```
                    ┌──────────────────────┐
                    │  Admin (browser)     │
                    │ admin.tasklync.pk    │
                    └──────────┬───────────┘
                               │ HTTPS  (httpOnly cookies, SameSite=Lax)
                    ┌──────────▼───────────┐
                    │  Next.js middleware  │  JWT verify (edge), Origin/CSRF check,
                    │                      │  route → permission check, silent refresh redirect
                    └──────────┬───────────┘
                               │
        ┌──────────────────────▼──────────────────────┐
        │              tasklync-admin (Node)          │
        │  app/(admin) pages  ·  app/api/admin/* BFF  │
        └──┬─────────────┬─────────────┬──────────────┘
           │             │             │ HTTP (x-internal-key)     │ HTTPS
           ▼             ▼             ▼                           ▼
    ┌────────────┐ ┌───────────┐ ┌──────────────────┐     ┌────────────────┐
    │ PostgreSQL │ │   Redis   │ │ payment-service  │     │ Firebase (FCM) │
    │ (shared)   │ │ sessions, │ │ refunds, payout  │     │ direct push    │
    │ pg pool    │ │ rate lim. │ │ retry            │     └────────────────┘
    └────────────┘ └───────────┘ └──────────────────┘
          ▲
          │ written by the other 8 services; read and partly written here
```

### Request pipeline

```
Browser request
  ▼
middleware.ts  (edge runtime)
  ├─ unsafe API method (POST/PUT/PATCH/DELETE) and Origin ≠ Host   → 403
  ├─ /api/admin/auth/*                                             → pass (routes enforce themselves)
  ├─ verify admin_access JWT (sig, alg, iss, aud, exp, type, scope)
  ├─ no valid token:
  │     API   → 401 JSON (client interceptor refreshes + retries)
  │     page  → refresh cookie present ? redirect /api/admin/auth/refresh?next=…
  │                                    : redirect /auth/login?next=…
  ├─ scope = mfa_setup                                             → only /auth/mfa-setup (pages) / 403 MFA_SETUP_REQUIRED (API)
  └─ path prefix → permission (ROUTE_PERMISSIONS); role lacks it   → redirect /
  ▼
Page (server component shell + client components with SWR)        API route handler
                                                                    ├─ requirePermission(p)   (JWT + Redis session + role)
                                                                    ├─ validate input
                                                                    ├─ SQL (or withTx for multi-row actions)
                                                                    ├─ logAdminAction()       (after commit)
                                                                    └─ JSON
```

### Layers

| Layer | Location | Rule |
|---|---|---|
| Edge gate | `middleware.ts` | Coarse: valid JWT + path-level permission. Cannot see Redis, so it cannot detect a destroyed session |
| Guard | `lib/rbac-guard.ts` → `requirePermission()` | Authoritative: JWT + session still in Redis + `scope === 'full'` + role has permission |
| Route handler | `app/api/admin/**/route.ts` | Parse, validate, run SQL, audit, respond. No shared service layer |
| Domain helpers | `lib/*-api.ts`, `lib/*-constants.ts` | SQL fragments defined once (list, count, export share them), error classes, row mappers |
| Constants | `lib/*-constants.ts` | No server-only imports: shared by server and client |
| Hooks | `hooks/use*.ts` | SWR hooks + a `*Actions` object per module for mutations |
| UI | `components/<module>/*` | Section → FilterBar → Table → KpiGrid pattern per module |

### Conventions that repeat in every module

- **Single SQL source of truth.** List, counts and CSV export reuse the same SQL fragment constants (`FROM_SQL`, `TAB_SQL`, `buildXWhere`), so numbers cannot disagree.
- **Derived status, never stored.** User and worker `status`, worker `presence` and payment status are computed (`fn_user_status`, `fn_worker_status`, `fn_worker_presence`, `PAYMENT_STATUS_SQL`) from timestamps.
- **Availability-aware lists.** Where another service's table may not exist, the route returns `{ available: false, data: [] }` on SQL error `42P01` / `42703` and the UI shows "not wired up yet".
- **Reason required** on every destructive or state-changing action; it is stored in the audit log.
- **Row lock + status guard** (`SELECT … FOR UPDATE`) inside `withTx()` for bookings, disputes, reviews and verification.

---

## 3. Repository Structure

```
tasklync-admin/
├── middleware.ts                       # edge gate (JWT, CSRF origin check, route permission)
├── next.config.ts                      # security headers, image hosts, no-store on auth + API
├── package.json  tsconfig.json  eslint.config.mjs  postcss.config.mjs
├── .env  .env.example  service-account.example.json   # real service-account.json is git-ignored
├── AGENTS.md  CLAUDE.md  README.md  structure.txt  folderstructure.txt
├── docs/ADMIN_PANEL.md                 # this file
│
├── app/
│   ├── layout.tsx  globals.css  favicon.ico
│   ├── auth/                           # login, mfa, mfa-setup (+ layout)
│   ├── (admin)/                        # layout = Sidebar + Header + SessionKeeper
│   │   ├── page.tsx                    # dashboard
│   │   ├── analytics/  bookings/[bookingId]/  categories/[categoryId]/
│   │   ├── disputes/[disputeId]/  map/  notifications/[campaignId]/
│   │   ├── payments/  reviews/[reviewId]/  users/[userId]/  waitlist/
│   │   └── workers/[workerId]/  workers/verification/[workerId]/
│   └── api/admin/                      # 121 route handlers (section 7)
│       ├── auth/ (login logout refresh session mfa/{setup,setup-confirm,verify})
│       ├── analytics/ bookings/ categories/ dashboard/ disputes/ map/
│       ├── notifications/ payments/ pricing-config/ reviews/ users/ waitlist/ workers/
│
├── components/
│   ├── layout/    Sidebar Header Breadcrumb
│   ├── auth/      LoginForm MfaForm MfaSetupForm SessionKeeper
│   ├── shared/    DataTable ConfirmDialog StatusBadge
│   ├── ui/        Button Card Input Badge
│   └── analytics bookings categories dashboard disputes map notifications
│       payments reviews users verification waitlist workers      # one folder per module
│
├── db/migrations/001 … 015_*.sql
├── generated-templates/{push,sms}/     # output of scripts/generate-broadcast-templates.ts
├── hooks/                              # useAdminSession usePermission + one hook file per module
├── lib/
│   ├── auth/       config cookies crypto issue jwt mfa password rate-limit rbac redirect request session trusted-device
│   ├── store/      useSidebarStore
│   ├── db.ts redis.ts audit.ts rbac-guard.ts auth-fetch.ts swr-fetcher.ts cn.ts nav-config.ts
│   ├── firebase-admin.ts direct-broadcast-engine.ts notification-catalog.ts notification-constants.ts
│   ├── notification-service.ts  notifications-api.ts       # gateway client is now unused (ADR-009)
│   ├── payment-service.ts payment-constants.ts payments-api.ts
│   ├── booking-constants.ts bookings-api.ts dispute-constants.ts disputes-api.ts
│   ├── review-constants.ts reviews-api.ts verification-api.ts verification-constants.ts
│   ├── workers-api.ts map-api.ts map-constants.ts map-geo.ts
│   ├── analytics-api.ts analytics-constants.ts parse-user-agent.ts
├── scripts/
│   ├── seed-super-admin.ts             # create first super admin (max 2)
│   ├── setup-firebase.ts  encode-firebase-credentials.ps1
│   ├── generate-broadcast-templates.ts
│   └── test-direct-broadcast.ts
├── types/                              # one file per module + auth
└── public/favicon.ico
```

> Missing on purpose or by omission: `scripts/publish-outbox.ts` (referenced in migration 007, does not exist), `app/(admin)/settings` (linked from the sidebar, no page), admin-user management pages and routes (permission exists, nothing built). See section 21.

### File responsibilities (core)

| File | Single responsibility |
|---|---|
| `middleware.ts` | Edge gate. Never touches Redis or DB |
| `lib/rbac-guard.ts` | `requirePermission(permission)` → `{ ok, admin }` or a ready 401/403 response |
| `lib/auth/jwt.ts` | HS256 sign/verify for access token and MFA challenge token (separate audience) |
| `lib/auth/session.ts` | Redis sessions, refresh rotation, reuse detection, session cap |
| `lib/auth/mfa.ts` | TOTP, backup codes, TOTP replay claim |
| `lib/auth/crypto.ts` | AES-256-GCM for TOTP secrets, HMAC for backup codes |
| `lib/auth/trusted-device.ts` | "Remember this device" cookie + `admin_trusted_devices` rows |
| `lib/auth-fetch.ts` | Client fetch interceptor: 401 → refresh once → retry once |
| `lib/audit.ts` | `logAdminAction`, `logAuthEvent`, client IP / UA helpers |
| `lib/bookings-api.ts` | Booking SQL fragments, `withTx`, `lockBooking`, outbox writers |
| `lib/direct-broadcast-engine.ts` | Resolve recipients → write feed rows → send FCM → write delivery rows |
| `lib/payment-service.ts` | The only HTTP client to another service (payment-service) |

---

## 4. Database

The admin panel uses the **same Supabase PostgreSQL database** as the other services (`DATABASE_URL`). Migrations are plain SQL files run by hand in order; there is no migration runner and no tracking table.

### 4.1 Migrations

| # | File | What it does |
|---|---|---|
| 001 | `admin_auth` | `admin_users`, `admin_mfa_backup_codes`, `admin_audit_log` |
| 002 | `dashboard_functions` | `platform_events` + 5 triggers, `get_dashboard_kpis`, `get_needs_attention`, `get_revenue_chart`, `get_revenue_by_city`, `get_booking_funnel` |
| 003 | `waitlist_functions` | `pg_trgm`, waitlist indexes, `get_waitlist_kpis`, `get_waitlist_growth`, `get_utm_breakdown` |
| 004 | `users_moderation` | Moderation columns on `users`, trigram indexes, `fn_user_status`, `get_user_overview` |
| 005 | `pricing_config` | `platform_pricing_config` singleton |
| 006 | `workers_moderation` | Moderation + featured + re-verification columns on `workers`, `worker_badges`, `fn_worker_status`, `fn_worker_presence`, `get_worker_kpis`, `get_worker_overview` |
| 007 | `worker_verification` | KYC columns on `workers`, `worker_verification_reviews`, `admin_event_outbox` |
| 008 | `bookings_admin` | Refund columns, `booking_status_history` + trigger + backfill, `booking_admin_notes`, `get_booking_kpis` |
| 009 | `payments_admin` | Read indexes on payment-service tables |
| 010 | `disputes_admin` | Assignment/escalation columns, `dispute_admin_notes`, indexes, `get_needs_attention` v2 |
| 011 | `analytics` | `analytics_day_start`, `analytics_period_stats`, `analytics_retention`, `get_analytics_kpis/growth/city_trend/cities/funnels/categories` |
| 012 | `notifications_admin` | Read indexes on notification-service tables (guarded by `to_regclass`) |
| 013 | `live_map` | `search_demand_log`, indexes, `get_map_demand_cells` |
| 014 | `reviews_admin` | Moderation audit columns, report resolution, `review_admin_notes`, `get_needs_attention` v3 (final) |
| 015 | `admin_session_hardening` | `admin_trusted_devices`, unique `LOWER(email)` index |

**Run order matters.** Every migration after 001 needs the other services' tables to exist first (users, workers, bookings, disputes, payments, reviews, notifications). 014 aborts with a clear error if review-service tables are missing. `get_needs_attention()` is redefined in 002, 010 and 014; **014 is the final version**: if you re-run 002 or 010 afterwards you lose the newer blocks.

Not defined in any admin migration but called by the code (must exist in the shared DB, owned by the user/auth side): `get_user_kpis()`. The `waitlist` table itself is created by the website, not the admin panel.

### 4.2 Admin-owned tables

```sql
admin_users (
  id uuid PK, email varchar(255) UNIQUE (+ unique index on LOWER(email)),
  password_hash varchar(255), full_name varchar(255),
  role varchar(50) CHECK IN ('SUPER_ADMIN','OPS','FINANCE','SUPPORT'),
  is_active bool DEFAULT true,
  mfa_secret varchar(255)      -- AES-256-GCM "v1:<iv>.<tag>.<ct>", legacy plaintext still readable
  mfa_enabled bool DEFAULT false,
  last_login_at, last_login_ip, failed_attempts int, locked_until timestamptz,
  created_by uuid → admin_users, created_at, updated_at
)

admin_mfa_backup_codes ( id, admin_id → admin_users ON DELETE CASCADE,
                         code_hash,   -- "hmac1:<hex>" (legacy bcrypt "$2…" still verified)
                         used_at, created_at )

admin_trusted_devices ( id uuid PK (= cookie id), admin_id, token_hash CHAR(64) sha256(secret),
                        ip_address, user_agent, created_at, last_used_at, expires_at, revoked_at )

admin_audit_log ( id, admin_id, admin_email, action varchar(100), resource_type, resource_id uuid,
                  old_value jsonb, new_value jsonb, notes, ip_address varchar(50), user_agent, created_at )

admin_event_outbox ( id bigserial, topic, event_type, event_key, payload jsonb,
                     created_at, published_at, attempts, last_error )     -- relay missing, see 21

platform_events ( id, event_type varchar(50), message, metadata jsonb, created_at )   -- dashboard feed
platform_pricing_config ( id bool PK CHECK (id = true), platform_fee_percent 15.00, demand_threshold 3,
                          demand_multiplier 1.2, urgency_same_day_multiplier 1.3,
                          urgency_within_2h_multiplier 1.5, off_peak_multiplier 0.9, updated_by, updated_at )
booking_status_history ( id bigserial, booking_id, from_status, to_status, actor, is_backfilled, changed_at )
booking_admin_notes / dispute_admin_notes / review_admin_notes ( id, <entity>_id, admin_id, admin_email, note, created_at )
worker_badges ( worker_id, badge IN ('top_rated','background_verified'), awarded_by, UNIQUE(worker_id,badge) )
worker_verification_reviews ( worker_id, decision IN ('approved','rejected','info_requested'),
                              reason_code, note, allow_resubmission, admin_id, admin_email, created_at )
search_demand_log ( id, user_id, lat, lng, category_id, query_text, result_count, created_at )
```

### 4.3 Columns the admin panel adds to other services' tables

| Table (owner) | Columns | Written by |
|---|---|---|
| `users` (auth/user) | `suspended_until/reason/by`, `banned_at/reason/by`, `warning_count`, `last_warning_at/reason` | admin; **enforced by auth-service and user-service** (their docs list the same columns) |
| `workers` (worker) | same moderation set + `is_featured`, `featured_at`, `reverification_requested_at`, `reverification_reason` | admin |
| `workers` | `cnic_number`, `date_of_birth`, `registration_ip`, `verification_rejection_code/note`, `verification_resubmission_allowed`, `verified_at`, `verified_by` | worker-service on upload, admin on decision |
| `bookings` (booking) | `refund_amount`, `refund_percentage` | admin cancel / dispute resolve (booking-service already has them) |
| `disputes` (booking) | `assigned_to`, `assigned_at`, `is_escalated`, `escalated_at/by`, `escalation_note` | admin |
| `reviews`, `review_reports` (review) | `moderated_by/at`, `moderation_note`, `resolved_at/by` | admin (review-service migration 005 creates the same columns) |

All `ADD COLUMN IF NOT EXISTS`, so repeated application is safe. Tell the owning team before changing any of them.

### 4.4 Database functions and triggers

| Function | Used by |
|---|---|
| `fn_user_status`, `fn_worker_status` | status column on every user/worker list, map, analytics |
| `fn_worker_presence` | worker list, map, KPIs. `<90 s` online, `90 s–10 min` away, else offline; paused / on_job override |
| `get_user_overview`, `get_worker_overview` | detail page header, one round trip |
| `get_dashboard_kpis`, `get_needs_attention`, `get_revenue_chart`, `get_revenue_by_city`, `get_booking_funnel` | dashboard |
| `get_waitlist_*`, `get_utm_breakdown` | waitlist |
| `get_worker_kpis`, `get_booking_kpis` | list-page KPI cards (Karachi "today") |
| `get_analytics_*`, `analytics_*` | analytics page |
| `get_map_demand_cells` | live map heatmap, ~2 km grid (0.02°) |
| `fn_log_booking_status_history` (trigger on `bookings` INSERT / UPDATE OF status) | booking timeline. Reads `current_setting('app.actor')` so admin changes show `admin:<email>` |
| `fn_log_booking_created`, `fn_log_booking_disputed`, `fn_log_worker_verified`, `fn_log_payment_completed`, `fn_log_user_registered` | fill `platform_events`. **`trg_user_registered` / `fn_log_user_registered` come from migration 002**, not from auth-service (the auth-service doc says "owned by another service": this is that service) |

### 4.5 Time-zone rule

Every "today", "this month" and day bucket is computed in `Asia/Karachi` (`now() AT TIME ZONE 'Asia/Karachi'`). Dates returned to the browser are `YYYY-MM-DD` strings (`to_char`) to avoid JavaScript time-zone shifts.

---

## 5. Authentication & Sessions

Admin auth is **fully separate** from auth-service: own table, own secret, own cookies, own Redis keys.

### 5.1 Tokens and cookies

| Cookie | Content | Lifetime | Path | Notes |
|---|---|---|---|---|
| `admin_access` | JWT HS256, `aud=tasklync-admin-panel`, claims `sub, email, role, sessionId, scope, type=access` | 15 min | `/` | `scope`: `full` or `mfa_setup` |
| `admin_session` | Opaque 32-byte hex refresh token (64 chars). Only its sha256 is stored in Redis | 8 h session cookie, or 7 d if remembered | `/` | Browser-session cookie when not remembered |
| `admin_device` | `<uuid>.<secret>` trusted-device token. Only sha256(secret) is stored in DB | 7 d | `/` | Skips MFA on this browser |
| `admin_mfa` | JWT `aud=tasklync-admin-mfa`, `purpose=mfa_pending`, single use (jti in Redis) | 5 min | `/api/admin/auth/mfa` only | Never sent to other routes |

All cookies are `httpOnly`, `Secure` in production, `SameSite=Lax` (so links from Slack/email keep you signed in). Tokens are **never** returned in JSON bodies. The MFA challenge uses a different audience so it can never pass as an access token.

### 5.2 Login flow

```
POST /api/admin/auth/login { email, password }
  ├─ IP limit 30 / 15 min, then email limit 15 / 15 min             → 429
  ├─ load admin by LOWER(email); verify bcrypt (dummy hash when the email does not exist)
  ├─ wrong password: failed_attempts + 1 (atomic UPDATE); at 5 → locked_until = now + 30 min
  │     generic 401 "Invalid email or password" (no enumeration)
  ├─ correct password but locked_until in the future                → 423 (only now do we reveal it)
  ├─ MFA enabled
  │     ├─ valid trusted-device cookie for THIS admin               → full session, no code
  │     └─ else: set admin_mfa cookie + Redis admin:mfa_tmp:{jti}   → { requiresMFA: true }
  ├─ MFA not enabled, ADMIN_MFA_REQUIRED=true
  │     → limited session (scope=mfa_setup, 30 min)                 → { mfaSetupRequired: true }
  └─ MFA not enabled, MFA not required                              → full session
```

```
POST /api/admin/auth/mfa/verify { code, remember? }        (admin_mfa cookie required)
  ├─ IP limit 40 / 15 min
  ├─ challenge valid and still in Redis (single use)
  ├─ 5 wrong codes in 15 min: challenge burned, account locked 30 min, auth.mfa_lockout logged
  ├─ 6 digits  → TOTP (±1 step) AND replay claim (Redis NX 120 s)
  ├─ else      → backup code (XXXXX-XXXX style), atomic UPDATE used_at, single use
  └─ success: new session, markLoginSuccess, optional trusted device (remember=true)
```

```
POST /api/admin/auth/mfa/setup           → QR (data URL) + manual secret; pending secret in Redis 10 min
POST /api/admin/auth/mfa/setup-confirm   → verifies first code, stores AES-GCM encrypted secret,
                                           generates 10 backup codes (shown ONCE), destroys the
                                           password-only session and issues a FRESH full session,
                                           trusts the device
```

Setup is refused (`409`) when MFA is already enabled, so a stolen session cannot swap the authenticator.

### 5.3 Sessions (Redis)

```
admin:sess:{sid}           SessionRecord JSON       TTL = remaining life (absolute expiry, never extended)
admin:rt:{sha256(rt)}      sid                      current refresh token
admin:rt_used:{sha256}     { sid, at }              rotated-out tokens (theft detection)
admin:sessions:{adminId}   zset of sids             concurrent-session limit (max 3, oldest evicted)
```

- **Rotation:** every refresh consumes the old token (`GETDEL`, atomic) and issues a new one. The session's `expiresAt` is fixed at login.
- **Grace window (20 s):** a second tab presenting the just-rotated token gets a new access token only; its refresh cookie is left alone (the other tab's cookie wins).
- **Reuse detection:** a rotated token replayed after the grace window kills the whole session and logs `auth.refresh_reuse_detected`.
- **Account re-check on every refresh:** a deactivated admin loses **all** sessions (`destroyAllSessions`).
- **Real logout:** `POST /logout` deletes the Redis session, both cookies; `?forget=1` also revokes the trusted device (use on shared computers).
- **`authenticateAccessToken`** (used by `requirePermission`) requires the JWT **and** the Redis session, so logout, eviction and deactivation take effect immediately for API calls. The edge middleware cannot check Redis, so a still-valid JWT can open the page shell for up to 15 min after a session was destroyed; no data loads because every API call is rejected.

### 5.4 Client-side silent refresh

`lib/auth-fetch.ts` patches `window.fetch` once (installed by `SessionKeeper` and by `MfaSetupForm`):

1. Only same-origin `/api/admin/*` calls except login, refresh, logout and mfa/verify.
2. On `401` → `refreshSession()` (one request in flight, serialised across tabs with the Web Locks API, skipped if another tab refreshed in the last 8 s) → retry once.
3. Refresh failed → redirect to `/auth/login?reason=expired`.

`SessionKeeper` also refreshes every 10 min while the tab is visible. For full-page loads with an expired access cookie, middleware redirects through `GET /api/admin/auth/refresh?next=…` (`safeNextPath` blocks open redirects).

### 5.5 Crypto

| Item | Method |
|---|---|
| Passwords | bcrypt, 12 rounds. 12–72 bytes, upper + lower + digit |
| TOTP secret at rest | AES-256-GCM, key `ADMIN_MFA_ENCRYPTION_KEY` (32 bytes base64). Legacy plaintext secrets are re-encrypted on next successful login |
| Backup codes | HMAC-SHA256 with a key derived from the encryption key (40 bits of entropy, so no bcrypt needed) |
| JWT | HS256, `ADMIN_JWT_SECRET` ≥ 32 bytes, `clockTolerance` 5 s |
| Refresh / device secrets | 32 random bytes, only sha256 stored |

> **Losing `ADMIN_MFA_ENCRYPTION_KEY` means every admin has to re-enrol MFA.** Back it up like a password.

---

## 6. RBAC (Roles & Permissions)

Source of truth: `lib/auth/rbac.ts` (`PERMISSIONS`, `ROUTE_PERMISSIONS`). Nav visibility is a **separate** list in `lib/nav-config.ts`.

### 6.1 Roles

| Role | Purpose |
|---|---|
| `SUPER_ADMIN` | Everything. Only role that can ban, impersonate, create categories, edit pricing, broadcast to all users/workers, resolve escalated disputes |
| `OPS` | Operations: verification, workers/users moderation (except ban), bookings, disputes, notifications, map, reviews |
| `FINANCE` | Payments, analytics, dashboard, categories (read) |
| `SUPPORT` | Read-mostly: users, workers (read), bookings, disputes, reviews, with warn / note / escalate |

### 6.2 Permission matrix (`✓` = allowed)

| Permission | SUPER | OPS | FIN | SUP |
|---|:-:|:-:|:-:|:-:|
| `dashboard:view`, `categories:view` | ✓ | ✓ | ✓ | ✓ |
| `waitlist:view` | ✓ | ✓ | ✓ | ✓ |
| `waitlist:manage` | ✓ | ✓ | | |
| `workers:view` | ✓ | ✓ | | ✓ |
| `workers:verify` (queue, review page, documents) | ✓ | ✓ | | |
| `workers:warn`, `:suspend`, `:edit`, `:feature`, `:badge`, `:force-offline` | ✓ | ✓ | | |
| `workers:ban` | ✓ | | | |
| `users:view`, `users:warn` | ✓ | ✓ | | ✓ |
| `users:suspend`, `users:edit` | ✓ | ✓ | | |
| `users:ban`, `users:impersonate` | ✓ | | | |
| `bookings:view`, `:cancel`, `:escalate`, `:note` | ✓ | ✓ | | ✓ |
| `bookings:override`, `:reassign` | ✓ | ✓ | | |
| `payments:view`, `:refund`, `:payout`, `:export` | ✓ | | ✓ | |
| `disputes:view`, `:assign`, `:escalate`, `:note` | ✓ | ✓ | | ✓ |
| `disputes:resolve` (escalated: SUPER_ADMIN only, enforced in the route) | ✓ | ✓ | | |
| `analytics:view` | ✓ | ✓ | ✓ | |
| `notifications:view`, `:send` | ✓ | ✓ | | |
| `notifications:broadcast-all` | ✓ | | | |
| `map:view` | ✓ | ✓ | | |
| `reviews:view`, `:note` | ✓ | ✓ | | ✓ |
| `reviews:moderate` | ✓ | ✓ | | |
| `categories:create`, `:edit`, `services:edit` | ✓ | | | |
| `settings:view`, `settings:edit`, `admin_users:manage` | ✓ | | | |

### 6.3 Enforcement points

1. **Middleware** maps path prefixes to a permission (`/workers/verification` before `/workers`; `find()` + `startsWith`, so order matters). A role without the permission is redirected to `/`.
2. **Every API handler** starts with `requirePermission('x:y')`.
3. **Inline rules** inside handlers: escalated disputes (`is_escalated` + not SUPER_ADMIN → 403), claim rules, broadcast-all, quiet hours.
4. **UI:** `Sidebar` filters `NAV_ITEMS` by role; `usePermission()` hides buttons. UI hiding is cosmetic; the API decides.

### 6.4 Known RBAC inconsistencies

- `/waitlist` has **no entry in `ROUTE_PERMISSIONS`**, so middleware lets every signed-in role open the page; the nav shows it only to SUPER_ADMIN and OPS while `waitlist:view` allows all four roles. Pick one rule.
- Nav shows "Workers" to SUPER_ADMIN and OPS only, but `workers:view` also allows SUPPORT. SUPPORT can reach the pages by URL and the APIs allow it.
- `DashboardPage` and `/` have no route permission: any full-scope admin can open it (APIs check `dashboard:view`, which all four roles have).

---

## 7. API Reference

Base path: `/api/admin`. Auth: httpOnly cookie. All unsafe methods also pass the Origin check. Errors: `{ "error": "message" }` (some also `code`). Lists: `{ data, page, pageSize, total, totalPages }` (waitlist uses `rows`). Page size is capped at 100 almost everywhere. Every route that is not under `/auth` calls `requirePermission`.

### 7.1 Auth (`/auth`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | public, rate limited | Password step (5.2) |
| POST | `/auth/logout` | cookie optional | `?forget=1` also forgets the device |
| POST | `/auth/refresh` | refresh cookie | XHR refresh, returns `{ ok: true }` + new cookies |
| GET | `/auth/refresh?next=` | refresh cookie | Navigation refresh, redirects to `next` |
| GET | `/auth/session` | access cookie (any scope) | Current admin; `mfaSetupRequired` when scope is `mfa_setup` |
| POST | `/auth/mfa/setup` | access cookie (any scope) | QR + secret |
| POST | `/auth/mfa/setup-confirm` | access cookie (any scope) | Enable MFA, returns backup codes once |
| POST | `/auth/mfa/verify` | `admin_mfa` cookie | TOTP or backup code, `remember` |

### 7.2 Dashboard (`dashboard:view`)

| Method | Path | Description |
|---|---|---|
| GET | `/dashboard/kpis` | `get_dashboard_kpis()`: revenue today/yesterday, active bookings, signups, pending verifications + 7-day sparklines |
| GET | `/dashboard/attention` | `get_needs_attention()`: stale disputes (>24 h), stale verifications (>48 h), failed payments, stuck PENDING bookings (>30 min), flagged reviews |
| GET | `/dashboard/activity` | Last 50 `platform_events` |
| GET | `/dashboard/revenue?period=daily|weekly|monthly` | Chart + by-city table |
| GET | `/dashboard/funnel` | Created → Accepted → Started → Completed, last 30 days |

### 7.3 Waitlist

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/waitlist` | `waitlist:view` | List: `search, status, utm_source (direct = NULL), dateFrom, dateTo, sortBy (created_at|position|email), sortDir, page, pageSize (10–100)`. Rows enriched with UA-parsed device/browser/OS |
| GET | `/waitlist/kpis` | view | Totals, today/week change, conversion rate, top source, sparkline |
| GET | `/waitlist/growth?period=` | view | Bucketed signups + cumulative (30 days / 12 weeks / 12 months) |
| GET | `/waitlist/utm-breakdown` | view | Source breakdown |
| GET | `/waitlist/device-breakdown` | view | Parses up to 20 000 user agents in Node |
| GET | `/waitlist/export` | view | Full CSV, audited as `waitlist.exported` |
| PATCH | `/waitlist/:id/status` | `waitlist:manage` | `pending | invited | converted` (any transition allowed) |

### 7.4 Users

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/users` | `users:view` | Filters: `search, city (default address), status, bookingsBucket (0, 1-5, 5-20, 20+), dateFrom, dateTo, sortBy, sortDir, page, pageSize`. `hasDispute` is accepted and ignored |
| GET | `/users/kpis` | view | `get_user_kpis()` |
| GET | `/users/export` | view | CSV (no BOM, no audit entry) |
| GET | `/users/:id` | view | `get_user_overview()` |
| GET | `/users/:id/addresses` · `/blocked-workers` · `/bookings` · `/reviews` · `/reports` | view | Detail tabs, availability-aware |
| POST | `/users/:id/actions/warn` | `users:warn` | `{ reason }`, increments `warning_count` |
| POST | `/users/:id/actions/suspend` | `users:suspend` | `{ reason, duration: 7d|30d|custom, until? }`. Sets `suspended_until`, `is_active=false` |
| POST | `/users/:id/actions/unsuspend` | `users:suspend` | Clears suspension, `is_active=true` |
| POST | `/users/:id/actions/ban` | `users:ban` | `{ reason }`, sets `banned_at`, `is_active=false` |
| PATCH | `/users/:id/actions/edit-contact` | `users:edit` | `{ phone?, email? }`, `409` on duplicate |
| POST | `/users/:id/actions/impersonate` | `users:impersonate` | Returns an impersonation URL (20 min JWT). See 21 |

### 7.5 Workers

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/workers` | `workers:view` | Filters: `search, city, categoryId, verification, status, presence, ratingBucket (lt3, 3-4, 4+, unrated), dateFrom, dateTo, sortBy (created_at, name, total_bookings, avg_rating)`. Deleted workers hidden unless `status=deleted` |
| GET | `/workers/kpis` · `/filter-options` · `/export` | view | KPIs, active categories, CSV (BOM) |
| GET | `/workers/:id` | view | `get_worker_overview()` |
| GET | `/workers/:id/performance` · `/earnings` · `/jobs` · `/reviews` · `/availability` · `/catalog` | view | Detail tabs, availability-aware |
| GET | `/workers/:id/documents` | `workers:verify` | KYC documents (CNIC images) |
| POST | `/workers/:id/actions/warn` | `workers:warn` | `{ reason }` |
| POST | `/workers/:id/actions/unsuspend` | `workers:suspend` | Lifts a suspension only; a banned worker stays banned |
| POST | `/workers/:id/actions/ban` | `workers:ban` | Also clears `is_featured` |
| PATCH | `/workers/:id/actions/edit-contact` | `workers:edit` | `{ phone?, email? }` |
| POST | `/workers/:id/actions/feature` | `workers:feature` | `{ featured: boolean }`. Only VERIFIED + not banned can be featured |
| POST | `/workers/:id/actions/badge` | `workers:badge` | `{ badge: top_rated|background_verified, action: add|remove }` |
| POST | `/workers/:id/actions/force-offline` | `workers:force-offline` | `{ reason }`. Sets `manually_paused = true` and back-dates `last_seen_at` by 1 h (back-dating alone would be undone by the next heartbeat) |
| POST | `/workers/:id/actions/request-reverification` | `workers:verify` | VERIFIED → UNVERIFIED, clears featured |
| POST | `/workers/:id/actions/approve-verification` · `reject-verification` · `request-info` | `workers:verify` | See 7.6 |

> The hook `workerActions.suspend` calls `POST /workers/:id/actions/suspend`. **That route does not exist** (see section 21).

### 7.6 Worker verification

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/workers/verification?tab=pending|resubmitted|approved|rejected&search&city&categoryId&page&pageSize` | `workers:verify` | Queue (one CTE shared with counts). Pending tabs oldest first |
| GET | `/workers/verification/counts` | verify | Tab counts + overdue 48 h / 72 h |
| GET | `/workers/:id/verification` | verify | Everything for the review page: worker, documents, skills, CNIC duplicates, decision history, activity |
| PATCH | `/workers/:id/verification/cnic` | verify | `{ cnicNumber }` 13 digits (dashes/spaces stripped), returns duplicates |
| POST | `/workers/:id/verification/view` | verify | Logs "who looked at this profile" (once per admin per 10 min) |

### 7.7 Bookings

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/bookings` | `bookings:view` | Filters: `search, status, city, categoryId, paymentStatus (paid|pending|refunded), hasDispute, amountMin/Max, dateFrom/To, sortBy (created_at, scheduled_at, amount, updated_at), sortDir` |
| GET | `/bookings/board` | view | Kanban: 6 columns, 20 per column, terminal columns last 7 days |
| GET | `/bookings/kpis` · `/export` | view | KPIs, CSV (max 20 000 rows, BOM) |
| GET | `/bookings/:id` | view | Full detail incl. pricing snapshot, parties, latest dispute |
| GET | `/bookings/:id/timeline` | view | `booking_status_history` (`available:false` if migration 008 missing) |
| GET | `/bookings/:id/chat` | view | `messages` (max 1000) |
| GET | `/bookings/:id/payment` | view | Booking money fields + up to 5 payment rows |
| GET | `/bookings/:id/location` | view | Job site + worker GPS trail (see 21) |
| GET, POST | `/bookings/:id/notes` | view / `bookings:note` | Internal notes (≤ 2000 chars) |
| GET | `/bookings/:id/reassign-candidates?search=` | `bookings:reassign` | Verified, active workers with the skill, no overlapping booking (20 max) |
| POST | `/bookings/:id/actions/cancel` | `bookings:cancel` | `{ reason, refundPercent 0–100 }` |
| POST | `/bookings/:id/actions/override-status` | `bookings:override` | `{ toStatus, reason }`, forward-only |
| POST | `/bookings/:id/actions/reassign` | `bookings:reassign` | `{ newWorkerId, reason }`. Returns `newBookingId` |
| POST | `/bookings/:id/actions/escalate` | `bookings:escalate` | `{ reason }`. Opens a dispute |

### 7.8 Disputes

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/disputes?tab=open|awaiting|escalated|resolved&…` | `disputes:view` | Filters: `search, city, categoryId, assigned (me|unassigned), resolution, amountMin/Max, dateFrom/To` |
| GET | `/disputes/counts` | view | Tab counts, overdue 48/72 h, refunded amount (30 d) |
| GET | `/disputes/refunds?source=dispute|everything&…` | view | Refunds view (same SQL as payments refunds) |
| GET | `/disputes/:id` | view | Detail: booking, parties, evidence URLs, refunds, activity |
| GET, POST | `/disputes/:id/notes` | view / `disputes:note` | Internal notes |
| POST | `/disputes/:id/actions/assign` | `disputes:assign` | `{ action: claim|release }` |
| POST | `/disputes/:id/actions/escalate` | `disputes:escalate` | `{ note }`. Marks `is_escalated`, clears assignment, **does not change `disputes.status`** |
| POST | `/disputes/:id/actions/resolve` | `disputes:resolve` | `{ resolution: REFUND_GRANTED|NO_REFUND|PARTIAL_REFUND, refundAmount?, note, overrideWindow? }` |

### 7.9 Payments (read-mostly, money moves through payment-service)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/payments/overview?period=mtd|ytd` | `payments:view` | Gross, fees, payouts, escrow, refunds, wallets, method split, attention counters |
| GET | `/payments/revenue?days=30|90` | view | Daily chart + by city |
| GET | `/payments/transactions` | view | Unified ledger: every payment + completed COD bookings. Returns `totals` |
| GET | `/payments/payouts` | view | `worker_payouts` (destinations masked to last 4) |
| GET | `/payments/refunds` | view | `refunds` list |
| POST | `/payments/refunds` | `payments:refund` | `{ paymentId, amount, reason }` → payment-service `POST /internal/refunds` (`ADMIN_MANUAL_REFUND`) |
| POST | `/payments/payouts/:id/retry` | `payments:payout` | FAILED payouts only → payment-service `POST /internal/payouts/:id/retry` |
| GET | `/payments/reports?type=monthly-revenue|transactions|payouts|tax-summary|city-value&dateFrom&dateTo` | `payments:export` | CSV (max 20 000 rows). Audited. Payout destinations are not exported |

### 7.10 Reviews

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/reviews?tab=flagged|all&…` | `reviews:view` | Filters: `search, rating, city, categoryId, status, signal (short_one_star|burst_one_star), workerId, userId, dateFrom/To` |
| GET | `/reviews/counts` | view | Flagged, auto/admin hidden, totals, 30-day average, sparkline |
| GET | `/reviews/audit?flag=low_rating|rapid_drop|many_disputes&city&search` | view | Worker rating audit |
| GET | `/reviews/:id` | view | Detail: reviewer stats, worker, reports, activity |
| GET, POST | `/reviews/:id/notes` | view / `reviews:note` | Internal notes |
| POST | `/reviews/:id/actions/moderate` | `reviews:moderate` | `{ action: hide|restore|dismiss, note }` |

### 7.11 Notifications

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/notifications/kpis` | `notifications:view` | Campaigns 30 d, sending, failed, recipients, delivery rate |
| GET | `/notifications/campaigns` · `/campaigns/:id` | view | History + per-channel delivery breakdown, feed read count, top errors |
| POST | `/notifications/audience/estimate` | `notifications:send` | `{ audience, category }` → segment count, push reach, SMS reach, sample of 5 |
| POST | `/notifications/audience/resolve` | send | Phones / emails / UUIDs → recipient IDs (max 500) |
| POST | `/notifications/broadcasts` | send | Launch (see 8.8). Responds `202` but runs synchronously |
| POST | `/notifications/test-send` | send | One recipient, always category `platform` |

### 7.12 Map, Analytics, Catalog

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/map/workers?city&categoryId&includeOffline` | `map:view` | Up to 3000 workers with a GPS row, plus counts by presence |
| GET | `/map/bookings?status&city&categoryId` | map | ACCEPTED and IN_PROGRESS jobs with job-site and worker position (max 1000) |
| GET | `/map/demand?hours=6|24|72|168&categoryId` | map | Heatmap cells. Falls back to booking locations when `search_demand_log` is empty |
| GET | `/analytics/kpis` | `analytics:view` | DAU, DAW, completion, avg value, acceptance, 7-day retention |
| GET | `/analytics/growth?days=7|30|90` | analytics | Daily series + 7-day MA + city trend (top 6 + "Other") |
| GET | `/analytics/funnels?days=` | analytics | User and worker funnels |
| GET | `/analytics/cities?days=` · `/categories?days=` | analytics | Performance tables |
| GET | `/categories` · `/categories/kpis` · `/categories/:id` | `categories:view` | List, KPIs, detail |
| POST | `/categories` | `categories:create` | `id` slug 3–50 chars `[a-z0-9-]`, immutable after creation. `409` if it exists |
| PATCH | `/categories/:id` | `categories:edit` | name, nameUr, iconUrl, parentId, sortOrder |
| POST | `/categories/:id/actions/toggle-active` | categories:edit | `{ isActive }` |
| GET | `/categories/:id/services` | categories:view | Services of a category |
| POST | `/categories/:id/services` | `services:edit` | `priceType` fixed / hourly / quote (quote → `base_price = NULL`) |
| PATCH | `/categories/:id/services/:serviceId` | services:edit | Update |
| POST | `/categories/:id/services/:serviceId/actions/toggle-active` | services:edit | `{ isActive }` |
| GET | `/pricing-config` | `settings:view` | Global multipliers |
| PATCH | `/pricing-config` | `settings:edit` | All six numeric fields required |

---

## 8. Modules & Business Rules

### 8.1 Dashboard

Five widgets, 30 s SWR refresh. "Needs attention" thresholds are hard-coded in `get_needs_attention()`: dispute unresolved > 24 h (OPEN, WORKER_RESPONDED, UNDER_REVIEW), verification pending > 48 h, any FAILED payment, booking PENDING > 30 min, any review with an unresolved report. Revenue KPIs use `payments` (HELD/RELEASED); the chart uses `bookings.created_at` of completed bookings, while Finance dates revenue by **completion** time. The three can differ for the same day.

### 8.2 Users

Status is derived: `deleted > banned > suspended (until > now) > active (is_active) > inactive`. Suspend sets `is_active=false` so auth-service stops login; ban does the same. `unsuspend` sets `is_active=true` (a banned user still reads as banned because `banned_at` stays set). There is no "unban" action. Edit-contact changes the phone, which is the user's **login identity** in auth-service.

### 8.3 Workers

- Same derived status plus **presence** (`online`, `away`, `on_job`, `paused`, `offline`).
- Rating buckets only count workers with reviews (a new worker with `avg_rating = 0` is "unrated", never "below 3").
- Featured: only VERIFIED and not banned; banning, rejecting or requesting re-verification clears it.
- Badges `top_rated`, `background_verified` are admin-awarded rows in `worker_badges`. (worker-service doc lists `top_rated` automation as pending and also awards `background_verified` from approved police clearance; both write the same table.)

### 8.4 Worker verification

Queue tabs (30-day window for decided tabs): `pending` (PENDING_REVIEW, first submission), `resubmitted` (PENDING_REVIEW with any past rejection or a re-verification request), `approved`, `rejected`. SLA badge: amber ≥ 48 h, red ≥ 72 h since the oldest PENDING document.

**Approve** (single transaction, row lock on the worker):
1. Worker must be `PENDING_REVIEW` and not banned.
2. Must have an identity document that is not rejected (**currently `NATIONAL_ID` or `PASSPORT`**, see 21).
3. If a CNIC is stored, no other non-deleted worker may share it.
4. All PENDING documents → APPROVED; worker → VERIFIED (`verified_at/by`); decision row; outbox `worker.verified`.

**Reject:** reason code (6 values) + note (≤ 1000) + `allowResubmission` (default true). Every PENDING document gets the note as `rejection_note` (worker-service already returns it to the app). Worker → REJECTED, featured cleared, outbox `worker.rejected`.

**Request info:** records an `info_requested` decision and outbox event; status stays PENDING_REVIEW.

**CNIC:** admin types the 13-digit number from the image; the save endpoint runs the duplicate lookup and returns the other accounts.

### 8.5 Bookings

Board columns: `pending`, `accepted`, `in_progress`, `completed_by_worker`, `completed` (COMPLETED + AUTO_COMPLETED), `cancelled_disputed` (CANCELLED, REJECTED, DISPUTED, REFUNDED, RESOLVED). City = `COALESCE(job address city, worker city)` because bookings has no city column. Payment status is derived: refund_amount > 0 → `refunded`; `is_payment_confirmed` → `paid`; else `pending`.

| Action | Allowed from | Effect |
|---|---|---|
| **Cancel** | PENDING, ACCEPTED, IN_PROGRESS | `CANCELLED`, `cancelled_by='admin'`, `refund_amount = total × pct / 100`, outbox `booking.cancelled`, notifications to both parties (if enabled) |
| **Override status** | PENDING→ACCEPTED, ACCEPTED→IN_PROGRESS, IN_PROGRESS→COMPLETED, COMPLETED_BY_WORKER→COMPLETED | Forward only. Sets `started_at` / `completed_at`. COMPLETED also emits `booking.payment_release`. `COMPLETED_BY_WORKER` is deliberately not a target (needs booking-service's 24 h auto-complete job) |
| **Reassign** | PENDING, ACCEPTED | New PENDING booking for the new worker (same pricing snapshot, 30 min expiry), old booking CANCELLED with 0 refund. New worker must be verified, active and have the category skill. Exclusion-constraint violation (`23P01`) → `409` |
| **Escalate** | COMPLETED_BY_WORKER only | Inserts a dispute (`[Opened by admin] …`), booking → DISPUTED. A second open dispute hits the partial unique index → `409` |

Every action: `setActor()` tags the transaction (`app.actor`), the booking row is locked, the outbox row is written in the same transaction, the audit log entry is written after commit. Refund helper `standardRefundPercent` (PENDING 100, ACCEPTED > 24 h 90, ≤ 24 h 50, else 0) is a UI suggestion only; the admin picks the percentage.

### 8.6 Disputes

Tabs: **open** = active, not escalated, not still waiting for the worker; **awaiting** = status OPEN, no worker response, created < 24 h ago; **escalated** = active + `is_escalated`; **resolved** = RESOLVED/CLOSED in the last 30 days.

- **Claim / release:** an escalated dispute can only be claimed by SUPER_ADMIN; another admin's claim blocks others unless SUPER_ADMIN.
- **Escalate:** needs a note; clears assignment; SUPER_ADMIN picks it up.
- **Resolve** (transaction; lock order **booking → dispute**, same as booking-service):
  - booking must be `DISPUTED`;
  - escalated disputes: SUPER_ADMIN only;
  - still inside the worker's 24 h response window → blocked (`409`) unless `overrideWindow: true` (logged);
  - the **server** computes the money: `REFUND_GRANTED` = full total, `NO_REFUND` = 0, `PARTIAL_REFUND` must be > 0 and < total;
  - dispute → RESOLVED; booking → `REFUNDED` (any refund) or `RESOLVED` (no refund);
  - outbox `booking.dispute_resolved` (payment-service consumes it); notifications to both parties.

### 8.7 Payments & finance

The panel **never writes payment tables**. Revenue is counted from completed bookings (`COMPLETED`, `AUTO_COMPLETED`) by completion time, because COD bookings have no `payments` row until booking-service settles them. Ledger status = `payments.status`, or `COD_COLLECTED` when a completed booking has no payment row; method = `COALESCE(payments.method, 'COD')`.

- Manual refund checks: payment exists, status in `HELD | RELEASED | PARTIALLY_REFUNDED`, amount ≤ gross − sum(non-failed refunds). payment-service creates the refund and calls the gateway.
- Destinations (phone, IBAN) are masked to the last 4 characters before they leave the server and are not in CSV exports.
- CSV cells starting with `= + - @` are prefixed with `'` (formula injection guard).

### 8.8 Notifications (direct broadcast)

```
POST /notifications/broadcasts
  ├─ permission notifications:send; segments all_users / all_workers need notifications:broadcast-all
  ├─ parse + validate: campaign label, audience, channels (push, sms), message (template or custom), category
  ├─ duplicate guard: same template_key launched in the last 35 s → 429
  └─ launchDirectBroadcast()
       ├─ resolve recipients with SQL (all_users, all_workers, category_city = verified workers with the skill in a city, custom_ids)
       ├─ INSERT broadcast_campaigns (status SENDING)
       ├─ for each recipient, sequentially:
       │     INSERT notifications (in-app feed row)
       │     if channel push: no fcm_token → counted as noToken
       │                       else sendDirectPush() → INSERT notification_deliveries (SENT / FAILED)
       │                       dead token (not-registered) → fcm_token = NULL on users/workers
       └─ UPDATE broadcast_campaigns SET status COMPLETED, sent_count, completed_at
```

- Messages come from `lib/notification-catalog.ts` (18 templates, English + Roman Urdu, variables validated) or a custom message (title ≤ 65, push body ≤ 178, SMS body ≤ 150, deep link `tasklync://…`).
- Quiet hours (22:00–08:00 Karachi) are a UI warning (`acknowledgeQuietHours`), not a server block.
- `scripts/generate-broadcast-templates.ts` writes push JSON and SMS `.hbs` files into `generated-templates/`; copy them into notification-service if you still want it to send the same templates.
- **Important:** the engine sends **push only**. SMS is accepted as a channel but nothing sends it, and recipients' `notification_preferences` are not consulted. See 21.

### 8.9 Reviews

Moderation transitions (`lib/review-constants.ts`): `hide` → `ADMIN_HIDDEN` from VISIBLE, AUTO_HIDDEN, ADMIN_RESTORED; `restore` → `ADMIN_RESTORED` from AUTO_HIDDEN, ADMIN_HIDDEN; `dismiss` ("keep review") → `ADMIN_RESTORED` from AUTO_HIDDEN, no change otherwise. Every action resolves the open reports of that review. A review with nothing to change and no open report returns `409`. Public statuses: `VISIBLE` and `ADMIN_RESTORED`.

Extra signals computed in SQL (not in review-service): `short_one_star` (rating 1, comment < 20 chars) and `burst_one_star` (same user gave ≥ 2 workers a 1-star within ±24 h).

Rating audit flags (visible reviews only): `low_rating` (avg < 3.5, ≥ 3 reviews), `rapid_drop` (7-day drop > 0.5), `many_disputes` (≥ 3 disputes in 30 days).

### 8.10 Live map

SWR polling, no WebSocket: workers 5 s, jobs 15 s, demand 60 s. Offline workers are hidden by default. Colors per presence in `map-constants.ts`. Demand = searches (or bookings as fallback) per ~2 km cell; `unserved = max(demand − supply × 2, 0)` where supply = online verified workers in the cell. Optional Redis overlay (`MAP_USE_REDIS_LOCATION=true`) replaces the DB position with `worker:location:{id}` when it is fresher.

### 8.11 Analytics

Windows: 7 / 30 / 90 days, 60 s refresh. DAU / DAW are rolling 24 h; completion, acceptance and average value use fixed 7-day windows against the previous 7 days; retention = share of users whose first booking fell in the previous window and who booked again within 7 days. Funnels count people **registered** in the window, and each stage is a subset of the previous one.

### 8.12 Categories & pricing

Category `id` is an immutable slug. `quote` services have no base price. The pricing config (`platform_pricing_config`) is a singleton edited here; **booking-service does not read it yet** (see 21).

---

## 9. Cross-Service Contract

### 9.1 Integration style per service

| Service | Integration | Details |
|---|---|---|
| auth-service | Shared columns | `users` ban / suspend / `is_active` / `deleted_at` enforced at login and refresh. No HTTP call, so existing refresh sessions in Redis are **not** killed when you ban someone (they die at the next refresh, ≤ 15 min, because auth-service re-checks status) |
| user-service | Shared columns + cache | Same status columns. user-service caches status 60 s in `user:status:{id}` and expects the admin panel to `DEL` it |
| worker-service | Shared columns + cache | Same. `worker:status:{id}` (60 s) must be deleted after ban / suspension |
| booking-service | Direct writes + outbox | Cancel, override, reassign, escalate, dispute resolve update `bookings` / `disputes` in the admin's own transaction and queue `booking.events` |
| payment-service | HTTP (`x-internal-key`) | Refund + payout retry. Reads its tables. Consumes `booking.dispute_resolved` |
| review-service | Direct writes | Moderation writes `reviews` directly and deletes two Redis keys |
| notification-service | Replaced | Broadcasts no longer go through the gateway (ADR-009) |
| search-service | Table | Must INSERT into `search_demand_log` (lat, lng, category_id, result_count) |
| chat-service | Read | `messages` for the booking chat tab |

### 9.2 Outbox events produced

Written to `admin_event_outbox` inside the same transaction as the state change. Envelope matches booking-service: `{ event_type, booking_id, user_id, worker_id, status, timestamp, data: { …, triggered_by: 'admin', admin_email } }`.

| Topic | Event | Trigger |
|---|---|---|
| `booking.events` | `booking.cancelled` | admin cancel, reassign (old booking) |
| | `booking.created` | reassign (new booking), `data.reassigned_from_booking_id` |
| | `booking.accepted`, `booking.started`, `booking.completed` | override status |
| | `booking.payment_release` | override to COMPLETED |
| | `booking.disputed` | escalate booking |
| | `booking.dispute_resolved` | resolve dispute |
| `worker.events` | `worker.verified`, `worker.rejected`, `worker.verification_info_requested` | verification decisions |
| `notification.send` | `notification.send` | only when `ADMIN_BOOKING_NOTIFICATIONS=true` (templates `booking_cancelled_by_admin`, `booking_request_received`, `booking_reassigned`, `dispute_resolved` must exist first) |

> **No process publishes this outbox.** Migration 007 names `scripts/publish-outbox.ts`; the file is not in the repository. Until it exists, other services never see these events. See 21 (item 1).

### 9.3 Backend contract (what other teams must do)

| Team | Required |
|---|---|
| auth / user / worker | Keep reading `banned_at`, `suspended_until`, `is_active`, `deleted_at` (they do). Do not rename those columns |
| booking | Consume the admin outbox events like its own. Read `platform_pricing_config` (env fallback). Treat admin-made cancels/refunds like its own (worker `is_on_job` re-sync, BullMQ job cleanup) |
| payment | Consume `booking.dispute_resolved`; expose `/internal/refunds` and `/internal/payouts/:id/retry` (exist) |
| review | Expose or accept the admin moderation as an event (`review.moderated`) so `workers.avg_rating` updates |
| search | Write `search_demand_log` |
| worker | Publish `worker.location` history if the booking trail is wanted; align KYC document types and rejection codes (section 21) |
| mobile | Handle `worker.rejected` info; deep links used by broadcasts (confirm real `tasklync://` paths) |

---

## 10. Security

### Controls

| Area | Control |
|---|---|
| Transport / headers | HSTS (1 y), `X-Frame-Options: DENY`, `nosniff`, strict referrer, empty Permissions-Policy, `poweredByHeader` off. `Cache-Control: no-store` on `/auth/*` and `/api/admin/*` |
| CSRF | SameSite=Lax cookies **plus** Origin = Host check on every unsafe `/api/*` call (middleware). Requests without an `Origin` header (non-browser) pass but still need the cookies |
| Authn | Password + mandatory TOTP, trusted devices, lockout, per-IP and per-email rate limits, constant-time dummy hash, generic error text |
| Authz | Permission per route, checked server-side with Redis session. Session scope `mfa_setup` can reach nothing but MFA enrolment |
| Sessions | Rotating refresh tokens, theft detection, 3 sessions max, absolute expiry, deactivation kills all sessions |
| Secrets at rest | TOTP AES-256-GCM, backup codes HMAC, passwords bcrypt, refresh/device secrets hashed |
| Input | `zod` on auth routes; UUID check on `:id` for workers, bookings, disputes, reviews, payouts, campaigns; whitelists for sort columns, enums, tabs; free text is always bound as `$n` parameters |
| SQL | Parameterised everywhere. The only interpolated values are whitelisted constants (sort columns, thresholds, table names chosen from `users`/`workers`) |
| Open redirect | `safeNextPath()` allows only same-site relative paths, never `/auth` or `/api/` |
| PII | Payout / refund destinations masked; CNIC documents behind `workers:verify`; CSV formula-injection guard on finance exports |
| Audit | Every admin mutation writes `admin_audit_log` with admin, IP, user agent, old/new value, reason |
| Bot noise | Waitlist stats classify Postman/curl/etc. as bots |

### Known limits (summary, details in 21)

- Impersonation is the most sensitive endpoint and has no consumer defined here.
- DB TLS uses `rejectUnauthorized: false` (encrypts, does not verify the server certificate).
- `getClientIp` trusts `x-real-ip` / `x-forwarded-for`; it is only safe behind a proxy that overwrites them. Per-account lockout does not depend on it.
- Audit log entries are written **after** the action commits; a failure there returns 500 for an action that did happen.
- Rate limiting is only applied to the auth endpoints, not to the data APIs.
- Many handlers (users, categories, waitlist) do not validate the `:id` as a UUID; invalid ids end in a SQL error (`500`).
- Free-text fields (notes, reasons) are stored as typed; the UI must render them as text.

---

## 11. Configuration & Environment Variables

`.env.example` in the repo lists only part of what the code reads. This is the complete list found in the code.

### Core (required)

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Shared Supabase Postgres. The sample file shows a database called `tasklync_admin`, but all migrations assume the shared database |
| `REDIS_URL` | Redis ≥ 6.2 (uses `GETDEL`) |
| `ADMIN_JWT_SECRET` | ≥ 32 bytes. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
| `ADMIN_MFA_ENCRYPTION_KEY` | 32 bytes base64: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `NEXT_PUBLIC_ADMIN_URL` | `https://admin.tasklync.pk` |

### Auth tuning (all optional, defaults shown)

| Variable | Default |
|---|---|
| `ADMIN_ACCESS_TOKEN_TTL` | `900` |
| `ADMIN_SESSION_REMEMBER_TTL` | `604800` (7 d) |
| `ADMIN_SESSION_SHORT_TTL` | `28800` (8 h) |
| `ADMIN_TRUSTED_DEVICE_TTL` | `604800` |
| `ADMIN_MFA_TEMP_TOKEN_TTL` | `300` |
| `ADMIN_REFRESH_GRACE_SECONDS` | `20` |
| `ADMIN_MAX_FAILED_ATTEMPTS` | `5` |
| `ADMIN_LOCKOUT_MINUTES` | `30` |
| `ADMIN_MAX_CONCURRENT_SESSIONS` | `3` |
| `ADMIN_MFA_REQUIRED` | `true` (only the literal `false` disables it) |

### Integrations (read by code, **missing from `.env.example`**)

| Variable | Used by | Needed for |
|---|---|---|
| `PAYMENT_SERVICE_URL`, `PAYMENT_SERVICE_INTERNAL_KEY` | `lib/payment-service.ts` | Manual refund, payout retry (503 if unset) |
| `FCM_SERVICE_ACCOUNT_JSON_BASE64` (aliases: `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64`, `FIREBASE_SERVICE_ACCOUNT`, `FCM_SERVICE_ACCOUNT_JSON`) | `lib/firebase-admin.ts` | Push. Alternative: `FIREBASE_PRIVATE_KEY` + `FIREBASE_CLIENT_EMAIL`, or a local `service-account.json` (dev only) |
| `FCM_PROJECT_ID` (alias `FIREBASE_PROJECT_ID`) | firebase-admin | Defaults to `tasklync-6e7ae` |
| `IMPERSONATION_JWT_SECRET`, `NEXT_PUBLIC_APP_URL` | impersonate route | The route crashes (`!` non-null assertions) when unset |
| `ADMIN_BOOKING_NOTIFICATIONS` | `bookings-api.ts` | `true` to queue `notification.send` outbox rows |
| `MAP_USE_REDIS_LOCATION` | `map-api.ts` | `true` to overlay Redis GPS on the map |
| Mapbox access token | map component (not read in this review) | Live map. Confirm the variable name in `components/map/MapView.tsx` |
| `API_GATEWAY_URL`, `GATEWAY_ADMIN_KEY` | `lib/notification-service.ts` | **Unused** since the direct engine; safe to remove with that file |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | nothing in the reviewed code | Listed in `.env.example`; no `@supabase/*` package is installed. Remove, or document the use |

### Rules

- Never commit `.env` or `service-account.json`.
- `ADMIN_JWT_SECRET` shorter than 32 bytes throws on first use (every request fails with 401/500).
- `getSecret()` and the encryption key are read lazily, so a missing key only shows up at the first login.

---

## 12. Redis Keys

| Key | TTL | Value | Purpose |
|---|---|---|---|
| `admin:sess:{sid}` | remaining session life | SessionRecord JSON | Session |
| `admin:rt:{sha256(refresh)}` | same | sid | Current refresh token |
| `admin:rt_used:{sha256}` | same | `{ sid, at }` | Rotated token memory |
| `admin:sessions:{adminId}` | 7 d | zset of sids | Concurrent session cap |
| `admin:mfa_tmp:{jti}` | 5 min | adminId | Single-use MFA challenge |
| `admin:mfa_fail:{adminId}` | 15 min | integer | Wrong MFA codes |
| `admin:mfa_pending:{adminId}` | 10 min | plaintext TOTP secret | Setup in progress |
| `admin:totp_used:{adminId}:{code}` | 120 s | `1` | TOTP replay protection |
| `admin:rl:login:ip:{ip}` | 15 min | integer | Login, 30 per IP |
| `admin:rl:login:email:{email}` | 15 min | integer | Login, 15 per email |
| `admin:rl:mfa:ip:{ip}` | 15 min | integer | MFA verify, 40 per IP |
| `admin:rl:refresh:ip:{ip}` | 15 min | integer | Refresh, 120 per IP |
| `admin:rl:mfa-setup:{adminId}` | 1 h | integer | 10 per hour |
| `admin:rl:mfa-setup-confirm:{adminId}` | 10 min | integer | 8 per 10 min |

Keys the admin panel **reads or deletes in other services' namespaces**: `worker:location:{id}` (read, optional), `review:{id}` and `rating:summary:{workerId}` (deleted after moderation). It does **not** delete `user:status:{id}` or `worker:status:{id}` (see 21).

The rate limiter **fails closed**: a Redis error propagates and the request fails with 500.

---

## 13. Audit Log

`admin_audit_log` is append-only and written by `logAdminAction()` (throws on failure) or `logAuthEvent()` (swallows failure so login never breaks).

| Area | Actions |
|---|---|
| Auth | `auth.login_failed`, `auth.login_success`, `auth.login_trusted_device`, `auth.login_mfa_pending`, `auth.login_mfa_setup_required`, `auth.mfa_enabled`, `auth.mfa_success`, `auth.mfa_success_backup_code`, `auth.mfa_failed`, `auth.mfa_lockout`, `auth.logout`, `auth.logout_forget_device`, `auth.refresh_reuse_detected` |
| Users | `user.warned`, `user.suspended`, `user.unsuspended`, `user.banned`, `user.contact_edited`, `user.impersonation_started` |
| Workers | `worker.warned`, `worker.unsuspended`, `worker.banned`, `worker.contact_edited`, `worker.featured`, `worker.unfeatured`, `worker.badge_awarded`, `worker.badge_removed`, `worker.forced_offline`, `worker.reverification_requested`, `worker.verification_approved`, `worker.verification_rejected`, `worker.verification_info_requested`, `worker.verification_cnic_saved`, `worker.verification_viewed` |
| Bookings | `booking.cancelled_by_admin`, `booking.status_overridden`, `booking.reassigned`, `booking.escalated_to_dispute`, `booking.note_added` |
| Disputes | `dispute.claimed`, `dispute.released`, `dispute.escalated`, `dispute.resolved`, `dispute.note_added` |
| Payments | `payment.manual_refund`, `payout.retried`, `payments.report_exported` |
| Reviews | `review.hidden`, `review.restored`, `review.reports_dismissed`, `review.note_added` |
| Notifications | `notification.broadcast_launched`, `notification.test_dispatched` |
| Catalog | `category.created`, `category.updated`, `category.activated`, `category.deactivated`, `service.created`, `service.updated`, `service.activated`, `service.deactivated`, `pricing_config.updated` |
| Waitlist | `waitlist.status_updated`, `waitlist.exported` |

The disputes, reviews and verification detail pages show a filtered slice of this table as their "Activity" tab (`resource_type` + `resource_id`).

**Not logged:** user export, workers export, bookings export (only waitlist and payment reports are), failed permission checks, and all read access to CNIC documents (only the review-page open is logged).

Useful queries:

```sql
-- Who did what to this record
SELECT created_at, admin_email, action, notes FROM admin_audit_log
WHERE resource_type = 'worker' AND resource_id = '<uuid>' ORDER BY created_at DESC;

-- Failed logins and lockouts, last 24 h
SELECT created_at, admin_email, action, ip_address, notes FROM admin_audit_log
WHERE action IN ('auth.login_failed','auth.mfa_failed','auth.mfa_lockout')
  AND created_at > now() - interval '24 hours' ORDER BY created_at DESC;

-- Impersonations ever started
SELECT created_at, admin_email, resource_id FROM admin_audit_log WHERE action = 'user.impersonation_started';
```

---

## 14. Error Handling Standard

- Responses: `{ "error": "Human-readable message" }`. Auth routes may add `code` (`MFA_SETUP_REQUIRED`).
- Each domain has an `*ActionError(status, message)` class (`BookingActionError`, `DisputeActionError`, `ReviewActionError`, `VerificationError`, `PaymentActionError`, `NotificationActionError`) thrown inside transactions and mapped by `bookingErrorResponse`, `disputeErrorResponse`, `reviewErrorResponse`, `errorResponse`, `paymentsErrorResponse`, `notificationsErrorResponse`.
- Postgres codes handled: `23505` unique → `409`; `23P01` exclusion (worker double booked) → `409`; `42P01` / `42703` (table or column missing) → `503` with "run migration X", or `available:false` for detail tabs; `23503` FK → worker not found.
- External services: `PaymentServiceError` (>= 500 mapped to `502`), `NotificationServiceError`.
- Anything else: `console.error(tag, err)` + generic message + `500`. No stack traces leak.

| Status | Meaning here |
|---|---|
| 400 | Validation failed (missing reason, bad enum, invalid amount) |
| 401 | No / expired token or destroyed session (client interceptor refreshes) |
| 403 | Permission missing, MFA setup required, CSRF origin mismatch, escalated-dispute rule |
| 404 | Not found, or `:id` not a UUID (most modules) |
| 409 | Conflict or state guard ("someone already decided", duplicate, overlap) |
| 422 | Business rule (status not allowed, worker not eligible) |
| 423 | Admin account locked |
| 429 | Auth rate limit, duplicate broadcast guard |
| 502 / 503 | payment-service unreachable / not configured, migration missing |

---

## 15. Frontend Conventions

### Design system (`globals.css`)

| Token | Value |
|---|---|
| Page background | `#F7F8FA` |
| Surface / border | `#FFFFFF` / `#E5E7EB` |
| Text primary / secondary / muted | `#111827` / `#6B7280` / `#9CA3AF` |
| Accent (brand green) | `#1F6F5F`, hover `#195c4f` |
| Success / warning / danger / info | `#16A34A` / `#D97706` / `#DC2626` / `#2563EB` with matching tints |
| Fonts | Inter (sans), JetBrains Mono (mono) via `next/font` |

Primitives: `Button` (primary, secondary, destructive, ghost; sm, md; loading), `Input`, `Card`, `Badge` (tones), `StatusBadge`, `DataTable` (loading skeleton, error + retry, empty state, row click), `ConfirmDialog` (reason box, typed confirmation, async confirm). Layout: 240 px sidebar (64 px collapsed, persisted in `localStorage`), 56 px header with breadcrumb.

### Page pattern per module

`Section` component (owns filters + tab state) → `KpiGrid` → `FilterBar` → `Table` → optional dialogs. Detail pages: `Header`, `Summary`, parties, tabs (activity, notes), admin action panel. Pagination resets to page 1 on any filter change (`update()` in every `use*Filters`).

### Data fetching

- `fetcher` (`lib/swr-fetcher.ts`) throws `Error(body.error)` on non-2xx.
- Mutations are plain `fetch` in a per-module `*Actions` object (`bookingActions`, `disputeActions`, `workerActions`, …). After a mutation the component calls `mutate()` on the list/detail hook.
- Auth refresh is global (section 5.4); hooks never handle 401.

| Poll interval | Where |
|---|---|
| 5 s | map workers |
| 15 s | map jobs |
| 30 s | dashboard, booking/dispute/review detail and lists, worker presence, notification KPIs |
| 60 s | analytics, finance, dispute / review lists, map demand, waitlist UTM |
| 5 s while sending | campaign detail when `status = SENDING` |

### Known UI inconsistency

`app/auth/layout.tsx` uses `bg-[--bg-page]`, and `DataTable` uses `text-[--accent]`. Those CSS variables are not defined (the tokens are `--color-*`), so Tailwind 4 ignores them. Use `bg-bg-page` / `text-accent`.

---

## 16. Local Development Setup

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 20 |
| npm | ≥ 10 |
| PostgreSQL + PostGIS | the shared TaskLync database (all 8 backend services' migrations applied first) |
| Redis | ≥ 6.2 |

### Steps (Windows / PowerShell)

```powershell
# 1. Install
npm install

# 2. Environment
Copy-Item .env.example .env
# fill DATABASE_URL, REDIS_URL, ADMIN_JWT_SECRET, ADMIN_MFA_ENCRYPTION_KEY
# add the integration variables from section 11 you need (FCM_*, PAYMENT_SERVICE_*)

# 3. Migrations, in order, against the shared DB
psql $env:DATABASE_URL -f db/migrations/001_admin_auth.sql
# ... 002 to 015, one by one

# 4. First super admin (max 2 via script)
npx tsx scripts/seed-super-admin.ts
# prompts: email, full name, temporary password (12+ chars, upper + lower + digit)

# 5. Run
npm run dev          # http://localhost:3000
```

First login → password → forced MFA enrolment (QR, 6-digit code, **save the 10 backup codes**) → dashboard.

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` / `lint` | Standard Next.js |
| `npm run setup:firebase` | Reads `service-account.json`, writes `FCM_PROJECT_ID` and `FCM_SERVICE_ACCOUNT_JSON_BASE64` into `.env` (and the backend notification-service `.env` if the relative path exists) |
| `.\scripts\encode-firebase-credentials.ps1` | Same, PowerShell, copies the base64 to the clipboard |
| `npx tsx scripts/generate-broadcast-templates.ts [outDir]` | Writes push/SMS templates (default `./generated-templates`) |
| `npx tsx scripts/test-direct-broadcast.ts` | Sends one real push to a hard-coded user id. **Edit the ids before running** |

### Local shortcuts and gotchas

- Port 3000 is also the API Gateway's port in the other docs; change one of them (`next dev -p 3100`) when running both.
- Cookies are `Secure` only in production, so plain `http://localhost` works.
- Redis must be reachable: the login route calls it, and the rate limiter fails closed.
- Without Firebase credentials, test sends still create the in-app feed row and report "Firebase Admin unconfigured".

---

## 17. Testing

`vitest` and `supertest` are in `devDependencies`, but there is **no test script and no test files** in the repository yet. Current verification is manual. Minimum smoke checklist after every deploy:

| # | Check | Expect |
|---|---|---|
| 1 | Open `/` without cookies | Redirect to `/auth/login` |
| 2 | Wrong password 5 times for one email | 6th correct attempt gives `423` locked |
| 3 | Correct password, no MFA enrolled | Redirect to `/auth/mfa-setup`; opening `/` bounces back |
| 4 | Complete MFA setup | Backup codes shown once; dashboard loads |
| 5 | Reuse the same TOTP code twice | Second fails |
| 6 | Wait 16 min on a tab, click a list page | Silent refresh, no login screen |
| 7 | Log out in tab A, call an API from tab B | `401`, then redirect to login |
| 8 | Sign in as OPS, open `/payments` | Redirected to `/` |
| 9 | POST any `/api/admin/*` with a foreign `Origin` header | `403` |
| 10 | Cancel a PENDING booking | Booking CANCELLED, history row `admin:<email>`, outbox row, audit row |
| 11 | Resolve a dispute inside the worker's 24 h window without override | `409` |
| 12 | Approve a worker with no identity document | `409` |
| 13 | Launch a broadcast to one test user | Feed row + `notification_deliveries` row |
| 14 | `SELECT count(*) FROM admin_event_outbox WHERE published_at IS NULL` | Should be 0 once the relay exists |

Recommended first automated tests (pure logic, no DB): `resultingStatus` (reviews), `standardRefundPercent`, `safeNextPath`, `checkValues` / `renderCopy` (notification catalog), `permissionForPath` ordering, `normalizeBackupCode`, `buildBookingWhere` parameter numbering.

---

## 18. Deployment

Target: Vercel (README) or any Node host. The app needs outbound access to Postgres, Redis, payment-service and Google (FCM).

### Pre-deploy checklist

```
□ npm run build passes, npm run lint clean
□ Migrations 001 to 015 applied in order on the shared DB; get_user_kpis() exists
□ Other services' tables exist first (users, workers, bookings, disputes, payments, reviews, notifications)
□ ADMIN_JWT_SECRET (≥ 48 chars random) and ADMIN_MFA_ENCRYPTION_KEY (32 bytes base64) set, backed up separately
□ DATABASE_URL, REDIS_URL set; Redis persistent and ≥ 6.2, TLS + password in production
□ NEXT_PUBLIC_ADMIN_URL = https://admin.tasklync.pk
□ PAYMENT_SERVICE_URL + PAYMENT_SERVICE_INTERNAL_KEY (same key as payment-service)
□ FCM_SERVICE_ACCOUNT_JSON_BASE64 set as a project secret (never in the repo)
□ IMPERSONATION_JWT_SECRET + NEXT_PUBLIC_APP_URL set, or the impersonate route removed
□ Mapbox token set for the live map
□ Proxy overwrites x-real-ip / x-forwarded-for (Vercel does; nginx needs proxy_set_header X-Real-IP $remote_addr)
□ super admin seeded; second super admin created as the break-glass account
□ ADMIN_MFA_REQUIRED not set to false
□ Outbox relay running (section 21, item 1) OR booking/dispute actions disabled in the UI
□ search-service writes search_demand_log (else the heatmap uses booking locations)
□ admin panel deletes user:status:{id} / worker:status:{id} after ban/suspend (or accept 60 s delay)
□ Cloudinary: next.config image host matches the real cloud name (currently df47l0i1v)
```

### Rollout order

1. Apply new migrations (additive, idempotent, safe before the code).
2. Deploy the app.
3. Tell the owning teams about any new column on their tables.

### Rotating secrets

| Secret | Effect of rotation |
|---|---|
| `ADMIN_JWT_SECRET` | All access tokens and MFA challenges invalid; admins re-login (refresh tokens are opaque and survive, so users are silently re-issued) |
| `ADMIN_MFA_ENCRYPTION_KEY` | **Breaks every stored TOTP secret and backup code.** Re-encrypt before rotating, or reset MFA for all admins |
| `PAYMENT_SERVICE_INTERNAL_KEY` | Change in both places at once |

---

## 19. Runbooks & Troubleshooting

| Symptom | Check / fix |
|---|---|
| Every request redirects to login | `ADMIN_JWT_SECRET` changed or missing; Redis unreachable (session lookup fails); cookie `Secure` on plain http in production-mode build |
| `Error: ADMIN_JWT_SECRET must be set and at least 32 bytes long` | Env var missing or short |
| `ADMIN_MFA_ENCRYPTION_KEY must be 32 bytes (base64)` | Regenerate with the command in section 11 (only safe before any admin enrolled) |
| Admin locked out | `UPDATE admin_users SET failed_attempts = 0, locked_until = NULL WHERE LOWER(email) = '…';` then `DEL admin:rl:login:email:<email>` and the IP key in Redis |
| Admin lost the authenticator and backup codes | Super admin: `UPDATE admin_users SET mfa_enabled = false, mfa_secret = NULL WHERE …; DELETE FROM admin_mfa_backup_codes WHERE admin_id = …; UPDATE admin_trusted_devices SET revoked_at = now() WHERE admin_id = …;` then kill sessions (below). Next login forces enrolment. There is no UI for this |
| Force-logout one admin | Redis: `ZRANGE admin:sessions:<adminId> 0 -1`, then `DEL admin:sess:<sid>` per sid. Or set `is_active = false` (all sessions die at the next refresh, ≤ 15 min; API calls with a dead session fail immediately only if the Redis key is also deleted) |
| `Analytics functions are missing or out of date` (503) | Run `011_analytics.sql` |
| `Dispute tables are out of date` (503) | Run `010_disputes_admin.sql` |
| `Review tables are out of date` (503) | Run review-service migrations, then `014` |
| Booking timeline empty, "unavailable" | Migration 008 not applied |
| `payment-service is not configured` | `PAYMENT_SERVICE_URL` / `PAYMENT_SERVICE_INTERNAL_KEY` missing |
| Push test says "no active FCM device token" | The account never registered a token (user-service `POST /users/me/fcm-token`, worker-service equivalent), or the dead token was pruned |
| Broadcast to all users times out | The engine is sequential and runs inside the request (section 21, item 5). Use smaller segments until it moves to a queue |
| Map shows no workers | Workers need a `worker_locations` row; filter "Include offline"; check verification and status |
| Heatmap says fallback | `search_demand_log` empty: search-service is not writing to it |
| Worker "approval blocked: no identity document" | See section 21, item 3 |
| Banned user can still act in the app | Cache: `DEL user:status:{id}` (or `worker:status:{id}`); existing access tokens live ≤ 15 min |
| Admin actions not reaching payment/worker/chat services | The outbox is not being relayed (section 21, item 1) |

```sql
-- Outbox backlog
SELECT topic, event_type, count(*) FROM admin_event_outbox WHERE published_at IS NULL GROUP BY 1, 2;

-- Active admin sessions per admin
-- (Redis) ZCARD admin:sessions:<adminId>

-- Trusted devices of an admin
SELECT id, ip_address, created_at, last_used_at, expires_at, revoked_at
FROM admin_trusted_devices WHERE admin_id = '<uuid>' ORDER BY created_at DESC;

-- Which migrations look applied
SELECT to_regclass('admin_trusted_devices') AS m015, to_regclass('review_admin_notes') AS m014,
       to_regclass('search_demand_log') AS m013, to_regclass('dispute_admin_notes') AS m010,
       to_regclass('booking_status_history') AS m008, to_regclass('worker_verification_reviews') AS m007;
```

---

## 20. Architecture Decision Records (ADRs)

### ADR-001: One Next.js app, BFF routes, no separate admin service
**Status:** Accepted. UI and API live together; the browser never talks to other services. Fewer moving parts for a small team. Cost: the panel is coupled to the shared database schema.

### ADR-002: Direct SQL on the shared database
**Status:** Accepted (revisit). Every list, KPI and detail view needs joins across eight services' tables; HTTP aggregation would be slow and large. Consequence: schema changes in any service can break the panel, and business rules are duplicated (section 21). Writes to other services' tables should shrink over time in favour of internal endpoints.

### ADR-003: Separate admin authentication (HS256, own tables, own Redis keys)
**Status:** Accepted. Matches auth-service ADR-010: a customer or worker row can never become an admin. HS256 is fine because only this app signs and verifies.

### ADR-004: MFA mandatory for every role, with trusted devices
**Status:** Accepted. A password-only session has scope `mfa_setup` and can reach nothing else. Trusted device (7 d, per admin, revocable) keeps daily use tolerable. A session issued on a trusted device is capped to the remaining trust window.

### ADR-005: Opaque rotating refresh tokens + server-side sessions
**Status:** Accepted. Access JWT lives 15 min, the Redis session is the real authority (`authenticateAccessToken` checks both). Gives instant logout, eviction and deactivation. Absolute expiry is never extended.

### ADR-006: Two-layer authorisation (edge + handler)
**Status:** Accepted. Middleware blocks obvious cases cheaply at the edge; handlers re-check with the Redis session. Never rely on middleware alone.

### ADR-007: Derived statuses instead of stored status columns
**Status:** Accepted. `status`, `presence` and payment status are computed from timestamps, so they cannot drift. Same helpers feed list, filter, KPI and map.

### ADR-008: Transactional outbox for admin-originated events
**Status:** Accepted, **incomplete** (relay missing). Same idea as booking-service ADR-011. Rows are written in the action's transaction so a Kafka outage cannot lose them.

### ADR-009: Direct FCM broadcast from the admin server
**Status:** Accepted for now, to be reviewed. The gateway hop to notification-service was fragile, so `lib/direct-broadcast-engine.ts` writes the campaign, feed and delivery rows and calls FCM itself. It bypasses opt-outs, quiet hours, SMS and the service's dedup. Long term it belongs in a queue or back in notification-service.

### ADR-010: Server computes money; the browser only chooses an action
**Status:** Accepted. Dispute resolution derives refund amount and percentage from the booking; manual refunds are re-validated against the payment and forwarded to payment-service.

### ADR-011: Availability-aware reads for other services' tables
**Status:** Accepted. Detail tabs return `available: false` when a table or column is missing so the panel keeps working while other services are still being built.

### ADR-012: Reason required for every destructive action
**Status:** Accepted. Reasons go to the audit log and, for verification and warnings, to the worker/user.

---

## 21. Known Issues & Roadmap

Ranked by risk. "Found in code" means verified in the files reviewed; "assumption" means the other service's doc was compared.

### Critical (fix before production)

| # | Issue | Detail | Fix |
|---|---|---|---|
| 1 | **Outbox is never published** | Booking cancel / override / reassign / escalate, dispute resolution and verification decisions only write `admin_event_outbox`. `scripts/publish-outbox.ts` does not exist and no Kafka client is installed. payment-service never receives `booking.dispute_resolved` (refund not executed), worker-service never receives `booking.started/cancelled` (slot and `is_on_job` stay wrong), chat/notification never see anything | Build the relay (poll `published_at IS NULL`, `FOR UPDATE SKIP LOCKED`, publish, mark, backoff) or call the owning service's internal endpoint instead |
| 2 | **Impersonation has no safe consumer** | `/users/:id/actions/impersonate` signs a 20 min JWT with `IMPERSONATION_JWT_SECRET` and returns `${NEXT_PUBLIC_APP_URL}/auth/impersonate?token=…`. No service or app documented accepts it; the JWT secret is separate from RS256 auth-service keys; crashes if env vars unset; the token is returned in the response body and URL | Remove until a real flow exists (read-only "view as" screens are safer), or implement in auth-service with an explicit `impersonatedBy` claim and gateway write-blocking |
| 3 | **Verification approval does not match worker-service KYC v1.2** | Approve requires a `NATIONAL_ID` or `PASSPORT` document. worker-service v1.2 stores `CNIC_FRONT` + `CNIC_BACK` (legacy types only). Every worker uploading through the new flow is blocked with "No identity document" | Change the check to the worker-service rule: `CNIC_FRONT` + `CNIC_BACK` (+ `BUSINESS_REGISTRATION` for `COMPANY`) not rejected; also approve in one place (worker-service `PATCH /workers/:id/verify` or share the helper) |
| 4 | **KYC documents are served as raw URLs** | worker-service stores CNIC files as Cloudinary `authenticated` assets and hands out 15 min signed URLs. The admin routes return `file_url` as is, so images will not render (or, if public, are exposed forever) | Sign URLs server-side (Cloudinary `private_download_url` / signed delivery) in `GET /workers/:id/documents` and `/verification` |
| 5 | **Broadcast engine ignores consent and blocks the request** | Sends to everyone with an FCM token regardless of `notification_preferences` (marketing opt-out) and quiet hours; the "SMS" channel does nothing; all work (≈ 3 queries per recipient plus one FCM call) runs sequentially inside the HTTP request that returns `202`, so "all users" will time out on Vercel and leave the campaign stuck in `SENDING` | Move to a queue (BullMQ) or back to notification-service; filter by preferences; chunk with `sendEach`; mark FAILED on error |
| 6 | **Payment/finance numbers depend on COD settlement** | Dashboard KPIs read `payments` HELD/RELEASED; the dashboard chart uses `created_at`, finance uses completion time | Pick one date basis (completion) and reuse one SQL source |

### High

| # | Issue | Detail | Fix |
|---|---|---|---|
| 7 | Worker **suspend** route missing | `workerActions.suspend` calls `/workers/:id/actions/suspend`; only `unsuspend`, `warn`, `ban` exist. The Suspend button 404s (permission `workers:suspend` is defined) | Add the route (mirror users/suspend, with validation) |
| 8 | Status cache not invalidated | user-service and worker-service cache `user:status:{id}` / `worker:status:{id}` for 60 s and expect `DEL` after ban / suspend. The panel never deletes them | `redis.del` after warn/suspend/ban/unsuspend/force-offline |
| 9 | Review moderation bypasses review-service | Writes `reviews` directly, deletes two cache keys, emits **no `review.moderated`**, so `workers.avg_rating` / `total_reviews` stay stale after hide/restore. review-service doc: "always use `PATCH /internal/reviews/:id/moderate`" | Call that endpoint with `X-Internal-Key` and `admin_id` instead of SQL |
| 10 | Admin actions skip booking-service side effects | Cancel / reassign do not re-sync the worker's `is_on_job`, do not remove BullMQ timeout / auto-complete jobs, do not set `cancellation_code` / `cancellation_fee_amount`, do not write `booking_penalties`; override-to-COMPLETED skips the COD settlement transaction (wallet, payments) and relies on `booking.payment_release`; reassign copies `payment_intent_id` onto two bookings and loses provider/company fields | Route these actions through booking-service internal endpoints, or document the exact subset supported |
| 11 | `BOOKING_TIMEOUT_MINUTES = 30` | booking-service v3 uses a tiered window (5 / 30 / 120 min, capped at half the time remaining). Reassign sets `expires_at = now + 30 min` regardless of urgency | Align with booking-service config; ideally let booking-service compute it |
| 12 | Pricing config not consumed | `platform_pricing_config` default `platform_fee_percent = 15` conflicts with booking-service (5 % customer + 5 % worker, via env). Editing it here changes nothing | Make booking-service read the table (env fallback), and change the default to the real policy |
| 13 | Missing / mismatched tables | Booking GPS trail reads `worker_location_history` (worker-service has no such table, only one `worker_locations` row per worker), worker earnings read `worker_earnings` (worker-service uses `worker_wallets`, `worker_payouts`, `payments`), blocked-workers query selects `workers.category` (column does not exist, error `42703` is swallowed → empty list), user reports read `reports` (no such table documented) | Point to real tables or remove the tabs |
| 14 | `get_user_kpis()` not in any admin migration | Users KPI endpoint fails with `42883` on a fresh DB | Add to a migration |
| 15 | Rejection codes and event names differ from worker-service | Admin codes: `cnic_unclear, face_mismatch, invalid_documents, fake_information, duplicate_account, other`. worker-service: `ID_UNCLEAR, ID_MISMATCH, ID_EXPIRED, DUPLICATE_ACCOUNT, FAKE_DOCUMENT, OTHER`. Events: admin `worker.rejected` vs worker-service `worker.verification.rejected`; admin emits no `worker.verification.pending` | One shared constants file, one event name |
| 16 | Catalog write coupling | worker-service ADR-002 says it owns `categories` / `services`; the admin edits them directly. worker-service caches `category:list` for 1 h and nearby/search caches 60 s; the panel does not invalidate them | Delete `category:list` after changes, or use a worker-service endpoint |
| 17 | Verify DB TLS | `rejectUnauthorized: false` in `lib/db.ts` | Pin the Supabase CA |

### Medium

| # | Issue | Detail |
|---|---|---|
| 18 | RBAC inconsistencies | Section 6.4 (`/waitlist` unprotected in middleware, nav vs permission mismatches) |
| 19 | Sidebar links to `/settings` | No page exists; `settings:view` has no UI except the pricing config API |
| 20 | No admin-user management | `admin_users:manage` is defined, nothing implements it. The seed script says additional admins "must be created through the admin panel"; they cannot. Role changes, deactivation, MFA reset and "log out everywhere" exist only as SQL / Redis (section 19) |
| 21 | Audit after commit | `logAdminAction` runs after the transaction; if it throws, the client gets 500 although the action happened. Prefer writing the audit row inside the transaction (bookings, disputes, verification) |
| 22 | Input validation gaps | User / category / waitlist routes do not UUID-check ids; category PATCH accepts unvalidated `parentId`, `sortOrder`, `iconUrl`; suspend `custom` date is not checked to be in the future; user list contains a dead `where` expression left in the code |
| 23 | Exports | Users export has no BOM, no audit and uses `<=` on `dateTo` (excludes the last day's evening); workers / bookings / users exports are not audited |
| 24 | Unsuspend semantics | User unsuspend sets `is_active = true` without checking `banned_at` / `deleted_at`; there is no unban |
| 25 | Rate limiting only on auth | Data APIs (CSV exports, broadcast, refunds) have no per-admin limits |
| 26 | Disputes: events differ from booking-service | `booking.dispute_resolved` payload lacks `payment_method`; booking-service emits it |
| 27 | Quiet hours | Warning only; the old notification-service dropped normal-priority push in 22:00–08:00, the direct engine does not |
| 28 | `app/auth/layout.tsx`, `DataTable` use undefined CSS variables | Section 15 |
| 29 | Dead dependencies | `@tanstack/react-query`, `axios`, and the three Supabase env vars (no `@supabase/*` package) |
| 30 | No tests | Section 17 |
| 31 | Middleware vs Next 16 `proxy` convention | Verify against the installed version |

### Roadmap

| Item | Notes |
|---|---|
| Outbox relay + dead-letter handling | Highest priority |
| Admin users page (create, role change, deactivate, reset MFA, log out everywhere, trusted devices list) | Replaces the SQL runbooks |
| Settings page (pricing config UI exists as components, add the route) | |
| Replace direct writes with internal endpoints (booking, review, worker) | ADR-002 |
| Queue-based broadcasts with preference + quiet-hour handling, SMS | ADR-009 |
| WebSocket / SSE for the live map and activity feed | Currently polling |
| Per-admin rate limits on data APIs, exports, broadcasts | |
| Test suite (Vitest for pure logic, Playwright for the auth flow) | |
| Audit log viewer page (search by admin, action, resource) | Data already collected |
| Worker documents with signed URLs, access logged per document | Item 4 |

---

## 22. Changelog

### v1.0.0: First documented release (October 2026)

**Documented**
- Authentication: password + mandatory TOTP, backup codes, trusted devices, rotating refresh sessions, concurrency cap, CSRF origin check.
- RBAC: 4 roles, 48 permissions, edge + handler enforcement.
- Modules: Dashboard, Waitlist, Users, Workers, Worker Verification, Bookings (list, board, detail, actions), Disputes & Refunds, Payments & Finance, Reviews & Ratings (+ rating audit), Notifications (direct FCM broadcast), Live Map, Analytics, Categories & Pricing.
- 15 migrations, 121 API routes, audit action catalogue, Redis key map.
- Cross-service contract and 31 known issues.

**Not covered in this version**
- The domain UI components under `components/<module>` were reviewed only through their hooks, types and routes.
- `components/map/MapView.tsx` (Mapbox token variable name), `eslint.config.mjs`, `postcss.config.mjs`.

---

> **Questions?** #backend in Slack · **Bug?** GitHub issue under the admin panel repo.
> **Changing a shared table or a column the other services read?** Tell their owners first (section 4.3 and 9.3).
> **Touching auth, sessions or RBAC?** Read section 5, 6 and ADR-003 to ADR-006 first, then update this document in the same pull request.