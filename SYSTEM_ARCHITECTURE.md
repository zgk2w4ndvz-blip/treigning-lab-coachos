# Treigning Lab CoachOS — System Architecture

Audience: a senior engineer joining the project. This document explains how the
system is wired — data model, auth, request/data flow, the Supabase layer, the
dev-bypass abstraction, and sequence diagrams for the core write paths.

Companion docs: `PROJECT_HANDOFF.md` (status/roadmap), `README.md` (setup).

---

## 1. High-level topology

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Browser (coach portal)                        │
│   Next.js 15 App Router · RSC · Tailwind/shadcn · React Query · Recharts│
└───────────────┬───────────────────────────────────┬───────────────────┘
                │ RSC render / Server Actions        │ (client hooks)
                ▼                                     ▼
┌───────────────────────────────────────┐   ┌────────────────────────────┐
│   Next.js server (Node runtime)        │   │  Clerk (hosted auth UI/JWT) │
│  • middleware.ts (Clerk route guard)   │◀──┤  • sessions, <UserButton/>  │
│  • Server Components (read via lib/data)│   └────────────────────────────┘
│  • Server Actions (write via lib/actions)│
│  • Route handler: /api/webhooks/clerk   │
└───────┬──────────────────────────┬──────┘
        │ Clerk JWT (sub)          │ service role (webhook only)
        ▼                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                              Supabase                                  │
