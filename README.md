# Treigning Lab CoachOS

Coaching command center for athlete performance, nutrition, recovery,
competition prep, and client management.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind · shadcn/ui ·
Supabase · Recharts · React Query · Zod · Clerk

---

## Getting started

### 1. Install

```bash
npm install
```

### 2. Configure environment

Copy the example and fill in real keys:

```bash
cp .env.local.example .env.local
```

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Clerk dashboard → API Keys |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Clerk dashboard → Webhooks → your endpoint |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (keep server-only) |

### 3. Set up the database

Run the migrations against your Supabase project (SQL editor or CLI):

```
supabase/migrations/0001_init.sql            # tables, enums, indexes, triggers
supabase/migrations/0002_rls.sql             # row level security policies
supabase/migrations/0003_combat_sports.sql   # combat module + weight-class catalog
supabase/seed.sql                            # default alert rules
supabase/seed_demo.sql                       # demo athletes incl. an MMA cut (optional)
```

### 4. Wire Clerk ↔ Supabase

- **Clerk as a Supabase third-party auth provider** so the Clerk session
  token is accepted by Supabase and RLS can read `auth.jwt() ->> 'sub'`.
  (Supabase → Authentication → Third-party Auth → add Clerk.)
- **Clerk webhook** → `https://<your-app>/api/webhooks/clerk` subscribed to
  `user.created`, `user.updated`, `user.deleted`. This syncs Clerk users into
  the `profiles` table.

### 5. Run

```bash
npm run dev
```

---

## Architecture

- **Auth** — Clerk owns identity/sessions. A webhook mirrors users into
  `profiles`. `lib/auth.ts` exposes `requireCoach()` / `requireClient()` guards.
- **Authorization** — Postgres **RLS** on every table. A coach can only ever
  read their own clients; a linked client can read/log their own data. See
  `supabase/migrations/0002_rls.sql`.
- **Data access** — `lib/supabase/server.ts` (RSC, user-scoped),
  `lib/supabase/client.ts` (browser hook), `lib/supabase/admin.ts`
  (service role — webhooks/cron only, bypasses RLS).
- **Mutations** — Server Actions in `lib/actions/*` (added per phase).
- **Client state** — React Query; keys centralized in `lib/queries/keys.ts`.

## Combat Sports module

A first-class vertical for weight-class athletes (MMA, boxing, BJJ, wrestling,
muay thai, etc.):

- **Weight cuts** — walk-around → camp → target weigh-in, linked to a
  competition and a weight-class catalog (`weight_classes`).
- **Weigh-in timeline** — scheduled + recorded check-ins and the official
  weigh-in, with made-weight tracking (`weigh_ins`).
- **Auto-generated protocols** — water-load taper, post-weigh-in **hydration
  restoration**, and **refueling**, derived from the rehydration window
  (`lib/combat/protocols.ts`).
- **Competition readiness score** — a weighted 0–100 composite (weight pace,
  cut safety, hydration, recovery, training) shown as a gauge + risk flags.
- **Surfaced platform-wide** — coach sidebar (`/combat` board), a per-client
  `Combat` tab, a dashboard "Active cuts" KPI + watch widget, and combat alert
  rules.

## Project structure

Key folders: `app/(coach)`, `app/(client)`, `app/(auth)`,
`components/`, `lib/`, `types/`, `supabase/`, `config/`.

## Verify

```bash
npx tsc --noEmit   # types
npx eslint .       # lint
npm run build      # production build
```
