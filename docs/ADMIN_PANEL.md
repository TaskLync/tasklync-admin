# TaskLync: Admin Panel
### Internal Engineering Documentation · v1.3.0
> **Classification:** Internal · Engineering Team Only
> **Owner:** Backend Platform Team
> **Last Updated:** November 2026
> **Status:** 🟡 In Development (round 2 audit fixes applied, Coupons module added, Promotions and Ranking modules added)
> **URL:** `https://admin.tasklync.pk` · dev `http://localhost:3200`
> **Repo location of this file:** `docs/ADMIN_PANEL.md`

This document replaces v1.2.0. What changed is listed in section 22.

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

The **Admin Panel** is the internal operations dashboard of TaskLync: moderation of users and workers, KYC verification, booking operations, disputes, finance views, reviews moderation, broadcast notifications, **coupons**, **worker promotions**, **search ranking**, live map, analytics, catalog, pricing and admin-user management.

It is **one Next.js (App Router) application** with a UI and a BFF layer (`app/api/admin/*`). It has its own authentication, separate from auth-service. It **reads** the shared PostgreSQL (Supabase) database with `pg`, and since v1.1.0 it **changes other services' data only by calling their internal APIs**, with a few documented exceptions (section 9).

### Stack

| Layer | Technology |
|---|---|
| Framework | Next.js `16.2.10` (App Router), React `19.2.4`, TypeScript 5 |
| Styling | Tailwind CSS 4 (`@theme inline` tokens), `lucide-react` |
| Data fetching | SWR, plain `fetch` |
| Client state | `zustand` (sidebar) |
| DB | `pg` pool, raw SQL, no ORM, verified TLS when `DATABASE_CA_CERT` is set |
| Cache / sessions | `ioredis` (must be the shared Redis) |
| Auth | `jose` (HS256 JWT), `bcryptjs`, `otplib`, `qrcode` |
| Validation | `zod` on auth, coupon, promotion and ranking routes, hand-written checks elsewhere |
| Maps / charts | `mapbox-gl`, `recharts` |
| Tests | `vitest` |
| Hosting | Vercel or any Node host behind a proxy that overwrites `x-real-ip` |

> **AGENTS.md warning:** this Next.js version has breaking changes. Read `node_modules/next/dist/docs/` before changing routing, middleware or caching. Next 16 renames the `middleware` convention to `proxy`; this repo still uses `middleware.ts`. Verify against the installed version before upgrading.

### What this service does NOT do

- Customer or worker login (auth-service).
- Booking, payment, review, notification, **coupon, promotion, ranking** business logic. It calls those services.
- Firebase push. notification-service sends all push and SMS (the panel no longer holds a Firebase key).
- Impersonation (removed in v1.1.0).

### Service boundaries

```
OWNS (writes, created by admin migrations):
  ├── admin_users, admin_mfa_backup_codes, admin_trusted_devices, admin_audit_log
  ├── platform_events, platform_pricing_config (singleton)
  ├── booking_status_history, booking_admin_notes, dispute_admin_notes, review_admin_notes
  ├── admin_migrations (migration tracking)
  ├── admin_event_outbox   DEPRECATED, nothing writes it any more
  └── search_demand_log    (table is ours; search-service may write to it, the map falls back to bookings otherwise)

  (Coupons, promotions and ranking: the panel owns NO tables for them.
   Coupon and promotion data and rules live in booking-service, ranking policy in search-service,
   ranking performance facts and flags in worker-service.)

ADDS COLUMNS to tables owned by others (additive, IF NOT EXISTS): users, workers, bookings, disputes, reviews, review_reports  (section 4.3)

CALLS (server side, X-Internal-Key):
  ├── booking-service   /internal/admin/*   cancel, override-status, reassign, escalate, dispute resolve
  │                     /internal/admin/coupons/*   list, get, redemptions, create, batch, pause, resume, end, extend, approve, reject
  │                     /internal/admin/promotions/*   list, get, settings (GET, PUT), approve, reject, pause, resume, end
  ├── worker-service    /internal/admin/*   verify, reject, moderation, signed verification summary; /internal/cache/invalidate
  │                     /internal/admin/workers/:id/performance, /internal/admin/workers/:id/ranking-flags
  ├── review-service    PATCH /internal/reviews/:id/moderate
  ├── search-service    POST /internal/reindex/:workerId
  │                     /internal/ranking/*   configs, activate, shadow, overrides, simulate
  ├── payment-service   POST /internal/refunds, POST /internal/payouts/:id/retry
  └── API gateway       POST /internal-admin/notifications/broadcasts  (x-admin-internal-key)

WRITES DIRECTLY (admin-owned columns or no owner API yet):
  ├── users: warn / suspend / unsuspend / ban / contact edit  (+ clears user caches in Redis)
  ├── workers: warn, featured flag, edit contact, re-verification request, CNIC number  (+ cache invalidate + search reindex)
  ├── worker_badges (shared table, admin writes `top_rated` and `background_verified`)
  ├── categories, services (+ worker-service cache invalidate)
  ├── disputes: assignment / escalation columns, review_reports resolution columns
  └── waitlist status

READS: payments, worker_payouts, refunds, worker_wallets, dead_letters, messages, worker_locations, user_addresses,
       user_blocks, worker_skills, worker_service_offerings, worker_recurring_availability, worker_blocked_dates,
       reviewable_bookings, notification_preferences, booking_penalties, bookings, disputes, reviews
       (bookings now includes the coupon columns written by booking-service migration 013 and the discount funding
        columns written by booking-service migration 015, see 4.3)
```

### Key numbers

| Metric | Value |
|---|---|
| Admin roles | 4: `SUPER_ADMIN`, `OPS`, `FINANCE`, `SUPPORT` |
| Permissions | **58** (impersonation removed in v1.1.0, 4 `coupons:*` added in v1.2.0, 7 `promotions:*` / `settings:promotions` / `ranking:*` added in v1.3.0) |
| Admin pages | **17** modules + 3 auth pages |
| API route handlers | **146** |
| Migrations | 16 (`db/migrations/001` to `016`); **no 017**, coupon, promotion and ranking data are owned by other services |
| Access token TTL | 15 min |
| Session life | 8 h or 7 d (remembered device), absolute |
| Concurrent sessions per admin | 3 |
| Failed logins before lockout | 5, lockout 30 min |
| MFA | mandatory for every role by default |
| DB pool | max 10 |
| Super admins | max 2 |
| Dev port | **3200** (`next dev -p 3200` in `package.json`; 3000 is the API gateway) |
| Day boundary for all KPIs and money | Asia/Karachi, completion time for revenue |

---

## 2. Architecture

```
                    ┌──────────────────────┐
                    │  Admin (browser)     │
                    └──────────┬───────────┘
                               │ HTTPS (httpOnly cookies, SameSite=Lax)
                    ┌──────────▼───────────┐
                    │  Next.js middleware  │  JWT verify, Origin/CSRF, UUID id guard,
                    │                      │  route → permission, silent refresh redirect
                    └──────────┬───────────┘
        ┌──────────────────────▼──────────────────────┐
        │              tasklync-admin (Node)          │
        │  app/(admin) pages  ·  app/api/admin/* BFF  │
        └─┬──────────┬─────────────┬──────────────────┘
          │ SQL      │ Redis       │ HTTP + X-Internal-Key
          ▼          ▼             ▼
    PostgreSQL     Redis     booking · worker · review · search · payment · gateway→notification
```

### Request pipeline

```
Browser request → middleware.ts (edge)
  ├─ unsafe API method and Origin ≠ Host                         → 403
  ├─ /api/admin/auth/*                                           → pass (routes enforce themselves)
  ├─ verify admin_access JWT (sig, alg, iss, aud, exp, type, scope)
  ├─ no valid token: API → 401 JSON, page → refresh redirect or /auth/login
  ├─ scope = mfa_setup → only MFA enrolment
  ├─ API path with an id segment that is not a UUID               → 404 JSON   (static segments such as coupons/batch and promotions/settings are whitelisted;
  │                                                                              ranking config versions are integers and are validated by the route)
  └─ page path → permission (ROUTE_PERMISSIONS); missing → redirect /
  ▼
Route handler
  ├─ requirePermission(p)   (JWT + Redis session + scope + role)
  ├─ validate input
  ├─ read: SQL.  write: internal API call to the OWNING service, or SQL on admin-owned columns
  ├─ best-effort follow-ups (cache invalidate, search reindex)
  ├─ logAdminAction()  (after the action; never turns a finished action into a 500)
  └─ JSON
```

### Layers

| Layer | Location | Rule |
|---|---|---|
| Edge gate | `middleware.ts` | Coarse: valid JWT, UUID id guard, path permission. Cannot see Redis |
| Guard | `lib/rbac-guard.ts` | Authoritative: JWT + Redis session + `scope === 'full'` + permission |
| Route handler | `app/api/admin/**/route.ts` | Parse, validate, call, audit, respond |
| Service clients | `lib/internal-client.ts`, `lib/services/{booking,worker,review,search}.ts`, `lib/payment-service.ts`, `lib/notification-service.ts` | The **only** place that knows another service's URL, key and body shape. `callService` supports GET, POST, PATCH, PUT, DELETE |
| Domain helpers | `lib/*-api.ts`, `lib/*-constants.ts` | SQL fragments defined once, error classes, row mappers, zod schemas |
| Hooks | `hooks/use*.ts` | SWR + one `*Actions` object per module |
| UI | `components/<module>/*` | Section → FilterBar → Table → KpiGrid |

### Conventions

- **Single SQL source of truth** for list, counts and CSV export.
- **Derived status**, never stored (`fn_user_status`, `fn_worker_status`, `fn_worker_presence`). Coupons and promotions follow the same idea: the display `state` is derived from `status`, `paused_by` and the validity window (`stateOf`).
- **Availability-aware reads**: `{ available: false, data: [] }` on SQL error `42P01` / `42703`.
- **Reason required** on every destructive action; it goes to the audit log.
- **One owner per table.** The panel calls the owner's API instead of writing its tables (ADR-002, ADR-013). Ranking tables have one writer, search-service (ADR-022).

---

## 3. Repository Structure

```
tasklync-admin/
├── middleware.ts  next.config.ts  package.json  tsconfig.json  eslint.config.mjs  vitest.config.ts
├── .env  .env.example   AGENTS.md  CLAUDE.md  README.md  docs/ADMIN_PANEL.md
├── app/
│   ├── auth/ (login, mfa, mfa-setup)
│   ├── (admin)/ analytics bookings categories disputes map notifications payments reviews users waitlist workers
│   │            coupons/page.tsx  coupons/[couponId]/page.tsx
│   │            promotions/page.tsx  promotions/[promotionId]/page.tsx                 # NEW v1.3.0
│   │            settings/page.tsx  settings/admins/page.tsx  settings/ranking/page.tsx # ranking NEW v1.3.0
│   └── api/admin/ (auth, analytics, bookings, categories, dashboard, disputes, map, notifications, payments,
│                   pricing-config, reviews, users, waitlist, workers, admins,
│                   coupons/ (route.ts, batch/, [couponId]/ (route.ts, redemptions/, actions/[action]/)),
│                   promotions/ (route.ts, settings/, [promotionId]/ (route.ts, actions/[action]/)),            # NEW v1.3.0
│                   ranking/ (configs/ (route.ts, [version]/activate, [version]/shadow),
│                             overrides/ (route.ts, [overrideId]/), simulate/),                                 # NEW v1.3.0
│                   workers/[workerId]/ (… ranking/, ranking-flags/))                                           # NEW v1.3.0
├── components/ layout auth shared ui analytics bookings categories dashboard disputes map notifications
│               payments reviews users verification waitlist workers
│               settings/PricingSettings.tsx
│               coupons/ CouponsSection.tsx CouponFormDialog.tsx CouponDetailView.tsx
│               promotions/ PromotionsSection.tsx PromotionDetailView.tsx PromotionGuardrails.tsx    # NEW v1.3.0
│               ranking/ RankingSection.tsx ConfigEditorDialog.tsx OverridesPanel.tsx SimulatePanel.tsx   # NEW v1.3.0
│               workers/WorkerRankingPanel.tsx                                                         # NEW v1.3.0
├── db/migrations/001 … 016_*.sql                                                     # no 017: coupons, promotions, ranking are owned by other services
├── hooks/  lib/  scripts/  types/  tests/
│   hooks/useCoupons.ts  types/coupon.ts  tests/coupons.test.ts
│   hooks/usePromotions.ts  hooks/useRanking.ts  types/promotion.ts  types/ranking.ts                # NEW v1.3.0
│   tests/promotions-api.test.ts  tests/ranking-api.test.ts                                          # NEW v1.3.0
├── lib/
│   ├── auth/       config cookies crypto issue jwt mfa password rate-limit rbac redirect request session trusted-device uuid-guard
│   ├── services/   booking.ts (+ couponSvc, promotionSvc) worker.ts (+ performance, rankingFlag) review.ts
│   │               search.ts (+ rankingSvc)                                           # internal API clients
│   ├── internal-client.ts cache.ts
│   ├── db.ts redis.ts audit.ts rbac-guard.ts auth-fetch.ts swr-fetcher.ts cn.ts nav-config.ts
│   ├── notification-service.ts notifications-api.ts notification-catalog.ts notification-constants.ts
│   ├── payment-service.ts payments-api.ts payment-constants.ts
│   ├── bookings-api.ts booking-constants.ts disputes-api.ts dispute-constants.ts
│   ├── reviews-api.ts review-constants.ts verification-api.ts verification-constants.ts
│   ├── coupons-api.ts coupon-constants.ts
│   ├── promotions-api.ts promotion-constants.ts                                      # NEW v1.3.0
│   ├── ranking-api.ts ranking-constants.ts                                           # NEW v1.3.0
│   └── workers-api.ts map-api.ts map-constants.ts map-geo.ts analytics-api.ts analytics-constants.ts parse-user-agent.ts
└── scripts/ migrate.ts  seed-super-admin.ts  generate-broadcast-templates.ts
    (removed: setup-firebase.ts, encode-firebase-credentials.ps1, test-direct-broadcast.ts)
(removed: lib/direct-broadcast-engine.ts, lib/firebase-admin.ts, service-account.example.json)
```

---

## 4. Database

The admin panel uses the **same Supabase PostgreSQL database** as the other services (`DATABASE_URL`).

### 4.1 Migrations

Run with `npm run migrate` (tracks applied files in `admin_migrations`; on an existing database run once with `--baseline=015`).