│   Postgres + Row Level Security · (Storage/Realtime/Edge — future)     │
└─────────────────────────────────────────────────────────────────────┘

           ── OR, when NEXT_PUBLIC_DEV_AUTH_BYPASS=true (local dev) ──
   lib/data/* short-circuits Supabase and serves lib/mock/* + the local
   roster store (.dev-data/roster.json). Clerk is skipped entirely.
```

**Two runtime modes** — every data-layer function branches on `DEV_AUTH_BYPASS`:

| | Real mode (`false`/prod) | Dev bypass (`true`, dev only) |
|---|---|---|
| Identity | Clerk session → `profiles` | Stand-in mock coach |
| Reads | Supabase (RLS-scoped) | `lib/mock/*` + local roster store |
| Writes | Supabase | Local JSON store / optimistic UI |
| Gate | `NODE_ENV !== "production"` required for bypass | — |

---

## 2. Database ERD

```
                                  ┌───────────────┐
                                  │   profiles    │  (synced from Clerk)
                                  │ id (PK)       │
                                  │ clerk_id (UQ) │
                                  │ role          │
                                  └───────┬───────┘
                       coach_id           │ id           profile_id
        ┌──────────────────────────┬──────┴───────────────────┐
        ▼                          ▼                           ▼
┌───────────────┐         ┌─────────────────┐         (client login link,
│ coach_settings│         │     clients     │          nullable)
│ coach_id (FK) │         │ id (PK)         │
└───────────────┘         │ coach_id (FK)   │
                          │ profile_id (FK?)│
                          │ first/last_name │
                          │ sport, status   │
                          │ current_weight, │
                          │ goal_weight,    │
                          │ next_competition│
                          │ competition_date│
                          └───┬─────────────┘
                              │ client_id (ON DELETE CASCADE) — fans out to:
   ┌──────────────┬───────────┼─────────────┬──────────────┬───────────────┐
   ▼              ▼           ▼             ▼              ▼               ▼
weight_goals  weight_logs  nutrition_*  hydration_logs  recovery_logs  supplements
                           plans/logs                                  │
                                                                       ▼
                                                                supplement_logs
   ┌──────────────┬───────────────────────┬──────────────────────────┐
   ▼              ▼                       ▼                          ▼
training_programs  competitions        weight_cuts (combat)      message_threads
   │               │                    │                          │
   ▼               ▼                    ▼                          ▼
training_sessions  competition_tasks   weigh_ins                 messages
   │
   ▼
exercises

   Coach-scoped (client_id nullable or coach_id directly):
   tasks (coach_id, client_id?)   communications (coach_id, client_id)
   alert_rules (coach_id? — null = global)   alerts (coach_id, client_id)

   Reference / catalog:
   weight_classes (coach_id? — null = global)   client_invites (client_id)
```

Crow's-foot summary: `profiles 1──* clients`, `clients 1──* {all per-athlete
log/plan tables}`, `training_sessions 1──* exercises`, `competitions 1──*
competition_tasks`, `weight_cuts 1──* weigh_ins`, `message_threads 1──*
messages`.

---

## 3. Table relationships (FKs & cascade)

| Table | Key FKs | On delete |
|---|---|---|
| `profiles` | — (`clerk_id` unique) | — |
| `coach_settings` | `coach_id → profiles` | cascade |
| `clients` | `coach_id → profiles`, `profile_id → profiles` | coach: cascade; profile: set null |
| `weight_goals`, `weight_logs` | `client_id → clients`, `logged_by → profiles` | client: cascade; logged_by: set null |
| `nutrition_plans` | `client_id → clients`, `coach_id → profiles` | cascade |
| `nutrition_logs`, `hydration_logs`, `recovery_logs` | `client_id → clients`, `logged_by → profiles` | client: cascade |
| `supplements` | `client_id → clients`, `coach_id → profiles` | cascade |
| `supplement_logs` | `client_id → clients`, `supplement_id → supplements` | cascade |
| `training_programs` | `client_id → clients`, `coach_id → profiles` | cascade |
| `training_sessions` | `client_id → clients`, `program_id → training_programs` | client: cascade; program: set null |
| `exercises` | `session_id → training_sessions` | cascade |
| `competitions` | `client_id → clients`, `coach_id → profiles` | cascade |
| `competition_tasks` | `competition_id → competitions`, `assigned_to → profiles` | comp: cascade |
| `weight_classes` | `coach_id → profiles` (nullable = global) | cascade |
| `weight_cuts` | `client_id → clients`, `coach_id → profiles`, `competition_id → competitions`, `weight_class_id → weight_classes` | client/coach: cascade; others: set null |
| `weigh_ins` | `weight_cut_id → weight_cuts`, `client_id → clients` | cascade |
| `message_threads` | `coach_id → profiles`, `client_id → clients` | cascade |
| `messages` | `thread_id → message_threads`, `sender_id → profiles` | cascade |
| `communications`, `tasks`, `alerts` | `coach_id → profiles`, `client_id → clients?` | cascade |
| `alert_rules` | `coach_id → profiles` (nullable = global default) | cascade |
| `client_invites` | `client_id → clients` | cascade |

Deleting a `client` cascades to all of their performance data, cuts, weigh-ins,
threads, tasks, and alerts.

---

## 4. User roles & permissions

**Roles** (`profiles.role` enum): `coach` | `client` | `admin`.

**App-layer guards** (`lib/auth.ts`): `requireCoach()` (coach/admin or redirect),
`requireClient()`, `requireProfile()`. The `(coach)` route group calls
`requireCoach()` in its layout.

**Database-layer (RLS, `0002_rls.sql`)** — the real enforcement boundary. Identity
comes from the Clerk JWT:

```
clerk_user_id()      = current_setting('request.jwt.claims')::jsonb ->> 'sub'
current_profile_id() = profiles.id WHERE clerk_id = clerk_user_id()
owns_client(c)       = client's coach_id = me  OR  client's profile_id = me
is_client_coach(c)   = client's coach_id = me            (write guard)
```

Policy matrix (representative):

| Resource | Read | Write |
|---|---|---|
| `profiles` | self only | self update |
| `clients` | coach owns; linked client reads self | coach only |
| Per-athlete logs (weight/nutrition/hydration/recovery/supplement/weigh_ins) | `owns_client` | insert by `owns_client` (client may log); update/delete coach |
| Plans/programs/supplements/competitions/cuts | `owns_client` | `is_client_coach` |
| `exercises`, `competition_tasks` | via parent's client | via parent's client |
| `messages` | thread participants (coach or linked client) | participants; sender must be self |
| `tasks`, `communications`, `alerts` | coach only | coach only |
| `alert_rules` | global rows + own | own |
| `weight_classes` | global rows + own | own |

Net effect: **a coach can never read or mutate another coach's data**, even if
app code has a bug — RLS is the backstop. A linked client (future portal) can
read their own record and log their own daily entries.

---

## 5. Authentication flow

```
Sign-up/in (Clerk hosted UI at /sign-in, /sign-up)
        │
        ▼
Clerk issues session ──► Clerk webhook (svix-verified)
        │                   POST /api/webhooks/clerk
        │                   user.created/updated → admin client upserts profiles row
        │                   user.deleted → delete profiles row
        ▼
Request to a protected route
        │
        ▼
middleware.ts (clerkMiddleware) ── not public? → auth.protect()
        │  public = /, /sign-in, /sign-up, /api/webhooks
        ▼
Server Component renders
        │
        ▼
lib/auth.getCurrentProfile():
   auth().userId  ──►  createServerSupabase() forwards Clerk token (accessToken)
                       SELECT * FROM profiles WHERE clerk_id = userId
        │
        ▼
requireCoach() → role check → render, else redirect

Every subsequent Supabase query carries the Clerk JWT, so Postgres RLS scopes
rows to current_profile_id() automatically.
```

**Dev bypass:** `middleware.ts` is a no-op; `getCurrentProfile()` returns
`mockProfile`; no Clerk/Supabase calls occur. Gated to non-production builds.

---

## 6. Data flow between pages

```
                         ┌─────────────── lib/data/* (read, bypass-aware) ───────────────┐
Page (RSC, requireCoach) │ clients · dashboard · agenda · tasks · calendar · combat ·     │
   │  await get…()        │ wrestling · competitions · logs · alerts                       │
   ▼                     └───────────────┬───────────────────────────┬────────────────────┘
Server-rendered HTML                     │ real                      │ bypass
   │ + interactive client islands        ▼                           ▼
   ▼                            Supabase (RLS)            lib/mock/* + dev-roster-store
User action (form/click)
   │  Server Action (lib/actions/*)  ── parse Zod ─► repo/Supabase write ─► revalidatePath()
   ▼
Affected pages refetch on next render
```

Cross-page sharing:
- **Alert engine** (`lib/data/alerts.ts`) is consumed by the dashboard, `/alerts`,
  the agenda (priority/badges), and each athlete module (inline `ModuleAlerts`).
- **Client repo / roster** feeds Clients, Dashboard, Agenda, Tasks, Calendar,
  Competitions — so importing/adding a client updates all of them. In bypass a
  populated roster store replaces the seeded demo everywhere.
- **Combat board** (`listActiveCutsForBoard`) is reused by `/combat`, `/wrestling`,
  `/competitions`, and the dashboard "combat watch."
- React Query (`providers/query-provider.tsx`) backs client-side interactivity;
  most reads are RSC server fetches (no client round-trip).

---

## 7. Supabase architecture

- **Three clients** (`lib/supabase/`):
  - `server.ts` — RSC/Server-Action client; injects the Clerk session token via
    the `accessToken` option so RLS sees `auth.jwt() ->> 'sub'`. `persistSession:false`.
  - `client.ts` — `useSupabaseBrowser()` hook bound to the active Clerk session.
  - `admin.ts` — service-role client; **bypasses RLS**; used only in the Clerk
    webhook (and future cron). Never import into user-facing code paths.
- **Auth integration:** Clerk is registered as a Supabase *third-party auth
  provider*; the Clerk JWT is accepted directly (no JWT template needed).
- **Migrations** (`supabase/migrations/`, run in order): `0001_init` (tables,
  enums, indexes, triggers) → `0002_rls` (policies + helper fns) →
  `0003_combat_sports` (cuts/weigh-ins/weight-class catalog + combat alert rules)
  → `0004_client_roster_fields` (CSV columns on `clients`). Seeds: `seed.sql`
  (alert rules), `seed_demo.sql` (optional demo data).
- **Types:** `types/database.ts` is a hand-authored `Database` generic (Row /
  Insert / Update per table; nullable columns optional on insert). Regenerate
  with `supabase gen types typescript` after schema changes.
- **Not yet used:** Supabase Storage (photos), Realtime (messaging), Edge
  Functions / `pg_cron` (alert evaluation/persistence) — all anticipated.

---

## 8. File / folder structure

```
treigning-lab-coachos/
├── app/
│   ├── (auth)/{sign-in,sign-up}/        Clerk pages
│   ├── (client)/today/                  Athlete portal (stub)
│   ├── (coach)/
│   │   ├── layout.tsx                   requireCoach + sidebar/topbar
│   │   ├── dashboard, agenda, tasks,
│   │   │   calendar, alerts, combat,
│   │   │   wrestling, competitions, settings/{,import}
│   │   └── clients/
│   │       ├── page.tsx  new  manage
│   │       └── [clientId]/  (overview + edit + per-domain tabs +
│   │                         combat/{,new,edit})
│   ├── api/webhooks/clerk/route.ts      User→profiles sync (svix)
│   ├── layout.tsx                       ClerkProvider*/QueryProvider/Toaster
│   └── page.tsx                         Landing → role redirect
├── components/
│   ├── ui/                              shadcn primitives (Radix variant)
│   ├── charts/                          Recharts wrappers
│   ├── coach/ combat/ wrestling/
│   │   competitions/ forms/ shared/     Feature components
├── config/nav.ts                        Sidebar + client tab nav
├── lib/
│   ├── auth.ts  dev.ts                  Guards + bypass flag
│   ├── supabase/{server,client,admin}.ts
│   ├── data/                            Read layer (bypass-aware) — 11 modules
│   ├── actions/                         Server Actions (clients, logs, combat,
│   │                                    import-roster, types)
│   ├── mock/                            Deterministic fixtures + generators
│   ├── alerts/{engine,rules-config}.ts  Alert engine
│   ├── combat/protocols.ts              Cut protocols + readiness
│   ├── wrestling/projection.ts          Weight-cut projection math
│   ├── metrics/compliance.ts            Per-domain compliance scoring
│   ├── import/csv.ts                    CSV parser
│   ├── dev-roster-store.ts              Local roster persistence (bypass)
│   └── utils/{format,range}.ts
├── types/{database,models}.ts
├── supabase/{migrations,seed.sql,seed_demo.sql}
├── middleware.ts                        Clerk route protection (no-op in bypass)
└── .dev-data/roster.json                Local imported roster (gitignored)

