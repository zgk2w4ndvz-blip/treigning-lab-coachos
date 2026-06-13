# Treigning Lab CoachOS — Project Handoff

Coaching command center for athlete performance, nutrition, recovery,
competition prep, weight-cut management, and client management.

**Status:** Feature-complete MVP running against mock/local data in dev-bypass
mode; Supabase + Clerk wiring is built and ready but not yet connected to live
credentials. `npm run build` passes (32 routes).

Last updated: 2026-06-11

---

## 1. Current Architecture

**Stack**
- **Next.js 15.5** (App Router, RSC + Server Actions) · **React 19** · **TypeScript 5**
- **Tailwind CSS v4** + **shadcn/ui** (Radix variant — components import from the unified `radix-ui` package)
- **Supabase** (`@supabase/supabase-js` + `@supabase/ssr`) — Postgres + RLS
- **Clerk** (`@clerk/nextjs` v7) — auth/identity
- **TanStack React Query v5** — client cache/devtools provider
- **Recharts v3** — charts · **Zod v4** — validation · **date-fns v4** — dates · **lucide-react** — icons
- Node 20+ (developed on Node 26)

**App shell & routing**
- Route groups: `app/(auth)` (Clerk sign-in/up), `app/(coach)` (coach portal, gated), `app/(client)` (athlete portal — stub `/today`).
- `app/(coach)/layout.tsx` enforces `requireCoach()` and renders the sidebar (`config/nav.ts`) + topbar (alert bell).
- `middleware.ts` runs Clerk middleware and protects everything except `/`, `/sign-in`, `/sign-up`, `/api/webhooks`. **In dev bypass it is a no-op.**

**Auth model**
- Clerk owns identity; a webhook (`app/api/webhooks/clerk/route.ts`) mirrors users into the `profiles` table.
- `lib/auth.ts` exposes `getCurrentProfile()` / `requireCoach()` / `requireClient()`.
- **Dev auth bypass** (`lib/dev.ts`, `DEV_AUTH_BYPASS`): when `NEXT_PUBLIC_DEV_AUTH_BYPASS=true` **and** `NODE_ENV !== production`, the guards return a stand-in coach and the data layer serves mock/local data — no Clerk/Supabase needed. Hard-disabled in production builds.

**Data access pattern (important)**
- Three Supabase clients in `lib/supabase/`: `server.ts` (RSC, user-scoped via Clerk JWT), `client.ts` (browser hook), `admin.ts` (service-role, webhooks only — bypasses RLS).
- Every `lib/data/*.ts` reader branches on `DEV_AUTH_BYPASS`:
  - **real** → queries Supabase (RLS-scoped)
  - **bypass** → serves mock fixtures (`lib/mock/*`) or the local imported roster.
- **Client storage abstraction:** `lib/data/client-repo.ts` is the single CRUD boundary for clients — Supabase `clients` table in real mode, the local JSON roster store (`lib/dev-roster-store.ts` → `.dev-data/roster.json`) in bypass.
- Mutations are **Server Actions** in `lib/actions/*`.

**Alert engine**
- `lib/alerts/engine.ts` (pure) + `lib/alerts/rules-config.ts` evaluate each athlete's recent data across all modules and produce alerts. `lib/data/alerts.ts` gathers data per athlete and runs the engine; results feed the dashboard, `/alerts`, the agenda priority, and per-module inline alerts. Alerts are **computed live**, not persisted.

**Key directories**
```
app/(coach)/…           Coach portal pages
components/ui/           shadcn primitives
components/{coach,combat,wrestling,competitions,charts,forms,shared}/
lib/data/               Read layer (bypass-aware)
lib/actions/            Server Actions (mutations)
lib/mock/               Deterministic mock fixtures + generators
lib/alerts/             Alert engine + rule config
lib/combat/             Cut protocols + readiness scoring
lib/wrestling/          Weight-cut projection math
lib/import/             CSV parser
lib/dev-roster-store.ts Local roster persistence for bypass
supabase/migrations/    SQL schema + RLS
types/                  database.ts (DB types) + models.ts (app models)
```