| # | File | What it does |
|---|---|---|
| 001 | `admin_auth` | `admin_users`, `admin_mfa_backup_codes`, `admin_audit_log` (original file still has `resource_id UUID`; 016 fixes it, this is expected) |
| 002 | `dashboard_functions` | `platform_events` + triggers, dashboard functions (superseded by 016 for KPIs, revenue and needs-attention) |
| 003 | `waitlist_functions` | `pg_trgm`, waitlist indexes and functions |
| 004 | `users_moderation` | moderation columns on `users`, `fn_user_status`, `get_user_overview` |
| 005 | `pricing_config` | `platform_pricing_config` singleton |
| 006 | `workers_moderation` | moderation columns on `workers`, `worker_badges`, `fn_worker_status`, `fn_worker_presence`, KPIs, overview |
| 007 | `worker_verification` | KYC columns, `worker_verification_reviews`, `admin_event_outbox` (deprecated) |
| 008 | `bookings_admin` | refund columns, `booking_status_history` + trigger, notes, `get_booking_kpis` |
| 009 | `payments_admin` | read indexes on payment-service tables |
| 010 | `disputes_admin` | assignment / escalation columns, notes, indexes |
| 011 | `analytics` | analytics functions |
| 012 | `notifications_admin` | read indexes on notification tables |
| 013 | `live_map` | `search_demand_log`, `get_map_demand_cells` |
| 014 | `reviews_admin` | moderation audit columns, report resolution, notes |
| 015 | `admin_session_hardening` | `admin_trusted_devices`, unique `LOWER(email)` |
| **016** | `round2_hardening` | `admin_audit_log.resource_id` → VARCHAR(100); pricing config split into customer fee and worker commission; `get_user_kpis()`; dashboard KPIs, revenue chart and revenue by city on **one date basis (completion time, Karachi)**; **canonical `get_needs_attention()`** (adds stuck `IN_PROGRESS` jobs); RLS on admin tables; outbox marked deprecated |

**No 017.** The Coupons, Promotions and Ranking modules need no admin migration: there are no admin-owned tables for them. Coupon and promotion data are owned by booking-service, ranking policy by search-service, ranking facts and flags by worker-service. The only schema dependency is **booking-service migrations 013 to 015** (not to be confused with admin `013_live_map` and `014_reviews_admin` / `015_admin_session_hardening`, they are separate numbering schemes): 013 adds the coupon discount columns on `bookings`, 015 adds the discount funding columns (section 4.3). Both are read by the booking detail query.

**Run order matters:** every migration after 001 needs other services' tables first. `get_needs_attention()` was redefined in 002, 010 and 014; **016 holds the final definition**. If you ever re-run 002, 010 or 014, run section 5 of 016 again. The dashboard attention panel has **no** "offers waiting for approval" row because that would need an admin migration redefining `get_needs_attention()` (section 21, item 17).

### 4.2 Admin-owned tables

```sql
admin_users ( id uuid PK, email UNIQUE (+ unique LOWER(email)), password_hash, full_name,
              role CHECK IN ('SUPER_ADMIN','OPS','FINANCE','SUPPORT'), is_active,
              mfa_secret   -- AES-256-GCM "v1:<iv>.<tag>.<ct>", mfa_enabled,
              last_login_at, last_login_ip, failed_attempts, locked_until, created_by, created_at, updated_at )
admin_mfa_backup_codes ( id, admin_id, code_hash "hmac1:<hex>", used_at, created_at )
admin_trusted_devices ( id uuid, admin_id, token_hash CHAR(64), ip_address, user_agent, created_at, last_used_at, expires_at, revoked_at )
admin_audit_log ( id, admin_id, admin_email, action, resource_type, resource_id VARCHAR(100)  -- was UUID,
                  old_value jsonb, new_value jsonb, notes, ip_address, user_agent, created_at )
platform_events ( id, event_type, message, metadata jsonb, created_at )
platform_pricing_config ( id bool PK = true, customer_platform_fee_percent 5.00, worker_commission_percent 5.00,
                          platform_fee_percent (informational total), demand_threshold, demand_multiplier,
                          urgency_same_day_multiplier, urgency_within_2h_multiplier, off_peak_multiplier, updated_by, updated_at )
booking_status_history ( id, booking_id, from_status, to_status, actor 'admin:<email>' | NULL, is_backfilled, changed_at )
booking_admin_notes / dispute_admin_notes / review_admin_notes ( id, <entity>_id, admin_id, admin_email, note, created_at )
search_demand_log ( id, user_id, lat, lng, category_id, query_text, result_count, created_at )
admin_migrations ( id, name UNIQUE, ran_at )
```
`worker_badges` and `worker_verification_reviews` are **shared with worker-service** (it owns the flow; the admin panel reads the review history and writes only the two admin badges).

### 4.3 Columns the admin panel adds to other services' tables

| Table (owner) | Columns | Enforced / used by |
|---|---|---|
| `users` | `suspended_*`, `banned_*`, `warning_count`, `last_warning_*` | auth-service and user-service (login and status checks) |
| `workers` | same moderation set, `is_featured`, `featured_at`, `reverification_*`, `cnic_number`, `date_of_birth`, `registration_ip`, `verification_rejection_*`, `verified_at/by` | worker-service moderation endpoint writes the moderation columns; admin writes featured / CNIC / re-verification |
| `bookings` | `refund_amount`, `refund_percentage` | booking-service writes them too |
| `disputes` | `assigned_to/at`, `is_escalated`, `escalated_*`, `escalation_note` | admin only |
| `reviews`, `review_reports` | `moderated_*`, `moderation_note`, `resolved_at/by` | review-service migration creates the same columns |

All `ADD COLUMN IF NOT EXISTS`. Tell the owning team before changing any of them.

**Columns the panel only READS (added by booking-service, not by the panel):**

| Column | Added by | Meaning |
|---|---|---|
| `bookings.discount_amount`, `bookings.subtotal_before_discount`, `bookings.coupon_code_masked` | booking-service migration 013 | discount on the booking and the masked code (coupon or worker offer code) |
| `bookings.discount_funding` | booking-service migration 015 | `'PLATFORM'` (coupon), `'WORKER'` (worker promotion) or `NULL` |
| `bookings.promotion_id` | booking-service migration 015 | the worker promotion used, if any |
| `bookings.worker_amount_before_discount` | booking-service migration 015 | what the worker would have earned without the offer |

The booking detail query (`app/api/admin/bookings/[bookingId]/route.ts`) selects all of them, so **booking-service migrations 013 to 015 must be applied before this panel version is deployed**; without 015 the query fails with a missing column. This is the one exception to "the panel reads no coupon or promotion data in SQL": every other coupon, promotion and ranking read and write goes through the owning service's internal API.

### 4.4 Database functions and triggers

| Function | Used by |
|---|---|
| `fn_user_status`, `fn_worker_status`, `fn_worker_presence` | status / presence on every list, map, analytics |
| `get_user_overview`, `get_worker_overview` | detail page header |
| `get_user_kpis` (016), `get_worker_kpis`, `get_booking_kpis` | list-page KPI cards (Karachi "today") |
| `get_dashboard_kpis`, `get_revenue_chart`, `get_revenue_by_city` (016 versions) | dashboard. Revenue = completed bookings by **completion time**, same basis as Finance |
| `get_needs_attention` (016) | dashboard attention panel: stale disputes (24 h), stale verifications (48 h), failed payments, pending bookings > 30 min, **in-progress bookings > 6 h past their end**, flagged reviews |
| `get_waitlist_*`, `get_analytics_*`, `analytics_*`, `get_map_demand_cells` | their pages |
| `fn_log_booking_status_history` (trigger on `bookings`) | booking timeline; reads `app.actor`, which booking-service sets to `admin:<email>` for admin actions |
| `fn_log_booking_created`, `fn_log_booking_disputed`, `fn_log_worker_verified`, `fn_log_payment_completed`, `fn_log_user_registered` | fill `platform_events` |

### 4.5 Row level security

016 enables RLS (no policies) on the admin-owned tables. The panel connects with a role that bypasses RLS (Supabase `postgres`). The anon key must never ship in a client. Tables shared with other services are not touched by 016.

### 4.6 Time-zone rule

Every "today", "this month" and day bucket is `Asia/Karachi`. Revenue everywhere (dashboard, finance, analytics) is dated by completion time. Dates returned to the browser are `YYYY-MM-DD` strings.

---

## 5. Authentication & Sessions

Admin auth is **fully separate** from auth-service: own table, own secret, own cookies, own Redis keys. (Unchanged from v1.0.0; summarised.)

### 5.1 Tokens and cookies

| Cookie | Content | Lifetime | Path |
|---|---|---|---|
| `admin_access` | JWT HS256 (`aud=tasklync-admin-panel`; claims `sub, email, role, sessionId, scope, type=access`) | 15 min | `/` |
| `admin_session` | opaque 32-byte hex refresh token (sha256 stored in Redis) | 8 h browser-session, or 7 d if remembered | `/` |
| `admin_device` | `<uuid>.<secret>` trusted-device token (sha256(secret) in DB) | 7 d | `/` |
| `admin_mfa` | JWT `aud=tasklync-admin-mfa`, single use | 5 min | `/api/admin/auth/mfa` |

`httpOnly`, `Secure` in production, `SameSite=Lax`. Tokens never appear in JSON bodies.

### 5.2 Login flow

```
POST /api/admin/auth/login → IP limit 30/15 min, email limit 15/15 min → bcrypt (dummy hash if unknown email)
  wrong password: atomic failed_attempts+1, at 5 → locked 30 min, generic 401
  correct password but locked → 423 (only now revealed)
  MFA enrolled: trusted-device cookie for THIS admin → full session; else admin_mfa cookie → { requiresMFA }
  MFA not enrolled + ADMIN_MFA_REQUIRED → limited session (scope mfa_setup, 30 min)
POST /api/admin/auth/mfa/verify → TOTP (±1 step) with replay claim, or backup code (atomic single use); 5 failures burn the challenge and lock the account
POST /api/admin/auth/mfa/setup[-confirm] → QR + secret; confirm stores AES-GCM secret, 10 backup codes shown once, FRESH session, trusted device
```

### 5.3 Sessions (Redis)

Rotating refresh tokens (`GETDEL`), 20 s grace for two tabs, reuse of a rotated token kills the session, account re-checked at every refresh, absolute expiry never extended, max 3 sessions. `authenticateAccessToken` needs both the JWT and the Redis session, so logout, eviction, deactivation, **role change and MFA reset (section 6.5)** take effect immediately for API calls.

### 5.4 Client-side silent refresh

`lib/auth-fetch.ts` patches `window.fetch` for same-origin `/api/admin/*`: 401 → one refresh (Web Locks across tabs) → one retry, else redirect to `/auth/login?reason=expired`. `SessionKeeper` refreshes every 10 min while visible.

### 5.5 Crypto

bcrypt 12 rounds (12–72 bytes, upper + lower + digit); TOTP secrets AES-256-GCM with `ADMIN_MFA_ENCRYPTION_KEY`; backup codes HMAC-SHA256; JWT HS256 with `ADMIN_JWT_SECRET` ≥ 32 bytes. **Losing the encryption key forces every admin to re-enrol MFA.**

---

## 6. RBAC (Roles & Permissions)

Source of truth: `lib/auth/rbac.ts`. Nav visibility is a separate list in `lib/nav-config.ts` (consistent with the permissions).

### 6.1 Roles

| Role | Purpose |
|---|---|
| `SUPER_ADMIN` | Everything: ban, create categories, edit pricing, broadcast to all, resolve escalated disputes, manage admins, create / manage / approve coupons, **edit promotion guardrails, change ranking versions, overrides and simulations** |
| `OPS` | Operations: verification, workers / users moderation (except ban), bookings, disputes, notifications, map, reviews, waitlist, create and manage coupons, **approve and suspend worker promotions, view ranking, flag workers** |
| `FINANCE` | Payments, analytics, dashboard, categories (read), coupons (view and second approver for high-budget / uncapped coupons), **promotions (view)** |
| `SUPPORT` | Read-mostly: users, workers (read), bookings, disputes, reviews, coupons (view), **promotions (view)**, with warn / note / escalate |

### 6.2 Permission matrix

| Permission | SUPER | OPS | FIN | SUP |
|---|:-:|:-:|:-:|:-:|
| `dashboard:view`, `categories:view` | ✓ | ✓ | ✓ | ✓ |
| `waitlist:view`, `waitlist:manage` | ✓ | ✓ | | |
| `workers:view` | ✓ | ✓ | | ✓ |
| `workers:verify` | ✓ | ✓ | | |
| `workers:warn`, `:suspend`, `:edit`, `:feature`, `:badge`, `:force-offline` | ✓ | ✓ | | |
| `workers:ban` | ✓ | | | |
| `users:view`, `users:warn` | ✓ | ✓ | | ✓ |
| `users:suspend`, `users:edit` | ✓ | ✓ | | |
| `users:ban` | ✓ | | | |
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
| `coupons:view` | ✓ | ✓ | ✓ | ✓ |
| `coupons:create` | ✓ | ✓ | | |
| `coupons:manage` (pause, resume, end, extend) | ✓ | ✓ | | |
| `coupons:approve-high` (second approver for uncapped / high-budget coupons; approve and reject) | ✓ | | ✓ | |
| `promotions:view` (list, detail, read guardrails) | ✓ | ✓ | ✓ | ✓ |
| `promotions:approve` (approve, reject) | ✓ | ✓ | | |
| `promotions:suspend` (pause, resume, end) | ✓ | ✓ | | |
| `settings:promotions` (edit guardrails) | ✓ | | | |
| `ranking:view` (Ranking console read, worker Ranking card) | ✓ | ✓ | | |
| `ranking:flag` (add / revoke worker ranking flags) | ✓ | ✓ | | |
| `ranking:config` (create version, activate, shadow, overrides, simulate) | ✓ | | | |
| `categories:create`, `:edit`, `services:edit` | ✓ | | | |
| `settings:view`, `settings:edit`, `admin_users:manage` | ✓ | | | |

`users:impersonate` no longer exists. Total: **58** permissions.

### 6.3 Enforcement points

1. **Middleware**: path prefix → permission (`/workers/verification` before `/workers`; **`/settings/ranking` and `/settings/admins` before `/settings`**; `/waitlist`, `/settings`, `/coupons` and `/promotions` are listed). The final order of the settings entries is `/settings/ranking` (`ranking:view`), `/settings/admins` (`admin_users:manage`), `/settings` (`settings:view`). Missing permission → redirect `/` for pages, 403 JSON for API.
2. **Every API handler** starts with `requirePermission('x:y')`. The coupon action route maps each action to its permission (`ACTIONS` in `lib/coupons-api.ts`): `pause`, `resume`, `end`, `extend` → `coupons:manage`; `approve`, `reject` → `coupons:approve-high`. The promotion action route does the same in `lib/promotions-api.ts`: `approve`, `reject` → `promotions:approve`; `pause`, `resume`, `end` → `promotions:suspend`.
3. **Inline rules**: escalated disputes, claim rules, broadcast-all, last Super Admin protection.
4. **Four-eyes on coupons** is enforced in **booking-service**, not in the panel: the creator of a coupon can never approve their own coupon (403 `COUPON_FOUR_EYES`). FINANCE can approve but not create. Financial guardrails of coupons (percent cap, platform-take cap, high-budget threshold) are booking-service **environment settings**, not UI, so OPS and SUPPORT cannot change them.
5. **Promotion guardrails are data, not environment.** The 10 limits for worker offers live in booking-service `promo_settings`, are edited from `Promotions → Guardrails` and only with `settings:promotions` (SUPER_ADMIN). booking-service validates them again and caches them for about 60 seconds. There is **no four-eyes on promotions** in v1.3.0: an offer outside the guardrails waits for one OPS or SUPER_ADMIN decision.
6. **Ranking** policy is search-service data, editable only with `ranking:config` (SUPER_ADMIN). OPS can read it and flag individual workers (`ranking:flag`).
7. **UI**: `Sidebar` filters `NAV_ITEMS`; `usePermission()` hides buttons. Cosmetic only; the API decides.