*ClerkProvider is omitted in dev bypass.
```

---

## 9. Sequence diagrams

### 9.1 Client creation (add form OR CSV import)

```
Coach        RosterClientForm /     saveClientAction /      client-repo        Supabase / store
 │           ImportRosterClient     importRosterAction
 │  fill/submit  │                       │                      │                   │
 ├──────────────►│                       │                      │                   │
 │               │ Server Action (FormData / CSV text)          │                   │
 │               ├──────────────────────►│                      │                   │
 │               │            ensureCoach() (skipped in bypass) │                   │
 │               │            Zod parse (rosterClientSchema /   │                   │
 │               │                       parseRosterCsv)        │                   │
 │               │            invalid? ◄─ {fieldErrors}         │                   │
 │               │                       ├─ createRosterClient ►│                   │
 │               │                       │                      │ REAL: INSERT clients (RLS, coach_id)
 │               │                       │                      ├──────────────────►│
 │               │                       │                      │ BYPASS: addImportedAthlete()
 │               │                       │                      │   → .dev-data/roster.json
 │               │                       │  revalidatePath(/clients,/dashboard,…)   │
 │               │                       ├─ redirect(/clients/manage)               │
 │  ◄────────────┴───────────────────────┘                      │                   │
 │  Manage page re-renders from client-repo.listRosterClients() — demo data now hidden