---

## 2. Completed Features

**Foundation & auth**
- Next 15 + Tailwind v4 + shadcn scaffold; Clerk provider, React Query provider, Sonner toasts.
- Clerk middleware + user→profiles sync webhook; coach/client guards.
- Dev auth bypass end-to-end.

**Client management**
- Roster list (`/clients`) with search/filter, compliance bars, alert counts.
- 360° client overview + per-domain tabs.
- Add / edit / **delete** clients; **roster management page** (`/clients/manage`).
- **CSV import** (`/settings/import`) — paste or upload, live preview, format docs, sample CSV.
- Unified Supabase/local client repository; imported roster replaces demo data app-wide.

**Athlete tracking pages** (each: chart, trends, 0–100 compliance, log form, 7/30/90-day range selector)
- Weight (trend + goal line), Nutrition (calories vs target + macros), Hydration (vs target), Supplements (adherence), Recovery (sleep/energy/soreness/stress), Training (session volume/completion).

**Combat Sports module**
- Weight cuts, weigh-in timeline, auto-generated water-load / hydration-restoration / post-weigh-in fueling protocols, competition readiness score (gauge), per-client Combat tab + coach board (`/combat`).

**Wrestling Command Center** (`/wrestling`)
- Projected weigh-in weight, weekly/daily loss targets, cut-risk classification, pace tracking; dashboard buckets (on/off pace, high-risk, weigh-ins ≤14d, comps ≤30d).

**Competition module** (`/competitions` + per-client tab)
- Unified event board (cuts + competitions) with prep checklists, hydration restoration, and post-weigh-in fueling reminders.

**Daily Agenda** (`/agenda`)
- Per-athlete: training, calorie/protein/water targets, supplement protocol, recovery goal, competition prep, coach reminders, **priority status, readiness, compliance, open alerts**; filters (All / Red / Yellow / Competition / Missed check-ins / Weight cut).

**Coach ops**
- Dashboard (KPIs + tasks + alert feed + combat watch + upcoming comps).
- Tasks (`/tasks`) — all task types, filters, overdue/today/week buckets, **create new tasks (New Task dialog) and mark-complete, both persisted** (local store in bypass, `tasks` table in real mode).
- Calendar (`/calendar`) — month/week views, 6 color-coded event types, click-for-details.
- Settings (`/settings`) — coach/business profile, notifications, default nutrition/hydration/supplement targets, alert thresholds, weight-cut defaults, dev-mode status. **Saving now persists** (local store in bypass, `coach_settings` upsert in real mode).
- Alerts (`/alerts`) — live engine output across the roster.

**Athlete (client) portal** — mobile-first self-serve app at `app/(client)` (gated by `requireClient`; bottom-tab shell).
- Today (`/today`) — daily completion ring + 0–100 **completion score**, per-domain checklist, **coach-notes** card, and inline entry for **weight, hydration (running total w/ quick-add), nutrition (vs targets), supplements (per-item checklist), recovery (sleep/soreness/energy/stress)**.
- Progress (`/progress`) — overall compliance, logging streak, weight-trend chart (goal ref line), per-area compliance bars, and a last-7-days completion sparkline.
- Persistence: every entry writes through a Server Action — local `.dev-data/athlete-logs.json` in bypass, the existing log tables (`weight_logs`/`hydration_logs`/`nutrition_logs`/`recovery_logs`/`supplement_logs`) in real mode. In bypass the demo "logs in" as athlete `c-jordan` (`requireClient` returns a stand-in client profile).

**Quality:** `tsc`, `eslint`, and `next build` all pass.

---

## 3. Remaining / Not-Yet-Built Features