### 6.4 Remaining RBAC notes

- `/` (dashboard) has no route permission; every full-scope admin may open it (all four roles have `dashboard:view`).

### 6.5 Admin-user management

`Settings → Admin users` (`/settings/admins`, SUPER_ADMIN): list, create (temporary password, MFA forced at first login), change role, activate / deactivate, sign out everywhere, reset MFA. Rules: you cannot change yourself, the last active Super Admin cannot be demoted or deactivated, at most 2 Super Admins. Every change destroys that admin's Redis sessions (and trusted devices on deactivate or MFA reset) immediately.

---

## 7. API Reference

Base path: `/api/admin`. Auth: httpOnly cookie. Unsafe methods pass the Origin check. Errors `{ "error": "message", code? }`. Lists `{ data, page, pageSize, total, totalPages }`. A malformed `:id` on users / workers / bookings / disputes / reviews / payouts / campaigns / admins / **coupons / promotions / ranking overrides** returns `404` from middleware (`/api/admin/coupons/batch` and `/api/admin/promotions/settings` are whitelisted as static segments). Ranking config `:version` is an **integer**, not a UUID: it is not guarded in middleware, the route checks `/^\d+$/` and answers 404 otherwise.

### 7.1 Auth (`/auth`)

`POST /login`, `POST /logout` (`?forget=1`), `POST|GET /refresh`, `GET /session`, `POST /mfa/setup`, `POST /mfa/setup-confirm`, `POST /mfa/verify`. Unchanged.

### 7.2 Dashboard (`dashboard:view`)

`GET /dashboard/kpis`, `/attention`, `/activity`, `/revenue?period=daily|weekly|monthly`, `/funnel`. Revenue is completion-time based.

### 7.3 Waitlist

`GET /waitlist`, `/kpis`, `/growth`, `/utm-breakdown`, `/device-breakdown`, `/export` (audited); `PATCH /waitlist/:id/status` (`waitlist:manage`).

### 7.4 Users

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/users`, `/users/kpis`, `/users/export` | `users:view` | export is audited, has a BOM, includes the whole `dateTo` day |
| GET | `/users/:id`, `/addresses`, `/blocked-workers`, `/bookings`, `/reviews`, `/reports` | view | `reports` = disputes the user opened (no `reports` table exists) |
| POST | `/users/:id/actions/warn`, `/suspend`, `/unsuspend` | warn / suspend | clears user caches |
| POST | `/users/:id/actions/ban` | `users:ban` | clears user caches |
| PATCH | `/users/:id/actions/edit-contact` | `users:edit` | clears user caches |
| POST | `/users/:id/actions/impersonate` | none | **410 Gone**, removed |

### 7.5 Workers

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/workers`, `/kpis`, `/filter-options`, `/export` | `workers:view` | export audited |
| GET | `/workers/:id`, `/performance`, `/earnings`, `/jobs`, `/reviews`, `/availability`, `/catalog` | view | `earnings` computed from completed bookings |
| GET | `/workers/:id/ranking` | `ranking:view` | **new in v1.3.0.** worker-service `GET /internal/admin/workers/:id/performance` mapped by `mapPerformance`: decayed performance facts, active and past flags, 30-day daily buckets, top-5 customer concentration (anonymised) |
| POST | `/workers/:id/ranking-flags` | `ranking:flag` | **new in v1.3.0.** `{ action: 'add', flagType, multiplier (0.2 to 1.25), reason (≥ 5), expiresAt? }` or `{ action: 'revoke', flagId (uuid), reason (≥ 3) }`. 201 on add, 200 on revoke. worker-service recomputes the multiplier and publishes `worker.stats_updated`, so the panel does **not** call `reindexWorker` here |
| GET | `/workers/:id/documents` | `workers:verify` | **signed URLs from worker-service**, access logged (`worker.documents_viewed`) |
| POST | `/workers/:id/actions/warn` | `workers:warn` | SQL |
| POST | `/workers/:id/actions/suspend` | `workers:suspend` | `{ reason, duration: 7d\|30d\|custom, until? }`; worker-service moderation endpoint |
| POST | `/workers/:id/actions/unsuspend` | `workers:suspend` | worker-service moderation |
| POST | `/workers/:id/actions/ban` | `workers:ban` | worker-service moderation + clears featured + search reindex |
| POST | `/workers/:id/actions/force-offline` | `workers:force-offline` | short moderation suspend (`FORCE_OFFLINE_MINUTES`, default 60) |
| PATCH | `/workers/:id/actions/edit-contact` | `workers:edit` | SQL + worker cache invalidate + reindex |
| POST | `/workers/:id/actions/feature` | `workers:feature` | SQL + invalidate + reindex |
| POST | `/workers/:id/actions/badge` | `workers:badge` | SQL on `worker_badges` + invalidate + reindex |
| POST | `/workers/:id/actions/request-reverification` | `workers:verify` | SQL + invalidate + reindex |

### 7.6 Worker verification

| Method | Path | Notes |
|---|---|---|
| GET | `/workers/verification?tab=…`, `/workers/verification/counts` | queue (same SQL as counts) |
| GET | `/workers/:id/verification` | review page data; **documents come from worker-service with signed URLs**; `documentsUnavailable: true` if that call fails |
| PATCH | `/workers/:id/verification/cnic` | admin types the 13 digits, duplicate lookup |
| POST | `/workers/:id/verification/view` | "who viewed" log |
| POST | `/workers/:id/actions/approve-verification` | **worker-service `POST /internal/admin/workers/:id/verify`** (the identity-document, duplicate-CNIC and event logic live there) |
| POST | `/workers/:id/actions/reject-verification` | worker-service reject; codes `ID_UNCLEAR`, `ID_MISMATCH`, `ID_EXPIRED`, `DUPLICATE_ACCOUNT`, `FAKE_DOCUMENT`, `OTHER` |
| POST | `/workers/:id/actions/request-info` | records `info_requested` and sends the message as a push through the broadcast path (≤ 160 chars). Returns `notified` |

### 7.7 Bookings

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/bookings`, `/board`, `/kpis`, `/export` | `bookings:view` | export audited |
| GET | `/bookings/:id`, `/timeline`, `/chat`, `/payment`, `/notes` | view | `GET /bookings/:id` `pricing` returns `discountAmount`, `subtotalBeforeDiscount`, `couponCode` (masked) and, since v1.3.0, **`discountFunding`** (`PLATFORM` / `WORKER` / `null`), **`promotionId`** and **`workerAmountBeforeDiscount`**; read from the `bookings` columns added by booking-service migrations 013 and 015 |
| GET | `/bookings/:id/location` | view | job site + **proof** (arrival, start, completion distances, start method, cash, photos); no GPS trail exists |
| GET | `/bookings/:id/reassign-candidates` | `bookings:reassign` | verified, active, same skill, no overlap |
| POST | `/bookings/:id/notes` | `bookings:note` | |
| POST | `/bookings/:id/actions/cancel` | `bookings:cancel` | booking-service. `{ reason, refundPercent }`. **COD: percent of the platform fee waived** |
| POST | `/bookings/:id/actions/override-status` | `bookings:override` | booking-service, forward only: PENDING→ACCEPTED, ACCEPTED→IN_PROGRESS, IN_PROGRESS→COMPLETED_BY_WORKER or COMPLETED, COMPLETED_BY_WORKER→COMPLETED |
| POST | `/bookings/:id/actions/reassign` | `bookings:reassign` | booking-service. Same booking, back to PENDING (`newBookingId` = the booking id) |
| POST | `/bookings/:id/actions/escalate` | `bookings:escalate` | booking-service opens the dispute (only COMPLETED_BY_WORKER) |

### 7.8 Disputes

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/disputes`, `/counts`, `/refunds`, `/:id`, `/:id/notes` | view | |
| POST | `/disputes/:id/notes` | `disputes:note` | |
| POST | `/disputes/:id/actions/assign` | `disputes:assign` | SQL (admin-owned columns) |
| POST | `/disputes/:id/actions/escalate` | `disputes:escalate` | SQL, does not change `disputes.status` |
| POST | `/disputes/:id/actions/resolve` | `disputes:resolve` | admin checks (escalation, 24 h worker window, `overrideWindow`) then **booking-service resolves** (status, money fields, events, notifications) |

### 7.9 Payments (read-mostly, money moves through payment-service)

`GET /payments/overview`, `/revenue`, `/transactions`, `/payouts`, `/refunds`, `/reports` (CSV, audited); `POST /payments/refunds`, `POST /payments/payouts/:id/retry` (payment-service). Unchanged.

### 7.10 Reviews

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/reviews`, `/counts`, `/audit`, `/:id`, `/:id/notes` | view | |
| POST | `/reviews/:id/notes` | `reviews:note` | |
| POST | `/reviews/:id/actions/moderate` | `reviews:moderate` | **review-service `PATCH /internal/reviews/:id/moderate`**; it emits `review.moderated`, so ratings and search update. The panel also resolves the open reports |

### 7.11 Notifications

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/notifications/kpis`, `/campaigns`, `/campaigns/:id` | view | |
| POST | `/notifications/audience/estimate`, `/audience/resolve` | send | |
| POST | `/notifications/broadcasts` | send | **gateway side door → notification-service**; returns `202 { campaignId, status }` immediately; all-users / all-workers need `notifications:broadcast-all` |
| POST | `/notifications/test-send` | send | same path; `pushDelivered` / `pushFailed` are `null` (result is in History) |

### 7.12 Map, Analytics, Catalog, Settings

`GET /map/workers`, `/map/bookings`, `/map/demand`; `GET /analytics/{kpis,growth,funnels,cities,categories}`; categories and services CRUD (every write calls worker-service `/internal/cache/invalidate`).

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET / PATCH | `/pricing-config` | `settings:view` / `settings:edit` | `{ customerFeePercent, workerCommissionPercent, platformFeePercent (total, informational), demandThreshold, demandMultiplier, urgencySameDayMultiplier, urgencyWithin2hMultiplier, offPeakMultiplier }`. Validated ranges. Legacy payload with only `platformFeePercent` is split half / half. **booking-service reads it** |
| GET / POST | `/admins` | `admin_users:manage` | list / create |
| PATCH | `/admins/:id` | manage | `{ role?, isActive? }` |
| POST | `/admins/:id/reset-mfa`, `/admins/:id/logout-all` | manage | |

### 7.13 Coupons (v1.2.0)

All six route files are thin: validate, call booking-service `/internal/admin/coupons/*` through `couponSvc` (`lib/services/booking.ts`), audit, respond. Mapping helpers and zod schemas live in `lib/coupons-api.ts`.

| Method | Path (route file) | Permission | Notes |
|---|---|---|---|
| GET | `/coupons` (`coupons/route.ts`) | `coupons:view` | list. Query `status` (`all`, `ACTIVE`, `PAUSED`, `PENDING_APPROVAL`, `EXHAUSTED`, `ENDED`, `REJECTED`, `expired`), `search` (code or title), `page`, `pageSize` (max 100, default 20). Returns `{ data, page, pageSize, total, totalPages }` with a derived `state` per row |
| POST | `/coupons` (`coupons/route.ts`) | `coupons:create` | create one coupon, 201. Zod-validated (section 8.13). Audit `coupon.created` |
| POST | `/coupons/batch` (`coupons/batch/route.ts`) | `coupons:create` | generate 1 to 5,000 single-use codes, 201 `{ batchId, count, codes }`. The codes are returned **once**; only count and batch id are audited. 30 s timeout |
| GET | `/coupons/:couponId` (`coupons/[couponId]/route.ts`) | `coupons:view` | detail with `stats { consumed, released, discountPkr }` and status `history` |
| GET | `/coupons/:couponId/redemptions` (`…/redemptions/route.ts`) | `coupons:view` | 20 per page, `?page=`. Customer phone **masked to the last 4 digits** (`phoneLast4`) |
| POST | `/coupons/:couponId/actions/:action` (`…/actions/[action]/route.ts`) | per action | `pause`, `resume`, `end`, `extend` → `coupons:manage`; `approve`, `reject` → `coupons:approve-high`. Unknown action → 404. `reason` (≥ 3 chars) required for `pause`, `end`, `reject` (400 otherwise); `extend` needs a valid `endsAt` (400 otherwise). Audit `coupon.paused` / `resumed` / `ended` / `extended` / `approved` / `rejected` |

Booking detail extra fields are listed in 7.7.

### 7.14 Promotions (new in v1.3.0)

Five handlers in four route files. All call booking-service `/internal/admin/promotions/*` through `promotionSvc` (`lib/services/booking.ts`); mapping helpers, the action table and the guardrail schema are in `lib/promotions-api.ts`. These are **worker-funded** offers; platform campaigns are coupons (section 8.14).

| Method | Path (route file) | Permission | Notes |
|---|---|---|---|
| GET | `/promotions` (`promotions/route.ts`) | `promotions:view` | list. Query `status` (`PENDING_APPROVAL`, `ACTIVE`, `PAUSED`, `EXHAUSTED`, `EXPIRED`, `ENDED`, `REJECTED`), `search` (offer title or worker), `page`, `pageSize` (max 100, default 20). Returns `{ data, page, pageSize, total, totalPages }` with a derived `state` per row |
| GET | `/promotions/:promotionId` (`promotions/[promotionId]/route.ts`) | `promotions:view` | detail: the offer plus `stats { consumed, released, discountPkr, workerCostPkr }`, status `history` and `abuseSignals` |
| POST | `/promotions/:promotionId/actions/:action` (`…/actions/[action]/route.ts`) | per action | `approve`, `reject` → `promotions:approve`; `pause`, `resume`, `end` → `promotions:suspend`. Unknown action → 404. `reason` (≥ 3 chars) required for `reject`, `pause`, `end` (400 `A reason is required`). `resume` only works for offers paused by an admin (booking-service rule, 409 otherwise). Audit `promotion.approved` / `rejected` / `paused` / `resumed` / `ended` |
| GET | `/promotions/settings` (`promotions/settings/route.ts`) | `promotions:view` | the 10 guardrails (camelCase to the browser, snake_case to booking-service) |
| PUT | `/promotions/settings` (`promotions/settings/route.ts`) | `settings:promotions` | zod-validated with the same ranges as booking-service (section 8.14); auto-approve percent cannot exceed the max percent (400). Audit `promotion_settings.updated` with before and after values |