```
Key: first real client (or import) **replaces the seeded demo roster app-wide**
because every reader resolves clients through the repo / roster store.

### 9.2 Task creation / completion

```
Coach        TasksBoard (client)       getCoachTasks (read)      store/Supabase
 │  open /tasks                            │                          │
 │  RSC fetch ─────────────────────────────►│ bypass: getBypassCoachTasks()
 │                                          │ real:   SELECT tasks + client names
 │  ◄── tasks grouped (overdue/today/week/completed) ───────────────  │
 │  toggle complete (checkbox)              │                          │
 ├─ optimistic local state update + toast   │                          │
 │   (bypass: not persisted; real: Server Action would UPDATE tasks)   │
 │
 │  Imported rosters also generate tasks: dev-roster-store.generateImportedTasks()
 │  derives per-athlete tasks (check-ins, comp logistics, weight-plan, notes)
 │  → surfaced in /tasks, the dashboard feed, and agenda "Coach reminders".
```
Note: a dedicated `createTaskAction` (persisting to the `tasks` table) is a
planned next step; today tasks are generated/seeded and completion is
optimistic in bypass.

### 9.3 Calendar events

```
Coach        CalendarView (client)     getCalendarEvents (read)     sources
 │  open /calendar                          │                          │
 │  RSC fetch ─────────────────────────────►│                          │
 │                                          │ bypass: getBypassCalendar()
 │                                          │   demo → mockCalendarEvents()
 │                                          │   imported → generateImportedCalendar(
 │                                          │       clients, competitions)
 │                                          │ real: aggregate in parallel:
 │                                          │   training_sessions + weigh_ins +
 │                                          │   competitions → map → CalendarEvent[]
 │  ◄── CalendarEvent[] (type, date, client, detail) ────────────────  │
 │  client-side: group by day; month/week view; color by 6 types
 │  click event → Dialog (when/duration/athlete/link)
```
`CalendarEvent` is a unified shape (`competition | weigh_in | check_in |
training | consultation | follow_up`) so heterogeneous sources render uniformly.

---

## 10. Conventions & gotchas for new engineers

- **Add a read?** Put it in `lib/data/*` and branch `DEV_AUTH_BYPASS` (real:
  Supabase; bypass: mock/store). Keep components dumb.
- **Add a write?** Server Action in `lib/actions/*`; Zod-validate `FormData`;
  go through `client-repo` (clients) or Supabase; `revalidatePath` the affected
  routes. Return `ActionState` (`lib/actions/types.ts`).
- **New table?** Migration + RLS policy (never ship a table without RLS) +
  update `types/database.ts` + (if it has nullable cols) the `Table<>` helper
  keeps inserts ergonomic.
- **shadcn is the Radix variant** — import primitives from `radix-ui`
  (`Slot.Root`), not `@radix-ui/react-*`.
- **Clerk v7** has no `<SignedIn>/<SignedOut>` — gate on the server.
- **`server-only`** modules (`lib/data/*`, `dev-roster-store`, supabase
  server/admin) must never be imported into client components.
- **Verify before shipping:** `npx tsc --noEmit && npx eslint . && npm run build`.