- **Connect live Supabase + Clerk** — wiring exists; needs real credentials, applied migrations, Clerk↔Supabase third-party auth, and a real test pass. Mutations are currently blocked or local-only in bypass.
- **Client (athlete) portal** — built (Today + Progress, see §2). Remaining: per-day history/edit beyond today, push reminders, and a real client invite/claim → `profile_id` link so a real athlete resolves to their `clients` row (today it falls back to "no athlete linked" when unlinked).
- **Messaging / communications** — `message_threads`/`messages`/`communications` tables exist; the per-client **Messages tab is a stub** and Realtime isn't wired.
- **Alert persistence + notifications** — alerts are computed live; no `alerts`-table writes, no email/SMS/push delivery (notification prefs are UI-only).
- **CSV import → related records in real mode** — import currently writes core `clients` columns only; it does not yet also create `weight_goals` / `competitions` / `weight_logs` rows.
- **Real-mode combat/wrestling/competitions** depend on `weight_cuts` data that has no creation UI yet beyond the per-client cut form; no bulk seeding for real mode.
- **Multi-coach orgs / admin role**, **client invite/claim flow** (tables exist, UI doesn't), **file uploads** (progress photos / meal pics via Supabase Storage), **PWA/offline**, **tests** (no unit/E2E suite), **observability/rate-limiting**.

---

## 4. Database Schema

Postgres via Supabase. Migrations in `supabase/migrations/` (run in order):

- **`0001_init.sql`** — enums + core tables:
  - `profiles`, `coach_settings`, `clients`, `client_invites`
  - `weight_goals`, `weight_logs`
  - `nutrition_plans`, `nutrition_logs`
  - `hydration_logs`
  - `supplements`, `supplement_logs`
  - `recovery_logs`
  - `training_programs`, `training_sessions`, `exercises`
  - `competitions`, `competition_tasks`
  - `message_threads`, `messages`, `communications`
  - `tasks`, `alert_rules`, `alerts`
  - `updated_at` triggers.
- **`0002_rls.sql`** — Row Level Security on every table. Identity resolved from the Clerk JWT (`auth.jwt() ->> 'sub'`) via `clerk_user_id()` / `current_profile_id()`; ownership via `owns_client()` (coach or linked client) and `is_client_coach()` (coach write guard).
- **`0003_combat_sports.sql`** — `weight_classes` (catalog), `weight_cuts`, `weigh_ins` + combat enums + RLS + seeded weight-class catalog + combat alert rules.
- **`0004_client_roster_fields.sql`** — adds `current_weight`, `goal_weight`, `next_competition`, `competition_date` to `clients` (CSV-import fields).

**Seeds**
- `supabase/seed.sql` — global default alert rules.
- `supabase/seed_demo.sql` — demo coach + athletes (edit the `clerk_id` placeholder first). Optional.

**Type sources**
- `types/database.ts` — hand-authored `Database` type mirroring the schema (regenerate later with `supabase gen types`).
- `types/models.ts` — app-facing models + view aggregates.

`clients` core columns: `id, coach_id, profile_id, first_name, last_name, email, phone, date_of_birth, gender, sport, discipline, current_weight_class, goal_summary, status, start_date, avatar_url, emergency_contact, notes, current_weight, goal_weight, next_competition, competition_date, created_at, updated_at`.

---

## 5. Environment Variables

Copy `.env.local.example` → `.env.local`.

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | prod | Clerk frontend key |
| `CLERK_SECRET_KEY` | prod | Clerk server key |
| `CLERK_WEBHOOK_SIGNING_SECRET` | prod | Verify the user-sync webhook (svix) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `SIGN_UP_URL` | optional | Default `/sign-in`, `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` / `SIGN_UP_...` | optional | Post-auth redirect (`/dashboard`) |
| `NEXT_PUBLIC_SUPABASE_URL` | prod | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod | Supabase anon key (RLS-scoped) |
| `SUPABASE_SERVICE_ROLE_KEY` | prod | Service role — webhooks/cron only, **server-only** |
| `NEXT_PUBLIC_DEV_AUTH_BYPASS` | dev | `true` to bypass auth + serve mock/local data. **Never true in prod.** |

**Local dev quick start:** set `NEXT_PUBLIC_DEV_AUTH_BYPASS=true` and the other keys can stay as dummy placeholders.

---

## 6. Deployment Instructions

**Local development (no credentials)**
```bash
npm install
cp .env.local.example .env.local   # set NEXT_PUBLIC_DEV_AUTH_BYPASS=true
npm run dev                          # http://localhost:3000
```

**Production (Vercel recommended)**
1. **Supabase:** create a project; run `supabase/migrations/0001`→`0004` in order (SQL editor or `supabase db push`); optionally run `seed.sql`.
2. **Clerk ↔ Supabase:** add Clerk as a Supabase third-party auth provider so the Clerk session token satisfies RLS (`auth.jwt() ->> 'sub'`).
3. **Clerk webhook:** point `https://<app>/api/webhooks/clerk` at events `user.created`, `user.updated`, `user.deleted`; set `CLERK_WEBHOOK_SIGNING_SECRET`.
4. **Env:** add all prod vars in the host; set **`NEXT_PUBLIC_DEV_AUTH_BYPASS=false`** (or omit).
5. **Build & deploy:**
   ```bash
   npm run build && npm start    # or push to Vercel
   ```
6. Sign up (creates a coach `profiles` row), then add/import clients.

**Verify before shipping:** `npx tsc --noEmit` · `npx eslint .` · `npm run build`.

---

## 7. Known Bugs / Limitations

- **Mutations don't persist in dev bypass** (by design) except client CRUD/CSV (`.dev-data/roster.json`), **coach settings (`.dev-data/settings.json`), task create/complete (`.dev-data/tasks.json`), and athlete daily logs (`.dev-data/athlete-logs.json`)**. The coach-side per-athlete log forms (under `/clients/[id]/*`) remain local/optimistic only in bypass.
- **Real Supabase path is largely unexercised** — schema, queries, and RLS are written but have not been run against a live project; expect minor fixes on first connect (esp. Clerk↔Supabase token config).
- **`alerts` table is unused** — alerts are computed at request time, so the topbar/`/alerts` recompute on every load (fine at small roster sizes; could be slow at scale — see next steps).
- **CSV import in real mode** stores only the core client fields; current/goal weight and competition don't yet create related rows, so charts/competitions stay empty until logged.
- **Hand-written `Database` type** can drift from SQL — regenerate after schema changes.
- **Messages tab and client portal are stubs.**
- **No automated tests.**
- Webpack cache warnings in dev logs are benign (stale `.next` cache).

---

## 8. Recommended Next Steps

1. **Connect a real Supabase + Clerk project** and run the migrations; do a full real-mode pass of client CRUD, then logging. This is the highest-leverage step (unblocks everything below).
2. **Persist alerts** (write engine output to the `alerts` table via a `pg_cron`/Edge Function or on-write triggers) so the bell/feed don't recompute live. (Settings and task create/complete now persist — see §2.)
3. **Wire log-form Server Actions in real mode** (weight/nutrition/hydration/recovery/training/supplements already exist — verify against live DB) and add a cut-creation flow that populates combat/wrestling for real data.
4. **Extend CSV import (real mode)** to also create `weight_goals`, `competitions`, and an initial `weight_log` per row.
5. **Athlete (client) portal** — built (Today + Progress, see §2). Next: verify its Server Actions against a live DB, add day-history/edit, and wire the invite/claim → `profile_id` link (step 9) so real athletes resolve to their `clients` row.
6. **Messaging** — implement the Messages tab with Supabase Realtime.
7. **Notifications** — deliver alerts via email/SMS using the existing notification prefs.
8. **Regenerate `types/database.ts`** from the live schema and add **tests** (Vitest for `lib/*` pure logic — alert engine, projection, compliance, CSV parser; Playwright for key flows).
9. **Client invite/claim flow** + multi-coach org/admin support; **Supabase Storage** for photos.