### 7.15 Ranking (new in v1.3.0)

Eight handlers in six route files, plus the two worker ranking routes in 7.5. Policy routes call search-service `/internal/ranking/*` through `rankingSvc` (`lib/services/search.ts`); schemas and mappers are in `lib/ranking-api.ts`, term and parameter metadata in `lib/ranking-constants.ts`.

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/ranking/configs` | `ranking:view` | all versions with weights, params, prior, active and shadow state |
| POST | `/ranking/configs` | `ranking:config` | creates a new **inactive** version, 201 `{ version }`. All **13 weights are required** (strict schema, an unknown key such as the legacy `boost` is rejected), at least one above 0, each 0 to 1 |
| POST | `/ranking/configs/:version/activate` | `ranking:config` | `{ note }` (≥ 3 chars) required. **Activating an older version is the rollback.** Other search pods pick it up within `RANKING_CONFIG_CACHE_SECONDS` (about 1 minute). Audit `ranking.config_activated` |
| POST | `/ranking/configs/:version/shadow` | `ranking:config` | `{ enabled, samplePct (1 to 100, default 5) }`, for inactive versions. Audit `ranking.shadow_changed` |
| GET | `/ranking/overrides` | `ranking:view` | CATEGORY and CITY overrides |
| POST | `/ranking/overrides` | `ranking:config` | upsert `{ scopeType: CATEGORY\|CITY, scopeValue, patch { weights?, params? }, note? }`, 201 `{ id }` |
| DELETE | `/ranking/overrides/:overrideId` | `ranking:config` | UUID checked by middleware |
| POST | `/ranking/simulate` | `ranking:config` | read-only comparison of the active version and a candidate over up to 20 queries, `top` 3 to 20 (default 10). 60 s timeout. **No audit row** (changes nothing) |

---

## 8. Modules & Business Rules

### 8.1 Dashboard

30 s SWR refresh. Revenue today / yesterday / sparkline and the revenue chart all use completed bookings by completion time (Karachi), the same basis as Finance. Needs-attention thresholds are fixed in `get_needs_attention()` (section 4.4). Offers waiting for approval are **not** part of it (section 21, item 17); the Promotions page shows a banner instead.

### 8.2 Users

Status is derived: `deleted > banned > suspended > active > inactive`. Suspend and ban set `is_active=false`. After every moderation write the panel deletes `user:status:{id}`, `chat:acct:user:{id}`, `contact:user:{id}` so other services see it immediately. Access tokens issued earlier live up to 15 min (no `jti` blacklist yet). There is no unban. Edit-contact changes the login phone.

### 8.3 Workers

Derived status plus presence. Moderation (suspend, unsuspend, ban, force-offline) goes through worker-service, which writes the columns, clears worker, chat and contact caches and emits `worker.moderation_changed`; search drops the worker within seconds. Featured only for VERIFIED, non-banned workers. Badges `top_rated`, `background_verified` are rows in `worker_badges`.

**Ranking card (v1.3.0).** The worker detail page mounts `WorkerRankingPanel` under the performance card. It returns nothing when the admin has no `ranking:view`. It shows the ranking multiplier, decayed acceptance, worker cancel plus no-show share, repeat customers, lifetime completed jobs, distinct customers, 4+ star share, average response, the customer concentration of the top 5 customers (anonymised), active and past flags and the last 14 days. Add and revoke flag buttons need `ranking:flag`. See section 8.15.

### 8.4 Worker verification

Queue tabs `pending`, `resubmitted`, `approved`, `rejected` (decided tabs show the last 30 days). SLA: amber ≥ 48 h, red ≥ 72 h. **Approve and reject are decided by worker-service**, so the admin panel and the worker app can no longer disagree about the required documents (CNIC front + back, business registration for companies), duplicate CNIC, or rejection codes. The panel shows documents with 15-minute signed URLs and logs every access. Request-info sends the worker a push.

### 8.5 Bookings

Board columns `pending`, `accepted`, `in_progress`, `completed_by_worker`, `completed`, `cancelled_disputed`. City = job address city, else worker city. Payment status derived from refund amount and `is_payment_confirmed`.

| Action | Allowed from | Effect (done by booking-service) |
|---|---|---|
| **Cancel** | PENDING, ACCEPTED, IN_PROGRESS | `CANCELLED`, `cancelled_by='admin'`, waived percent of the fee, BullMQ jobs removed, worker `is_on_job` re-synced, no strikes, `booking.cancelled` event |
| **Override status** | see table in 7.7 | forward only; COD settlement runs on `→ COMPLETED`; company providers must accept themselves |
| **Reassign** | PENDING, ACCEPTED | same booking, new worker, status `PENDING`, tiered response window, `booking.reassigned` event |
| **Escalate** | COMPLETED_BY_WORKER | opens a dispute for the customer, `booking.disputed` event |

The panel shows "fee waiver %" for COD. Every action is audited with the reason.

**Discounted bookings (v1.3.0, replaces the v1.2.0 text).** A discounted booking is funded either by the **platform** (a coupon) or by the **worker** (a worker promotion). The summary reads `discountFunding` and shows the matching wording when `discountAmount > 0`:

| | Coupon (`discountFunding = 'PLATFORM'`) | Worker offer (`discountFunding = 'WORKER'`) |
|---|---|---|
| Discount line | "Coupon (CODE), funded by the platform" | "Worker offer (CODE), funded by the worker" |
| Subtotal before discount | shown | shown |
| Worker payout | **unchanged**, workers are paid in full | **lower** than without the offer (fees and commission are recomputed on the smaller subtotal) |
| Extra row | none | "Worker payout without the offer" (`workerAmountBeforeDiscount`) |
| Platform fee percentage base | `estimatedTotal + discountAmount` (pre-discount) | `estimatedTotal` (the fee is already on the smaller subtotal) |

The code is masked in both cases. Identity to check on screen: `estimatedTotal = workerAmount + platform revenue`.

### 8.6 Disputes

Tabs: **open** (needs a decision), **awaiting** (worker still has 24 h), **escalated**, **resolved** (30 days). Claim / release and escalate are admin-owned SQL. **Resolve:** admin checks (escalated needs SUPER_ADMIN, 24 h window needs `overrideWindow`), then booking-service decides the money (`REFUND_GRANTED` = full total waived, `NO_REFUND` = 0, `PARTIAL_REFUND` strictly between 0 and the total), moves the booking to `REFUNDED` or `RESOLVED`, and emits `booking.dispute_resolved` plus notifications.

### 8.7 Payments & finance

The panel never writes payment tables. Revenue = completed bookings by completion time; ledger status = `payments.status` or `COD_COLLECTED`. Manual refund re-validated against the payment, then forwarded to payment-service. Destinations masked to the last 4; CSV formula-injection guard.

### 8.8 Notifications

```
POST /notifications/broadcasts
  ├─ permission; all_users / all_workers need notifications:broadcast-all
  ├─ validate label, audience, channels, message (catalog template or custom), category
  ├─ duplicate guard: same template_key within 35 s → 429
  └─ launchBroadcast() → gateway side door → notification-service
        (creates the campaign, applies opt-outs and quiet hours, sends push and SMS in the background)
```
Templates come from `lib/notification-catalog.ts` (**19** templates, English + Roman Urdu; v1.2.0 added `coupon_gift`); `scripts/generate-broadcast-templates.ts` writes the files for notification-service. The panel holds **no Firebase credentials**. The `promotion.events` messages to workers (approved, rejected, paused by admin) are sent by notification-service itself; the panel catalog has no promotion template.

### 8.9 Reviews

hide → `ADMIN_HIDDEN`, restore → `ADMIN_RESTORED`, dismiss = keep (auto-hidden review restored). The transition is checked in the panel, executed by review-service, which emits `review.moderated` so `workers.avg_rating` and the search index follow. Signals `short_one_star`, `burst_one_star`; rating audit flags `low_rating`, `rapid_drop`, `many_disputes`.

### 8.10 Live map

Polling: workers 5 s, jobs 15 s, demand 60 s. Demand uses `search_demand_log` and falls back to booking locations while search-service does not write the log (the search service currently produces no demand events, audit M-01).

### 8.11 Analytics

7 / 30 / 90 days, 60 s refresh. DAU and DAW rolling 24 h; completion, acceptance and value use fixed 7-day windows; retention = booked again within 7 days of the first booking.

### 8.12 Categories & pricing

Category `id` is an immutable slug. **Settings → Pricing** edits the customer fee, worker commission, demand and urgency multipliers; booking-service picks the change up within about 60 seconds and validates it, and existing bookings keep their price. The off-peak multiplier is stored but not applied by booking-service yet.

### 8.13 Coupons (v1.2.0)

Platform-funded discount codes. The panel is a UI and BFF only: **rules, redemption and storage live in booking-service**, and the worker is always paid in full. Pages: `/coupons` (list, filters, "New coupon") and `/coupons/:couponId` (detail, redemptions, actions, history). Nav item "Coupons" (`Ticket` icon) for all four roles. Platform campaigns are coupon batches; there is no separate platform promotion engine (section 8.14).

**Create rules** (zod in `lib/coupons-api.ts`, repeated by booking-service which is authoritative):

- Code 4 to 16 characters, letters, digits and dashes. Title 3 to 120 characters (internal), description ≤ 500.
- `PERCENT` coupons are capped at **50 %**; `FIXED` coupons at **PKR 5,000** (`MAX_PERCENT`, `MAX_FIXED_PKR` in `lib/coupon-constants.ts`).
- `endsAt` must be after `startsAt` and in the future. Uses per customer 1 to 10 (default 1). Optional total uses, minimum job amount (default 0), category scope (ids, empty = all), first-booking-only flag, assigned user, budget cap.
- Until subsidy mode is enabled in booking-service, a discount is capped at the platform take (about 10 % of the job value). The dialog tells the admin this.

**Approval (four-eyes).** A coupon with a budget cap at or below the booking-service threshold becomes **Active** immediately. An **uncapped** coupon, or one above the threshold (`COUPON_HIGH_BUDGET_THRESHOLD_PKR`, booking-service env; the panel only shows a display hint, `HIGH_BUDGET_HINT_PKR` = 100,000), becomes **Needs approval** and needs a second admin with `coupons:approve-high` (SUPER_ADMIN or FINANCE). The creator can never approve their own coupon (403 `COUPON_FOUR_EYES` from booking-service). Reject needs a reason.

**Batch.** 1 to 5,000 single-use codes with an optional prefix (up to 6 letters or digits). A **max discount per code** is required. The codes are shown once in the dialog with a CSV download; the audit log stores only the count and batch id, never the codes.

**States.** `status` (stored by booking-service) plus the validity window gives the displayed `state`: Needs approval, Rejected, Scheduled, Active, Paused, Used up, Expired, Ended (`stateOf`). `expired` is also a list filter.

**Actions.** Pause (reason), Resume, Extend (new end date), End now (reason, customers can no longer use it, bookings that already used it keep their discount), Approve, Reject (reason). The list refreshes every 30 s.

**Redemptions.** Each row shows the customer name, **phone masked to the last 4 digits**, a link to the booking, the discount and whether it was used or given back. A redemption is released back (count restored) when the booking is cancelled while still PENDING.

**Broadcast.** The `coupon_gift` template sends a code, offer text and expiry to customers. Create the coupon first, then paste the code into the broadcast.

### 8.14 Promotions (new in v1.3.0)

**Worker-funded offers.** A worker creates an offer in the worker app; the discount comes off the **pre-fee subtotal**, fees and commission are recomputed, so the **worker earns less** (the customer pays less, the platform keeps its percentages on the smaller amount). The panel is **moderation plus guardrails** only. Rules, redemption and storage live in booking-service. Pages: `/promotions` (tabs **Offers** and **Guardrails**) and `/promotions/:promotionId`. Nav item "Promotions" (`Percent` icon) for all four roles.

**What the panel does not do.** There is no "create platform promotion" wizard and no campaign table: platform campaigns stay in **Coupons** (a coupon batch is the platform campaign, decision D1/D2 of the ranking and promotions master plan). One discount per booking, no stacking (D4): a typed code is checked against promotions first, then coupons; with no code the best automatic promotion applies. Abuse signals are shown in the offer detail, there is no separate abuse review queue, no four-eyes and no code export.

**Offers list.** Filters: search (offer title or worker), status. A "N offers waiting for approval" banner appears above the table when any offer is `PENDING_APPROVAL` (click to filter); it is polled every 30 s. Columns: offer (with share code), worker (link), discount, used, valid window, approval (`Automatic` / `Admin`), state.

**States.** `status` plus `paused_by` and the window give the displayed `state` (`stateOf` in `lib/promotions-api.ts`): Needs approval, Rejected, Scheduled, Active, Paused by worker, Paused by admin, Used up, Expired, Ended.

**Approval.** An offer inside the guardrails goes live automatically (`approval_mode = AUTO`). An offer over a guardrail, or created by a worker with an active ranking flag whose multiplier is below 1, becomes **Needs approval** (`approval_mode = ADMIN`) and waits for one decision with `promotions:approve`. The worker is notified of approve, reject and admin pause.

**Actions** (detail page; booking-service enforces the real state machine):

| Action | Shown when | Permission | Effect |
|---|---|---|---|
| Approve | Needs approval | `promotions:approve` | goes live, `promotion.approved` event |
| Reject | Needs approval | `promotions:approve` | reason required, the worker sees it in the app |
| Pause | Active | `promotions:suspend` | reason required, `paused_by = ADMIN`, the worker **cannot** resume it |
| Resume | Paused by admin only | `promotions:suspend` | offers paused by the worker can only be resumed by the worker |
| End now | Active, Paused, Needs approval | `promotions:suspend` | reason required, customers can no longer use it, bookings that already used it keep their discount |

**Detail page.** Offer data (funded by the worker, reference price snapshot, minimum job amount, scope: one service / category / all services of the worker, share code, first booking only, uses per customer, window, uses, approval mode, rejection reason), **Impact** (used, given back, customers saved in PKR, worker cost in PKR), **Abuse signals** (for example `REPEAT_PAIR`, `CANCEL_AFTER_REDEEM`, informational only) and status history. A redeemed offer is released back (usage restored) when the worker cancels the booking (launch gate G4).

**Guardrails** (`Promotions → Guardrails`, editable with `settings:promotions`, read-only for everyone else). Stored in booking-service `promo_settings`, applied to new offers **and to every checkout**, cached by booking-service for about 60 seconds. Ranges are the same as booking-service `adminPromoSettingsSchema`:

| Setting | Range | Meaning |
|---|---|---|
| Max percent discount (%) | 1 to 50 | hard cap for any worker offer |
| Max fixed discount (PKR) | 50 to 5,000 | hard cap for fixed offers |
| Minimum payable subtotal (PKR) | 100 to 2,000 | a discount can never take the job below this |
| Auto-approve up to (%) | 0 to 30 | cannot exceed the max percent |
| Auto-approve fixed up to (PKR) | 0 to 2,000 | |
| Auto-approve code offers up to (uses) | 1 to 1,000 (integer) | offers with a share code above this many uses need review |
| Active offers per worker | 1 to 10 (integer) | active + pending + paused; set to 1 for the first rollout |
| Max offer duration (days) | 1 to 90 (integer) | |
| Max total uses per offer | 1 to 5,000 (integer) | |
| Price rise tolerance (%) | 0 to 20 | if the worker raises the price more than this after creating the offer, it stops applying |

**Rollout switch.** `PROMOTIONS_ENABLED` (booking-service env, default `false`) controls whether offers apply at checkout; it does **not** hide existing rows from the panel.

### 8.15 Ranking (new in v1.3.0)

**Where things live.** Ranking policy (versions, weights, parameters, overrides, shadow, simulate) is owned by **search-service**; the panel never writes ranking tables (D8, ADR-022). Performance facts (decayed counts, repeat rate, multiplier) and flags are owned by **worker-service**; the 45-day half-life decay is computed there (D6). Console: `Settings → Ranking` (`/settings/ranking`), nav item "Ranking" (`ListOrdered` icon) for SUPER_ADMIN and OPS. Tabs: **Versions**, **Category and city overrides**, **Simulate**.

**Ranking v2.** 13 weighted terms: `relevance, quality, distance, response, activity, availability, recency, reliability, cancellation, satisfaction, experience, trust, newcomer`. The old `boost` term is no longer weighted: it is an **additive, capped boost in points** (default cap 8 of 100, editorial plus promotion combined, applied only above quality, reliability and relevance gates). Terms that do not apply to a search (no text, no location) are dropped and the rest re-normalised, so the weights only need to sum to about 1 (the editor shows the sum and warns outside ±0.015).

**Versions.** Versions are immutable once created. The editor (`ConfigEditorDialog`) always sends **all 13 weights** (the search-service schema is strict, the legacy `boost` key is stripped) plus the quality prior (prior stars and virtual reviews) and the parameter groups: boost and caps, boost gates, diversity (first page window and top-N limits), quality floors, reliability floor, Bayesian priors, experience and newcomer. Every parameter field has a default inside its own range (tested). A new version is saved **inactive**; search never changes until it is activated.

**Flow: create version → simulate → shadow → activate.**

1. **Simulate** (`ranking:config`): replays up to 20 queries (`text, category id, city` per line) against the active version and the candidate side by side, with overlap per query and moved workers. Read-only, nothing is cached or logged.
2. **Shadow** (1 to 5 % of page-1 searches, for 3 to 7 days): customers keep seeing the active version; the shadow version's top 10 is logged (`search_queries.shadow_version`).
3. **Activate** with a note. Search results change for everyone within about a minute.

**Rollback = activate the previous version** (up to about 1 minute, search config cache). Emergency softening without a new version: create an override with `boost.capPoints = 0`.

**Overrides.** A patch of the active version for one CATEGORY (category id slug) or one CITY. Only the keys filled in are changed. The city override is applied after the category one and wins on conflicts.

**Worker flags.** Flag types: Editorial boost, Quality penalty, Fraud suspect, Collusion suspect, Other (manual). A flag has a multiplier from **0.2 to 1.25**, a reason (≥ 5 chars, goes to the audit log) and an optional expiry. The worker's multiplier is the product of the active flags. A worker with a multiplier below 1 also loses the newcomer lift and is held to the strict-offer check (offers need admin approval, section 8.14). The system adds its own flags: more than 40 % of completed jobs from one customer with 10+ jobs triggers an automatic collusion flag (0.9), shown as "automatic". Adding or revoking a flag makes worker-service publish `worker.stats_updated` (reason `ranking_flag`), so search re-ranks the worker within seconds.

**Launch gates the panel supports** (master plan section 8): G2 (backfill ran: the worker Ranking card shows "No performance row yet" until the hourly rollup or the backfill script creates it), G3 (the simulate page is where the shadow comparison is reviewed: no verified, high-quality worker may drop out of the top 20 without a reason).

---

## 9. Cross-Service Contract

### 9.1 Integration per service

| Service | How the panel integrates | Detail |
|---|---|---|
| auth-service, user-service | shared columns + Redis | `users` ban / suspend / `is_active` enforced at login and refresh. The panel deletes `user:status:{id}`, `chat:acct:user:{id}`, `contact:user:{id}` |
| worker-service | **internal API** + shared columns | `/internal/admin/*` for verification and moderation; `/internal/cache/invalidate` after catalog and worker changes; **`/internal/admin/workers/:id/performance` and `/ranking-flags` (section 7.5)** |
| booking-service | **internal API** | `/internal/admin/*` (section 7.7, 7.8), `/internal/admin/coupons/*` (section 7.13) **and `/internal/admin/promotions/*` (section 7.14)**. booking-service emits the events. Also reads the coupon columns (migration 013) and discount funding columns (migration 015) on `bookings` |
| review-service | **internal API** | `PATCH /internal/reviews/:id/moderate` |
| search-service | internal API | `POST /internal/reindex/:workerId` after SQL changes (feature, badge, contact, re-verification); **`/internal/ranking/*` (section 7.15)**. Internal body limit raised to 64 kb (B9) |
| payment-service | HTTP | refunds, payout retry; reads its tables |
| notification-service | gateway side door | broadcasts and tests, including the **`coupon_gift`** broadcast template |
| chat-service | read | `messages` for the booking chat tab |

### 9.2 Contract assumptions (confirm against the other services' docs)

| Assumption | Where it lives |
|---|---|
| worker-service `verify`, `reject`, `moderation`, `documents/:docId/review`, `verification/meta`, `verification` summary with signed URLs, `cache/invalidate`: body field names | `lib/services/worker.ts` |
| review-service moderate body `{ action, note, admin_id }` | `lib/services/review.ts` |
| search-service reindex route | `lib/services/search.ts` |
| booking-service `/internal/admin/*` (defined by booking v3.1.0) | `lib/services/booking.ts` |
| booking-service `/internal/admin/coupons/*` (list, get, redemptions, create, batch, `:id/<action>`): snake_case body and row fields (`code_display`, `discount_type`, `budget_spent_pkr`, `stats.discount_pkr`, …), error code `COUPON_FOUR_EYES` | `lib/services/booking.ts` (`couponSvc`), `lib/coupons-api.ts` (`toServiceBody`, `mapCoupon`) |
| booking-service `GET /internal/admin/promotions` returns `{ items, total, page, page_size }`, each item has the `promotions` columns (snake_case) and optionally `worker_name` | `lib/promotions-api.ts` (`mapPromotion`), `promotions/route.ts` |
| booking-service `GET /internal/admin/promotions/:id` returns the row plus `stats { consumed, released, discount_pkr, worker_cost_pkr }`, `history[]`, `abuse_signals[]` | `promotions/[promotionId]/route.ts` |
| booking-service `GET /internal/admin/promotions/settings` returns the 10 `promo_settings` fields (snake_case), optionally wrapped in `settings` | `mapSettings` |
| booking-service `PUT /internal/admin/promotions/settings` takes `admin_id`, `admin_email` + the 10 fields | `toServiceSettings` |
| search-service `GET /internal/ranking/configs` returns an array of config rows (`version, weights, params, prior_mean, prior_weight, is_active, shadow_enabled, shadow_sample_pct, note, created_by, created_at, activated_by, activated_at`) | `lib/ranking-api.ts` (`mapConfig`) |
| search-service `POST /internal/ranking/simulate` returns `{ active_version, summary: { queries, avg_overlap_at_n }, results: [{ query, active[], candidate[], overlap, moved[] }] }` | `components/ranking/SimulatePanel.tsx` |
| worker-service `GET /internal/admin/workers/:id/performance` returns `{ worker, stats, flags, daily, top_customers }` (snake_case) | `mapPerformance` |

File 01 §18 of the implementation plan lists the booking promotion routes but not their response bodies, so the promotion wrappers are **tolerant** (they accept several field names). A mismatch is a one-line fix in `lib/promotions-api.ts` or `lib/ranking-api.ts`; the routes do not change.

### 9.3 Admin events

The panel produces **no Kafka events** any more. `admin_event_outbox` is deprecated and unused. The owning service emits the events for every action listed above, including `promotion.*` (topic `promotion.events`, producer booking-service outbox) and `worker.stats_updated` (reasons `performance.rollup`, `ranking_flag`).

### 9.4 What other teams must do

| Team | Required |
|---|---|
| booking | v3.1.0 deployed first; **migrations 013 to 015 deployed before this panel version**; `/internal/admin/coupons/*` and `/internal/admin/promotions/*` live with the response shapes of 9.2; reads `platform_pricing_config`; emits events for admin actions; enforces four-eyes and the coupon guardrails (env); Kafka topic `promotion.events` created before migration step (producer has `allowAutoTopicCreation: false`) |
| worker | confirm the internal admin contract; consume `booking.reassigned` with `old_worker_id` / `new_worker_id`; keep `worker_badges` / `worker_verification_reviews` schema; **`/internal/admin/workers/:id/performance` and `/ranking-flags` live, hourly rollup running (`PERF_ROLLUP_CRON`)** |
| review | confirm the moderate body; emit `review.moderated` |
| search | confirm `/internal/reindex/:id`; **`/internal/ranking/*` live, `/internal` body limit raised to 64 kb (B9), port 3019** |
| notification | dispute and admin templates; **deploy the regenerated broadcast template files (incl. `coupon_gift`)**; keep the gateway side door; consume `promotion.events` |
| payment | COD `refund_kind = FEE_WAIVER` moves no money; confirm port (3017 vs 3005); **G1 fix: a discounted COD booking settles `worker_amount` exactly as the booking snapshot** |
| all services | DB roles must bypass RLS |

---

## 10. Security

| Area | Control |
|---|---|
| Transport / headers | HSTS (1 y), `X-Frame-Options: DENY`, `nosniff`, strict referrer, empty Permissions-Policy, `Cache-Control: no-store` on `/auth/*` and `/api/admin/*` |
| CSRF | SameSite=Lax cookies plus Origin = Host check on every unsafe `/api/*` call |
| Authn | Password + mandatory TOTP, trusted devices, lockout, per-IP and per-email limits, constant-time dummy hash |
| Authz | Permission per route with Redis session; `mfa_setup` scope reaches nothing else; coupon approval is four-eyes (booking-service); promotion guardrails and ranking policy need `settings:promotions` / `ranking:config` (SUPER_ADMIN) |
| Sessions | Rotating refresh, theft detection, 3 sessions, deactivation / role change / MFA reset kill sessions at once |
| Secrets at rest | TOTP AES-256-GCM, backup codes HMAC, passwords bcrypt, refresh and device secrets hashed |
| Service-to-service | `X-Internal-Key` per target service (own variable, fallback `INTERNAL_API_KEY`), read at call time, never sent to the browser |
| Input | UUID guard for ids in middleware; zod on auth, coupon, promotion and ranking routes; whitelists for sort columns, enums, tabs; all values bound as `$n`; ranking version path param must match `/^\d+$/` |
| SQL | Parameterised; interpolated values are whitelisted constants only |
| DB | TLS verified when `DATABASE_CA_CERT` is set; RLS on admin tables |
| PII | Payout / refund destinations masked; coupon redemption phone numbers masked to the last 4; **KYC images only as 15-minute signed URLs and every access logged**; CSV formula-injection guard on finance exports; customer concentration on the worker Ranking card is anonymised (counts and shares only, no customer ids) |
| Audit | Every mutation writes `admin_audit_log`; all exports audited; batch coupon codes are never written to the audit log; ranking and promotion changes are audited with reasons and before / after values where they exist |
| Removed | Impersonation endpoint (410), direct Firebase credentials, Supabase keys from `.env.example` |

### Known limits

- `getClientIp` trusts `x-real-ip` / `x-forwarded-for`: only safe behind a proxy that overwrites them (per-account lockout does not depend on it).
- Audit entries are written after the action. If the audit insert fails the action still stands and the full entry is printed to stderr (`[audit] FAILED …`) for recovery.
- Rate limiting is applied to auth endpoints only, not to the data APIs.
- Banned users keep a valid access token for up to 15 minutes.
- Free-text fields are stored as typed; the UI must render them as text.
- Ranking activation has a single approver (one SUPER_ADMIN plus an audited note); promotions have no four-eyes.

---

## 11. Configuration & Environment Variables

### Core (required)

| Variable | Notes |
|---|---|
| `DATABASE_URL` | the **shared** Supabase database |
| `DATABASE_CA_CERT` | Supabase root CA (PEM, `\n`-escaped PEM or base64). Without it TLS is encrypted but not verified |
| `REDIS_URL` | Redis ≥ 6.2; must be the **same Redis** other services use (user / chat cache keys) |
| `ADMIN_JWT_SECRET` | ≥ 32 bytes |
| `ADMIN_MFA_ENCRYPTION_KEY` | 32 bytes base64 |
| `NEXT_PUBLIC_ADMIN_URL` | `https://admin.tasklync.pk` |

### Auth tuning (optional)

`ADMIN_ACCESS_TOKEN_TTL` 900, `ADMIN_SESSION_REMEMBER_TTL` 604800, `ADMIN_SESSION_SHORT_TTL` 28800, `ADMIN_TRUSTED_DEVICE_TTL` 604800, `ADMIN_MFA_TEMP_TOKEN_TTL` 300, `ADMIN_REFRESH_GRACE_SECONDS` 20, `ADMIN_MAX_FAILED_ATTEMPTS` 5, `ADMIN_LOCKOUT_MINUTES` 30, `ADMIN_MAX_CONCURRENT_SESSIONS` 3, `ADMIN_MFA_REQUIRED` true.

### Other services

| Variable | Used for |
|---|---|
| `INTERNAL_API_KEY` | fallback key for every service below |
| `BOOKING_SERVICE_URL`, `BOOKING_SERVICE_INTERNAL_KEY` | booking actions, **coupons and promotions** (`:3004`) |
| `WORKER_SERVICE_URL`, `WORKER_SERVICE_INTERNAL_KEY` | verification, moderation, cache, **worker performance and ranking flags** (`:3003`) |
| `REVIEW_SERVICE_URL`, `REVIEW_SERVICE_INTERNAL_KEY` | review moderation (`:3007`) |
| `SEARCH_SERVICE_URL`, `SEARCH_SERVICE_INTERNAL_KEY` | reindex **and the Ranking console** (**`:3019`**, was wrongly `:3008` before v1.3.0) |
| `PAYMENT_SERVICE_URL`, `PAYMENT_SERVICE_INTERNAL_KEY` | refunds, payout retry (confirm port 3017 vs 3005) |
| `API_GATEWAY_URL`, `GATEWAY_ADMIN_KEY` | broadcasts (gateway side door) |

The coupon, promotion and ranking modules add **no new admin variable**. Coupon guardrails (for example `COUPON_HIGH_BUDGET_THRESHOLD_PKR`) are environment settings of booking-service, deliberately not editable from the UI; promotion guardrails are data in booking-service (`promo_settings`) edited from the panel by SUPER_ADMIN. The new variables of the other services (booking `PROMOTIONS_ENABLED`, `PROMOTION_SWEEP_MINUTES`; worker `PERF_HALF_LIFE_DAYS`, `PERF_WINDOW_DAYS`, `PERF_ROLLUP_CRON`, `PERF_STATS_PUBLISH_MAX`; search `RANKING_SHADOW_ENABLED`, `RANKING_DIVERSITY_WINDOW`) are documented in those services' docs.

> **A wrong `SEARCH_SERVICE_URL` is now visible.** Before v1.3.0 it only made `reindexWorker` fail silently (best effort). Now it also makes the whole Ranking console answer 503.

### Behaviour

| Variable | Default |
|---|---|
| `FORCE_OFFLINE_MINUTES` | `60` |
| `MAP_USE_REDIS_LOCATION` | `false` |
| Mapbox token | variable name to confirm in `components/map/MapView.tsx` |

### Removed

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `IMPERSONATION_JWT_SECRET`, `NEXT_PUBLIC_APP_URL`, `ADMIN_BOOKING_NOTIFICATIONS`, every `FCM_*` / `FIREBASE_*`.

Never commit `.env`. A secret shorter than required fails on first use; keys are read lazily, so a missing key only shows up at the first login or first service call.

---

## 12. Redis Keys

| Key | TTL | Purpose |
|---|---|---|
| `admin:sess:{sid}` | remaining session | session record |
| `admin:rt:{sha256(refresh)}` / `admin:rt_used:{sha256}` | same | current / rotated refresh token |
| `admin:sessions:{adminId}` | 7 d | concurrent-session zset |
| `admin:mfa_tmp:{jti}` | 5 min | single-use MFA challenge |
| `admin:mfa_fail:{adminId}` | 15 min | wrong MFA codes |
| `admin:mfa_pending:{adminId}` | 10 min | setup in progress |
| `admin:totp_used:{adminId}:{code}` | 120 s | TOTP replay protection |
| `admin:rl:*` | 10 min to 1 h | login, mfa, refresh, mfa-setup limiters |

Keys the panel reads or deletes in other services' namespaces: `worker:location:{id}` (read, optional map overlay); `review:{id}`, `rating:summary:{workerId}` are now cleared by review-service; **`user:status:{id}`, `chat:acct:user:{id}`, `contact:user:{id}` are deleted on every user moderation action**; worker-side keys are cleared by worker-service's moderation and cache endpoints. The Coupons, Promotions and Ranking modules add no Redis keys (worker-service invalidates its own caches when a ranking flag changes; search-service caches the active ranking config for `RANKING_CONFIG_CACHE_SECONDS`, about 1 minute, in its own namespace).

The auth rate limiter **fails closed** (a Redis error returns 500).

---

## 13. Audit Log

`admin_audit_log` is append-only. `logAdminAction()` never throws when used after an action (prints the entry on failure); inside a transaction pass the client and a failure rolls the action back. `logAuthEvent()` swallows failures so login never breaks. `resource_id` is `VARCHAR(100)` (UUIDs and slugs; ranking config versions are stored as the version number text).

| Area | Actions |
|---|---|
| Auth | `auth.login_failed`, `auth.login_success`, `auth.login_trusted_device`, `auth.login_mfa_pending`, `auth.login_mfa_setup_required`, `auth.mfa_enabled`, `auth.mfa_success`, `auth.mfa_success_backup_code`, `auth.mfa_failed`, `auth.mfa_lockout`, `auth.logout`, `auth.logout_forget_device`, `auth.refresh_reuse_detected` |
| Admins | `admin.created`, `admin.updated`, `admin.deactivated`, `admin.mfa_reset`, `admin.logged_out_everywhere` |
| Users | `user.warned`, `user.suspended`, `user.unsuspended`, `user.banned`, `user.contact_edited`, `users.exported` |
| Workers | `worker.warned`, `worker.suspended`, `worker.unsuspended`, `worker.banned`, `worker.contact_edited`, `worker.featured`, `worker.unfeatured`, `worker.badge_awarded`, `worker.badge_removed`, `worker.forced_offline`, `worker.reverification_requested`, `worker.verification_approved`, `worker.verification_rejected`, `worker.verification_info_requested`, `worker.verification_cnic_saved`, `worker.verification_viewed`, `worker.documents_viewed`, `workers.exported` |
| Bookings | `booking.cancelled_by_admin`, `booking.status_overridden`, `booking.reassigned`, `booking.escalated_to_dispute`, `booking.note_added`, `bookings.exported` |
| Disputes | `dispute.claimed`, `dispute.released`, `dispute.escalated`, `dispute.resolved`, `dispute.note_added` |
| Payments | `payment.manual_refund`, `payout.retried`, `payments.report_exported` |
| Reviews | `review.hidden`, `review.restored`, `review.reports_dismissed`, `review.note_added` |
| Notifications | `notification.broadcast_launched`, `notification.test_dispatched` |
| Coupons | `coupon.created`, `coupon.approved`, `coupon.rejected`, `coupon.paused`, `coupon.resumed`, `coupon.ended`, `coupon.extended`, `coupon.batch_generated` (resource type `coupon`, or `coupon_batch` for batches; the batch entry holds count, type and value only, never the codes) |
| Promotions | `promotion.approved`, `promotion.rejected`, `promotion.paused`, `promotion.resumed`, `promotion.ended` (resource type `promotion`, reason in `notes`); `promotion_settings.updated` (resource type `platform_config`, resource id `promotions`, with before and after values) |
| Ranking | `ranking.config_created` (resource type `ranking_config`, resource id = version, weights, params and note), `ranking.config_activated` (note required), `ranking.shadow_changed`, `ranking.override_set` and `ranking.override_removed` (resource type `ranking_override`), `ranking.worker_flagged` and `ranking.flag_revoked` (resource type `worker`, reason in `notes`). Simulations are **not** audited (read-only) |
| Catalog | `category.*`, `service.*`, `pricing_config.updated` (with before and after values) |
| Waitlist | `waitlist.status_updated`, `waitlist.exported` |

**Not logged:** failed permission checks, plain reads of data pages, ranking simulations.

```sql
-- Who did what to this record
SELECT created_at, admin_email, action, notes FROM admin_audit_log
WHERE resource_type = 'worker' AND resource_id = '<uuid>' ORDER BY created_at DESC;

-- Failed logins and lockouts, last 24 h
SELECT created_at, admin_email, action, ip_address, notes FROM admin_audit_log
WHERE action IN ('auth.login_failed','auth.mfa_failed','auth.mfa_lockout')
  AND created_at > now() - interval '24 hours' ORDER BY created_at DESC;

-- Everyone who opened identity documents this week
SELECT created_at, admin_email, resource_id FROM admin_audit_log
WHERE action = 'worker.documents_viewed' AND created_at > now() - interval '7 days' ORDER BY created_at DESC;

-- All actions on one coupon
SELECT created_at, admin_email, action, notes FROM admin_audit_log
WHERE resource_type = 'coupon' AND resource_id = '<coupon uuid>' ORDER BY created_at DESC;

-- All actions on one worker promotion
SELECT created_at, admin_email, action, notes FROM admin_audit_log
WHERE resource_type = 'promotion' AND resource_id = '<promotion uuid>' ORDER BY created_at DESC;

-- Every ranking change, last 7 days
SELECT created_at, admin_email, action, resource_id, notes FROM admin_audit_log
WHERE action LIKE 'ranking.%' AND created_at > now() - interval '7 days' ORDER BY created_at DESC;
```

---

## 14. Error Handling Standard

- Responses `{ "error": "Human-readable message" }`; service errors add `code`.
- Calls to other services use `ServiceError` (`lib/internal-client.ts`): the service's own 4xx (400, 403, 404, 409, 422) is passed through with its message; 5xx and unreachable become `502` / `503`. Coupon, promotion and ranking routes use `serviceErrorResponse`; zod failures return 400 `"<field>: <message>"` via `zodResponse`.
- Domain error classes (`BookingActionError`, `DisputeActionError`, `ReviewActionError`, `VerificationError`, `PaymentActionError`, `NotificationActionError`) are mapped by their `*ErrorResponse` helpers.
- Postgres: `23505` → 409; `23P01` → 409; `42P01` / `42703` → 503 "run migration X" or `available:false`; `23503` → not found.
- Unknown: `console.error(tag, err)` + generic 500; no stack traces leak.

| Status | Meaning |
|---|---|
| 400 | validation failed (including `A reason is required` on promotion reject / pause / end, and ranking weights with a missing or unknown term) |
| 401 | no / expired token or destroyed session |
| 403 | permission, MFA setup required, CSRF origin, escalated dispute, `COUPON_FOUR_EYES` (creator approving their own coupon) |
| 404 | not found, or `:id` not a UUID, or unknown coupon / promotion action, or a ranking `:version` that is not a positive integer |
| 409 | conflict or state guard (for example a promotion approve after the worker already ended it, or resume of an offer the worker paused) |
| 410 | removed endpoint (impersonation) |
| 422 | business rule |
| 423 | admin locked |
| 429 | rate limit, duplicate broadcast guard |
| 502 / 503 | another service failed / not configured, migration missing (a wrong `SEARCH_SERVICE_URL` makes every Ranking console call answer 503) |

---

## 15. Frontend Conventions

Design tokens in `globals.css` (page `#F7F8FA`, surface `#FFFFFF`, border `#E5E7EB`, accent `#1F6F5F`, Inter + JetBrains Mono). Primitives: `Button`, `Input`, `Card`, `Badge`, `StatusBadge`, `DataTable`, `ConfirmDialog`. Layout: 240 px sidebar (64 px collapsed), 56 px header.

- Page pattern: `Section` (filters + tab state) → `KpiGrid` → `FilterBar` → `Table`. Detail pages: `Header`, `Summary`, parties, tabs, action panel. Coupons and Promotions follow the same pattern (`CouponsSection`, `CouponDetailView`, `PromotionsSection`, `PromotionDetailView`) without a KPI grid. The Ranking console (`RankingSection`) uses tabs (Versions, Overrides, Simulate) and dialogs instead of a table.
- Data: `fetcher` throws `Error(body.error)`; mutations are plain `fetch` in a `*Actions` object (`couponActions`, `promotionActions`, `rankingActions`), then `mutate()`; 401 handled globally.
- Poll intervals: 5 s map workers, 15 s map jobs, 30 s dashboard / details / lists (coupon and promotion list and detail included, and the pending-offers banner count), 60 s analytics / finance / ranking versions / worker Ranking card, 5 s while a campaign is `SENDING`.
- Sidebar highlights only the most specific matching href, so `/settings/ranking` does not light up "Settings".
- Use `bg-bg-page` and `text-accent` (the old `bg-[--bg-page]` / `text-[--accent]` variables were undefined).
- COD wording: use **"Fee waiver %"** instead of "Refund %" in the booking cancel dialog.
- `SendTestModal` must show "see History" when `pushDelivered` is `null`.
- Money wording on booking detail: say **"funded by the platform"** only for coupons and **"funded by the worker"** for worker offers (section 8.5).

---

## 16. Local Development Setup

Prerequisites: Node ≥ 20, npm ≥ 10, the shared PostgreSQL (all backend migrations applied first, including booking-service migrations 013 to 015), Redis ≥ 6.2.

```powershell
npm install
Copy-Item .env.example .env          # DATABASE_URL, REDIS_URL, ADMIN_JWT_SECRET, ADMIN_MFA_ENCRYPTION_KEY + service URLs
npm run migrate                      # existing database: npm run migrate -- --baseline=015 the first time
npx tsx scripts/seed-super-admin.ts  # first super admin (max 2)
npm run dev                          # http://localhost:3200
```

First login → password → forced MFA enrolment (save the 10 backup codes) → dashboard. More admins: **Settings → Admin users**.

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` / `lint` | Next.js (port 3200) |
| `npm run migrate` | apply new migrations (`admin_migrations` table) |
| `npm test` | Vitest |
| `npx tsx scripts/generate-broadcast-templates.ts [outDir]` | push / SMS template files for notification-service (re-run after catalog changes such as `coupon_gift`) |

Local notes: cookies are `Secure` only in production; Redis must be reachable (the limiter fails closed); to use booking (including coupons and promotions), worker (including ranking flags), search (Ranking console, port **3019**) and review actions locally run those services and set their URLs and keys, otherwise the actions answer 503 "not configured".

---

## 17. Testing

`vitest` with `@` alias. Current tests: UUID id guard (incl. coupon ids and the `batch` static segment, promotion ids and the `settings` static segment, ranking override ids, ranking config versions not guarded), RBAC (impersonation gone, path order, waitlist and settings, coupon, promotion and ranking permissions, `/settings/ranking` checked before `/settings`), review moderation transitions, `safeNextPath`, `mapSignedDocuments` (never exposes raw URLs), **coupons** (`tests/coupons.test.ts`: `stateOf` for pending, scheduled, active, expired, exhausted; `couponCreateSchema` rejects percent above 50, fixed above 5,000, `endsAt` in the past and `endsAt` before `startsAt`), **promotions** (`tests/promotions-api.test.ts`: `stateOf` for pending, scheduled, active, paused by admin, paused by worker, expired, exhausted; action to permission map; reason required for reject, pause and end; guardrail schema accepts defaults, rejects out-of-range values, rejects auto-approve percent above the max percent; camelCase / snake_case round trip of the 10 settings) and **ranking** (`tests/ranking-api.test.ts`: weights schema accepts the 13 default terms and rejects a missing term, an unknown term such as `boost`, all-zero weights and a weight above 1; activation needs a note; version path param is a positive integer; override scope is CATEGORY or CITY; flag multiplier limited to 0.2 to 1.25 and revoke needs a uuid; `setPath` / `getPath`; every param default inside its own range; `mapPerformance` tolerates a worker without stats).

Manual smoke checklist after every deploy:

| # | Check | Expect |
|---|---|---|
| 1 | Open `/` without cookies | redirect to login |
| 2 | Wrong password 5 times | 6th correct attempt → 423 |
| 3 | Correct password, no MFA | forced to `/auth/mfa-setup` |
| 4 | Same TOTP code twice | second fails |
| 5 | Idle 16 min then click | silent refresh |
| 6 | Log out in tab A, call API in tab B | 401, then login |
| 7 | OPS opens `/payments` | redirected to `/` |
| 8 | Foreign `Origin` on any POST | 403 |
| 9 | `GET /api/admin/users/abc` | 404 JSON |
| 10 | Cancel a PENDING booking | `CANCELLED`, history `admin:<email>`, audit row, event emitted by booking-service |
| 11 | Dispute inside the worker window without override | 409 |
| 12 | Approve a worker with the new CNIC front + back | verified |
| 13 | Open worker documents | URLs expire in about 15 min, `worker.documents_viewed` logged |
| 14 | Suspend a worker | works, gone from search in seconds |
| 15 | Create a category | 201 and an audit row |
| 16 | Edit pricing | booking estimate changes within 60 s |
| 17 | Broadcast to one test user | 202 in under a second, campaign visible in History |
| 18 | Impersonate endpoint | 410 |
| 19 | Deactivate an admin | their sessions die at once |
| 20 | SUPPORT opens `/coupons` | list visible, no "New coupon" button |
| 21 | OPS creates a capped coupon (cap ≤ PKR 100,000) | status Active, audit row `coupon.created` |
| 22 | OPS creates an uncapped coupon | status Needs approval |
| 23 | The creator tries to approve it (as SUPER_ADMIN) | 403 `COUPON_FOUR_EYES`; a different FINANCE or SUPER_ADMIN approves it |
| 24 | Batch of 50 | one-time download of 50 codes, audit row has the count only |
| 25 | Book with the coupon, then cancel while PENDING | redemption count back to its old value, history shows the redemption as given back |
| 26 | Booking detail of a discounted booking | coupon line, worker payout unchanged |
| 27 | SUPPORT opens `/promotions` | list visible, no action buttons |
| 28 | OPS opens `/settings/ranking` | versions visible, no "New version" button, Simulate tab says limited |
| 29 | OPS opens `/settings` | redirected to `/` (settings still SUPER only) |
| 30 | A worker creates an offer above the auto-approve limit | banner "1 offer waiting" on `/promotions` |
| 31 | OPS approves it | status Active, audit `promotion.approved`, worker gets the push |
| 32 | OPS rejects another without a reason | 400 "A reason is required" |
| 33 | OPS pauses an active offer, the worker tries to resume | worker cannot; OPS resume works |
| 34 | SUPER changes a guardrail, OPS opens the tab | OPS sees values, fields disabled |
| 35 | SUPER creates a ranking version from v2 | new inactive version, nothing changes in search |
| 36 | Simulate the new version on 5 queries | overlap % and two columns shown |
| 37 | Start shadow at 5 % | `search_queries.shadow_version` fills for about 5 % of page-1 searches |
| 38 | Activate with a note, then activate the old version again | both audited, results revert within about a minute |
| 39 | OPS adds a `QUALITY_PENALTY` 0.7 flag on a worker | multiplier x0.70 shown at once, worker drops after reindex |
| 40 | Open a booking that used a worker offer | line says "funded by the worker", worker payout lower than "without the offer" |

---

## 18. Deployment

Target: Vercel or any Node host. Outbound access to Postgres, Redis, booking, worker, review, search, payment services and the API gateway.

```
□ booking-service v3.1.0 deployed first
□ booking-service migrations 013 (coupons) and 014, 015 (promotions, discount funding) applied BEFORE this panel version (booking detail reads the new bookings columns)
□ booking /internal/admin/promotions/*, worker /internal/admin/workers/:id/performance + /ranking-flags and search /internal/ranking/* live (master plan steps 2 to 4)
□ Kafka topic promotion.events exists and notification-service consumer is up (launch gate G5)
□ SEARCH_SERVICE_URL fixed to port 3019 on the host (B5)
□ npm run build and npm run lint pass
□ Migrations 001 to 016 applied (npm run migrate); get_user_kpis() exists after 016. There is no admin migration 017
□ ADMIN_JWT_SECRET (≥ 48 chars) and ADMIN_MFA_ENCRYPTION_KEY (32 bytes base64) set and backed up separately
□ DATABASE_URL (shared DB) + DATABASE_CA_CERT; REDIS_URL = the SHARED Redis (≥ 6.2, TLS + password)
□ All service URLs and internal keys set (section 11); every key matches the target service
□ API_GATEWAY_URL + GATEWAY_ADMIN_KEY set (broadcasts)
□ Broadcast templates regenerated (npx tsx scripts/generate-broadcast-templates.ts <path>/notification-service/src/templates) and deployed to notification-service (includes coupon_gift)
□ The DB role used by the panel bypasses RLS (Supabase postgres)
□ Proxy overwrites x-real-ip / x-forwarded-for (Vercel does; nginx needs proxy_set_header X-Real-IP $remote_addr)
□ Super admin seeded; second super admin created as break-glass
□ ADMIN_MFA_REQUIRED not set to false
□ Firebase key removed from the host (and rotated if it was ever deployed here)
□ Mapbox token set; Cloudinary host in next.config.ts matches the real cloud name
```

Rollout: apply migrations (additive, safe before code) → deploy → tell owning teams about any new column. For coupons: booking-service migration 013 and its coupon endpoints first, then the panel, then the notification templates. Existing generated files under `generated-templates/` are only a local review copy.

**Promotions and ranking (v1.3.0), the admin panel is step 6 of the master plan rollout (do not reorder):**

1. Apply booking migrations 014 and 015, deploy worker and search per their rollout steps (promotions stay off with `PROMOTIONS_ENABLED=false`, ranking v2 exists but is inactive, v1 keeps serving).
2. Set `SEARCH_SERVICE_URL=...:3019` (and the internal key) on the admin host.
3. Deploy the panel. Super Admin logs in again (the new permissions are code, no DB change).
4. Smoke test (section 17, items 27 to 40).
5. Then, from the panel: simulate v2, run it in shadow (1 to 5 %) for 3 to 7 days, activate it from the Ranking console (master plan step 7). Turn on `PROMOTIONS_ENABLED=true` in booking-service for a few verified workers, with **Active offers per worker** lowered to 1 in the Guardrails tab, then widen (step 8).

**Rollback:** redeploy the previous panel build. The panel stores nothing for these modules, so no data change is needed. Ranking and promotion state live in their services and keep working. The previous booking detail still renders (it ignores the new columns).

| Secret rotated | Effect |
|---|---|
| `ADMIN_JWT_SECRET` | all access tokens invalid; refresh tokens are opaque and survive, so users are silently re-issued |
| `ADMIN_MFA_ENCRYPTION_KEY` | **breaks every stored TOTP secret and backup code**: re-encrypt first or reset MFA for all admins |
| a service internal key | change in both places at once |

---

## 19. Runbooks & Troubleshooting

| Symptom | Check / fix |
|---|---|
| Every request redirects to login | `ADMIN_JWT_SECRET` changed or missing; Redis unreachable; Secure cookie on plain http |
| `ADMIN_JWT_SECRET must be set…` | env var missing or short |
| Admin locked out | `UPDATE admin_users SET failed_attempts = 0, locked_until = NULL WHERE LOWER(email) = '…';` then delete `admin:rl:login:*` keys |
| Admin lost authenticator and backup codes | **Settings → Admin users → Reset MFA** (another Super Admin). SQL fallback: `UPDATE admin_users SET mfa_enabled=false, mfa_secret=NULL WHERE …; DELETE FROM admin_mfa_backup_codes WHERE admin_id=…;` |
| Force-logout one admin | **Settings → Admin users → Sign out everywhere**, or deactivate |
| An action answers 502 / 503 "… is not configured / unreachable" | check that service's URL and key in the env (section 11) and that the service is up |
| 401 `INVALID_INTERNAL_KEY` from a service | key differs between the panel and that service |
| Verification: "documents could not be loaded" | worker-service verification summary failing; check its logs and `WORKER_SERVICE_URL` |
| Approve fails with 409 / 422 | message comes from worker-service (missing CNIC side, duplicate CNIC, status changed) |
| Suspend / ban succeeded but the worker still appears in search | search-service reindex failed (best effort); run `POST search /internal/reindex/<id>` |
| Banned user still acts in the app | user caches cleared by the panel; existing access tokens live ≤ 15 min |
| Broadcast stays `SENDING` | notification-service job issue; the panel only queued it. Check notification-service and its Kafka / queue |
| Test push says "no device token" | the account never registered an FCM token (app must register it) |
| Revenue differs between dashboard and finance | should be equal after 016; if not, confirm 016 ran and the cached SWR data refreshed |
| `Analytics functions are missing` (503) | run `011_analytics.sql` |
| `Dispute tables are out of date` (503) | run `010_disputes_admin.sql` |
| `Review tables are out of date` (503) | run review-service migrations, then `014` |
| Booking timeline empty | migration 008 not applied |
| Pricing page saves but prices do not change | booking-service has `PRICING_CONFIG_FROM_DB=false`, or values were out of its accepted range (see its logs) |
| Booking detail fails with a missing column (`discount_amount`, `coupon_code_masked`) | booking-service coupon migration 013 not applied yet; apply it, no panel change needed |
| Booking detail fails with missing column `discount_funding` / `promotion_id` / `worker_amount_before_discount` | booking-service migration 015 not applied yet; apply it, no panel change needed |
| Coupon list answers 502 / 503 | `BOOKING_SERVICE_URL` / key wrong, or booking-service has no `/internal/admin/coupons/*` yet |
| Approve a coupon answers 403 `COUPON_FOUR_EYES` | the same admin created and tried to approve it; a different FINANCE or SUPER_ADMIN must approve |
| Coupon stuck in "Needs approval" | uncapped or above the high-budget threshold; a second approver with `coupons:approve-high` is required |
| Batch codes lost (dialog closed) | the codes are shown once and never stored in the audit log; end the batch's coupons and generate a new batch |
| Ranking page says "Couldn't load ranking versions" | `SEARCH_SERVICE_URL` still on port 3008 (must be 3019), or search-service has no `/internal/ranking/*` yet |
| Simulation answers 502 or takes very long | search-service query too heavy; reduce queries or results per query (timeout 60 s) |
| Creating a ranking version answers 400 `weights: Unrecognized key` | a legacy `boost` key; the editor never sends it, so you are calling the API by hand |
| Creating a version fails with a body-size error from search-service | search-service `/internal` body limit still 1 kb; it must be 64 kb (B9) |
| Activated a bad ranking version | activate the previous version again (about 1 minute) or create an override with `boost.capPoints = 0` |
| Worker Ranking card says "No performance row yet" | the hourly rollup (`PERF_ROLLUP_CRON`) has not run for this worker or the backfill script was not run (launch gate G2) |
| Offers page empty but workers created offers | `PROMOTIONS_ENABLED=false` does not hide existing rows; check the booking-service list route and the `promotions` table |
| Promotion approve answers 409 | state changed meanwhile (worker ended it, or it already expired); refresh |
| Promotion resume answers 409 | the offer was paused by the worker; only the worker can resume it (admin resume works for admin-paused offers) |
| Guardrail save answers 400 | out-of-range value, or auto-approve percent above the max percent |
| Guardrail change has no effect yet | booking-service caches `promo_settings` for about 60 seconds |
| Booking shows the worker earning less than expected | it used a worker offer (`discount_funding = WORKER`): the discount comes off the pre-fee subtotal; compare with "Worker payout without the offer" |
| Audit write failed (`[audit] FAILED …` in logs) | the action succeeded; copy the JSON entry from the log into `admin_audit_log` |

```sql
-- Active sessions per admin  (Redis)  ZCARD admin:sessions:<adminId>

SELECT id, ip_address, created_at, last_used_at, expires_at, revoked_at
FROM admin_trusted_devices WHERE admin_id = '<uuid>' ORDER BY created_at DESC;

-- Which migrations look applied
SELECT name, ran_at FROM admin_migrations ORDER BY name;
SELECT to_regclass('admin_trusted_devices') AS m015, to_regclass('review_admin_notes') AS m014,
       to_regclass('search_demand_log') AS m013, to_regclass('dispute_admin_notes') AS m010,
       to_regclass('booking_status_history') AS m008, to_regclass('worker_verification_reviews') AS m007;
```

---

## 20. Architecture Decision Records (ADRs)

**ADR-001: One Next.js app with BFF routes.** Accepted. UI and API together; the browser never talks to other services.

**ADR-002: Direct SQL on the shared database for reads, and for admin-owned columns only.** Accepted (narrowed in v1.1.0). Lists, KPIs and details need joins across eight services. Writes to tables owned by another service go through that service (ADR-013).

**ADR-003: Separate admin authentication (HS256, own tables, own Redis keys).** Accepted. A customer or worker row can never become an admin.

**ADR-004: MFA mandatory for every role, with trusted devices.** Accepted. Password-only sessions can reach nothing but MFA enrolment.

**ADR-005: Opaque rotating refresh tokens + server-side sessions.** Accepted. The Redis session is the real authority; absolute expiry never extended.

**ADR-006: Two-layer authorisation (edge + handler).** Accepted. Middleware blocks cheaply, handlers re-check with the Redis session.

**ADR-007: Derived statuses instead of stored status columns.** Accepted.

**ADR-008: Transactional outbox for admin-originated events.** **Superseded by ADR-013.** The relay was never built; the table is deprecated.

**ADR-009: Direct FCM broadcast from the admin server.** **Reversed.** It bypassed opt-outs and quiet hours, never sent SMS, ran sequentially inside one request and required a Firebase key on the admin host. Broadcasts go through the gateway side door to notification-service.

**ADR-010: The server computes money; the browser only chooses an action.** Accepted. Dispute amounts are derived server-side (now inside booking-service).

**ADR-011: Availability-aware reads for other services' tables.** Accepted.

**ADR-012: Reason required for every destructive action.** Accepted. Applies to coupon pause, end and reject, to promotion reject, pause and end, and to ranking activation (note) and flag changes.

**ADR-013: The owning service performs the write and emits the event.** Accepted (v1.1.0). booking, worker and review actions are internal API calls. Benefits: one writer per table, correct side effects (BullMQ jobs, `is_on_job`, caches, search, ratings), no lost events. The panel keeps SQL only for columns it owns.

**ADR-014: Service clients are isolated in `lib/services/*`.** Accepted. Every URL, key and body shape of another service lives in one file; routes never build service requests themselves.

**ADR-015: Best-effort follow-ups never fail an action.** Accepted. Cache invalidation and search reindex are `bestEffort`; the audit write after an action never throws and prints the entry on failure.

**ADR-016: One date basis for money (completion time, Karachi).** Accepted. Dashboard, finance and analytics agree.

**ADR-017: Impersonation removed.** Accepted. No service accepts the token and a signed JWT in a URL is unsafe. A read-only "view as user" screen can be designed later.

**ADR-018: Documents only as short-lived signed URLs, every access logged.** Accepted.

**ADR-019: Pricing is data owned by the admin panel and read by booking-service.** Accepted. Validated and cached on the booking side with env fallback, so a wrong value cannot stop bookings.

**ADR-020: Coupon rules, storage and four-eyes live in booking-service; the panel is UI and BFF only.** Accepted (v1.2.0). No admin-owned coupon tables and no admin migration. All coupon reads and writes use `/internal/admin/coupons/*` via `couponSvc` (ADR-013, ADR-014). The creator can never approve their own coupon, and financial guardrails are booking-service environment settings, not UI, so no panel role can loosen them.

**ADR-021: Worker promotions are worker-funded and moderated, not created, by the panel; platform campaigns stay coupon batches.** Accepted (v1.3.0, decisions D1 to D4 of the ranking and promotions master plan). No `promo_campaigns` table and no second code system: a platform campaign is a coupon batch (`coupons.batch_id`). Worker promotions are `promotion_*` tables in booking-service; the discount comes off the pre-fee subtotal and fees and commission are recomputed (`discount_funding = 'WORKER'`), while coupons stay platform-funded and leave the worker payout untouched. One discount per booking, no stacking. The panel only moderates (approve, reject, pause, resume, end) and edits guardrails. Unlike coupon guardrails, promotion guardrails are **data** (`promo_settings`) editable by SUPER_ADMIN from the panel, because they must be tightened quickly during rollout (for example one active offer per worker); booking-service still validates every value and applies it to every checkout. There is no four-eyes on promotions: one OPS or SUPER_ADMIN decision is enough, and offers inside the guardrails need none.

**ADR-022: Ranking policy lives in search-service, performance facts in worker-service; the panel never writes ranking tables.** Accepted (v1.3.0, decisions D5 to D8). One writer per table: the panel calls `/internal/ranking/*` on search-service (the same pattern as `/internal/reindex`) and `/internal/admin/workers/:id/ranking-flags` on worker-service. Versions are immutable and created inactive; activation needs a note and is audited, and **rollback is activating the previous version**. Search reads promotions and performance stats read-only and mirrors them in its own index (D7); the 45-day half-life decay is computed once, in worker-service (D6), so there is no config drift. Weights are a strict object of all 13 terms; the old `boost` term is an additive, capped boost in points (D5). Simulation is read-only and not audited. Ranking activation has a single approver by design in this release (section 21, item 20).

---

## 21. Known Issues & Roadmap

### Open items

| # | Item | Detail |
|---|---|---|
| 1 | Contract bodies to confirm | section 9.2. Until worker, review, search, the booking coupon endpoints and the booking promotion endpoints (list, detail and settings shapes are assumed) are confirmed the wrappers may need a one-line fix |
| 2 | Access tokens outlive a ban by ≤ 15 min | needs a `jti` blacklist in the gateway (audit G-21) |
| 3 | Data APIs have no per-admin rate limit | exports, broadcasts, refunds |
| 4 | Worker strikes not shown in the worker detail page | `booking_penalties` is readable; add a tab |
| 5 | Dashboard attention panel ignores `stuckInProgress` | the JSON key is delivered, add a row in `AttentionPanel.tsx` |
| 6 | `SendTestModal` / booking cancel dialog wording | show "see History" for `null` results; "Fee waiver %" label |
| 7 | `search_demand_log` stays empty | search-service writes no demand events (audit M-01); the map falls back to bookings |
| 8 | Off-peak multiplier not applied | stored, configurable, ignored by booking-service pricing |
| 9 | No unban / undelete for users | |
| 10 | Middleware vs Next 16 `proxy` convention | verify against the installed version |
| 11 | Dead components for impersonation | button is hidden by the removed permission; delete the JSX later |
| 12 | `hasDispute` filter on the users list | accepted and ignored |
| 13 | `BookingActionDialogs.tsx` Reassign text is stale | still says "creates a new pending booking"; booking v3.1.0 reassigns the **same** booking. Correct the string |
| 14 | Dead component `components/categories/PricingConfigPanel.tsx` | old single-fee form; the live editor is `components/settings/PricingSettings.tsx`. Delete the old file |
| 15 | Broken link in `app/(admin)/categories/page.tsx` | still links to `/categories/pricing`, which has no page. Point it to `/settings` |
| 16 | Coupon high-budget hint is display only | `HIGH_BUDGET_HINT_PKR` (100,000) in `lib/coupon-constants.ts` can drift from booking-service's `COUPON_HIGH_BUDGET_THRESHOLD_PKR`; booking-service decides |
| 17 | Dashboard attention panel has no "offers waiting for approval" row | needs an admin migration that redefines `get_needs_attention()` (and its current body); the Promotions page shows a banner instead. Optional follow-up |
| 18 | No ranking explain screen | search-service has no explain route in the implemented plan |
| 19 | Promotion list, detail and settings response shapes are assumed | section 9.2; confirm with booking-service |
| 20 | Ranking activation has no second approver | single SUPER_ADMIN plus an audited note; promotions have no four-eyes either |
| 21 | Ranking parameters and weight defaults are mirrored in the panel | `lib/ranking-constants.ts` copies `RANKING_TERMS` and `DEFAULT_PARAMS` from search-service (it clamps everything again); keep them in sync when search-service adds a term or parameter |
| 22 | Promotion guardrail ranges are mirrored in the panel | `PROMOTION_SETTING_FIELDS` copies `adminPromoSettingsSchema` from booking-service; booking-service is authoritative |

### Roadmap

| Item | Notes |
|---|---|
| Audit log viewer page | data already collected |
| Playwright test for the auth flow, more Vitest around action routes with mocked service clients | |
| WebSocket / SSE for map and activity | currently polling |
| Per-admin rate limits on data APIs | |
| Read-only "view as user" support tool | replaces impersonation |
| Move CNIC number saving and re-verification to worker-service endpoints | removes the last worker writes |
| Settings page: more platform configuration | |
| Dashboard row for offers waiting for approval | item 17 |
| Ranking explain page, second approver for ranking activation | items 18 and 20 |

---

## 22. Changelog

### v1.3.0: Promotions and Ranking (November 2026)

**Added**
- **Promotions module** (`/promotions`, `/promotions/:promotionId`): list with filters and a "waiting for approval" banner, detail with impact and abuse signals, approve / reject / pause / resume / end, and a **Guardrails** tab (10 limits, editable by SUPER_ADMIN only).
- **Ranking console** (`/settings/ranking`): versions, create a version (all 13 weights plus parameters and quality prior), simulate, shadow, activate / roll back, category and city overrides.
- **Worker detail "Ranking" card** (`WorkerRankingPanel`): decayed performance facts, customer concentration, add and revoke ranking flags.
- 7 permissions: `promotions:view`, `promotions:approve`, `promotions:suspend`, `settings:promotions`, `ranking:view`, `ranking:flag`, `ranking:config` (total 51 → **58**); route permissions `/promotions` and `/settings/ranking` (above `/settings`); nav items "Promotions" (`Percent`) and "Ranking" (`ListOrdered`).
- 15 route handlers (promotions 5, ranking 8, worker ranking 2; total 131 → **146**).
- Service clients: `promotionSvc` (booking-service), `rankingSvc` (search-service), `workerSvc.performance` and `workerSvc.rankingFlag` (worker-service). `callService` supports `PUT` and `DELETE`.
- UUID guard entries for `/api/admin/promotions/` (static segment `settings`) and `/api/admin/ranking/overrides/`; ranking config versions are integers, validated by the route.
- 13 audit actions: `promotion.approved`, `promotion.rejected`, `promotion.paused`, `promotion.resumed`, `promotion.ended`, `promotion_settings.updated`, `ranking.config_created`, `ranking.config_activated`, `ranking.shadow_changed`, `ranking.override_set`, `ranking.override_removed`, `ranking.worker_flagged`, `ranking.flag_revoked`.
- New files: `lib/promotion-constants.ts`, `lib/promotions-api.ts`, `lib/ranking-constants.ts`, `lib/ranking-api.ts`, `types/promotion.ts`, `types/ranking.ts`, `hooks/usePromotions.ts`, `hooks/useRanking.ts`, the route files, three pages, `components/promotions/*`, `components/ranking/*`, `components/workers/WorkerRankingPanel.tsx`, `tests/promotions-api.test.ts`, `tests/ranking-api.test.ts`.
- Smoke checks 27 to 40; tests added to `tests/rbac.test.ts` and `tests/uuid-guard.test.ts`.
- ADR-021 and ADR-022.

**Changed**
- Booking detail separates worker-funded offers from platform-funded coupons (wording, "Worker payout without the offer" row) and `pricing` gains `discountFunding`, `promotionId` and `workerAmountBeforeDiscount`.
- Platform fee percentage on the booking summary uses the correct base per funding type (pre-discount base for coupons, the discounted total for worker offers).
- Deploy order: booking-service migrations 013 to 015, worker, search and booking internal routes live, `SEARCH_SERVICE_URL` fixed, then this panel. **No admin migration 017** is created.
- `package.json` version bumped to 1.3.0.

**Fixed**
- `SEARCH_SERVICE_URL` pointed to port 3008 in `.env.example` and the docs; search-service runs on **3019**. Reindex calls had been failing silently (best effort); the wrong port now also makes the Ranking console answer 503, so fix the value on the host too (B5).

**Documentation drift corrected**
- `package.json` said 1.1.0 while this document said 1.2.0; both now say 1.3.0.
- Search-service port in sections 9 and 11 corrected to 3019.

### v1.2.0: Coupons module (November 2026)

**Added**
- **Coupons module** (`/coupons`, `/coupons/:couponId`): list with filters, create single coupon, batch generation of single-use codes (one-time CSV download), detail page with stats, redemptions and status history, and actions pause, resume, end, extend, approve, reject.
- 6 API route files under `/api/admin/coupons/*` (5 route handlers for the endpoints plus the dynamic action route; total route handlers 126 → **131**), all calling booking-service `/internal/admin/coupons/*` through `couponSvc` in `lib/services/booking.ts`.
- 4 permissions: `coupons:view`, `coupons:create`, `coupons:manage`, `coupons:approve-high` (total 47 → **51**); `/coupons` route permission; nav item "Coupons".
- Four-eyes approval for uncapped / high-budget coupons (enforced in booking-service, FINANCE can approve but not create).
- UUID guard entry for `/api/admin/coupons/` with the static segment `batch`.
- New files: `lib/coupon-constants.ts`, `lib/coupons-api.ts`, `types/coupon.ts`, `hooks/useCoupons.ts`, the six route files, two pages, `components/coupons/{CouponsSection,CouponFormDialog,CouponDetailView}.tsx`, `tests/coupons.test.ts`.
- Booking detail shows the coupon: "Subtotal before coupon" and "Coupon (CODE), funded by the platform" lines; `pricing` gains `discountAmount`, `subtotalBeforeDiscount`, `couponCode`.
- Broadcast template `coupon_gift` (English + Roman Urdu; catalog now 19 templates).
- Audit actions `coupon.created`, `coupon.approved`, `coupon.rejected`, `coupon.paused`, `coupon.resumed`, `coupon.ended`, `coupon.extended`, `coupon.batch_generated`.
- Smoke checks 20 to 26; tests in `tests/rbac.test.ts` and `tests/uuid-guard.test.ts` for coupons.

**Changed**
- Booking summary platform fee percentage is computed on the pre-discount base (`estimatedTotal + discountAmount`).
- Deploy order: booking-service migration 013 (coupons) before this panel version. **No admin migration 017** is created.

**Documentation drift corrected**
- Dev port is **3200** (`next dev -p 3200` in `package.json`), not 3100.
- `components/categories/PricingConfigPanel.tsx` (old single-fee form) is dead code; the live editor is `components/settings/PricingSettings.tsx`. `app/(admin)/categories/page.tsx` still links to `/categories/pricing`, which has no page (should point to `/settings`).
- `db/migrations/001_admin_auth.sql` is the original `resource_id UUID` version; migration 016 fixes it, this is expected.
- `BookingActionDialogs.tsx` Reassign text still says "creates a new pending booking" (booking v3.1.0 reassigns the same booking).

### v1.1.0: Cross-service audit round 2 (October 2026)

**Added**
- Service clients `lib/internal-client.ts` and `lib/services/{booking,worker,review,search}.ts`.
- Worker **suspend** route (the button used to answer 404), worker moderation through worker-service.
- Settings page with **Pricing** (customer fee, worker commission, multipliers) read by booking-service.
- **Admin-user management**: API routes and page (create, role, activate / deactivate, sign out everywhere, reset MFA).
- UUID guard for ids in middleware; `/waitlist`, `/settings`, `/settings/admins` route permissions.
- Migration runner (`npm run migrate`, `admin_migrations`); migration 016.
- `get_user_kpis()`, canonical `get_needs_attention()` with stuck in-progress jobs.
- Booking proof (arrival, start, completion) on the booking location tab.
- Vitest tests; `npm test`.
- Export audit for users, workers, bookings; `worker.documents_viewed` audit.

**Changed**
- Booking cancel / override / reassign / escalate and dispute resolve are calls to booking-service (reassign keeps the same booking; COD "refund %" is a fee waiver).
- Worker verify / reject / ban / suspend / unsuspend / force-offline go through worker-service; rejection codes now match worker-service.
- Review moderation goes through review-service.
- Broadcasts and test sends go through the gateway side door (notification-service).
- Dashboard revenue, chart and revenue by city use completion time in Karachi like Finance.
- `logAdminAction` never turns a completed action into a 500.
- DB TLS can be verified (`DATABASE_CA_CERT`).
- Dev port 3100 (corrected to 3200 in v1.2.0); waitlist permissions match the nav; SUPPORT sees Workers in the nav.
- Worker earnings from completed bookings; blocked-workers uses the category join; user "reports" = disputes the user opened.

**Fixed**
- `admin_audit_log.resource_id` was `UUID` but category, service and pricing audits write slugs: those actions returned 500 after committing.
- Every new worker was blocked at approval ("No identity document") because the panel required `NATIONAL_ID` / `PASSPORT` while worker-service stores `CNIC_FRONT` / `CNIC_BACK`.
- KYC documents were returned as raw URLs.
- Outbox events written by admin actions were never published (payment never refunded disputes, worker slots stayed wrong).
- Review hides never changed ratings.
- Ban / suspend left stale `user:status:*` caches.
- Catalog edits did not invalidate worker-service caches.
- Users KPI endpoint failed on a fresh database (`get_user_kpis()` missing).
- Malformed ids returned 500.
- Broadcasts to all users timed out and left the campaign in `SENDING`; marketing opt-outs and quiet hours were ignored.

**Removed**
- Impersonation (endpoint answers 410), `lib/direct-broadcast-engine.ts`, `lib/firebase-admin.ts`, Firebase scripts, Supabase env keys, unused dependencies, `admin_event_outbox` writers.

### v1.0.0: First documented release (October 2026)
Authentication (password + mandatory TOTP, backup codes, trusted devices, rotating sessions), RBAC (4 roles), all modules, 15 migrations, 121 API routes, audit catalogue, Redis key map.

---

> **Questions?** #backend in Slack · **Bug?** GitHub issue under the admin panel repo.
> **Changing a shared table or a column the other services read?** Tell their owners first (sections 4.3 and 9.4).
> **Touching auth, sessions or RBAC?** Read sections 5, 6 and ADR-003 to ADR-006 first, then update this document in the same pull request.