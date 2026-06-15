# Connecting CoachOS to a live Supabase project

The Supabase-backed client storage is already built — every reader/writer in
`lib/data/*` branches on `DEV_AUTH_BYPASS` and uses Supabase in real mode (see
`lib/data/client-repo.ts`, the single CRUD boundary for clients). This guide
takes you from "running on mock data in bypass" to "running on real Supabase
client records," and ends with a CRUD smoke-test checklist.

You only need to do this once per environment.

---

## What you'll end up with

- The `clients` table (+ all other tables) live in your Supabase project.
- Row Level Security so a coach only ever sees their own clients.
- The app reading/writing real rows instead of `.dev-data/*.json`.
- Add / edit / delete / CSV-import all persisting to Postgres.
- **No seeded fake athletes** — in real mode the mock fixtures are never
  served; the roster is exactly what's in your `clients` table.

---

## Prerequisites

- A Supabase account → a new (empty) project.
- A Clerk account → an application (the app uses Clerk for identity).
- To run the setup script you need **`psql`**:
  `brew install libpq && brew link --force libpq`.
  Don't want to install it? Use the zero-tooling fallback (Step 4c) — paste the
  migrations into the Supabase SQL editor.

---

## Step 1 — Create the Supabase project

Supabase dashboard → **New project**. Pick a region near you and save the
database password — you'll need it for the connection string.

## Step 2 — Collect keys

| Where | Value | Goes into |
|---|---|---|
| Project Settings → API → Project URL | `https://xxxx.supabase.co` | `NEXT_PUBLIC_SUPABASE_URL` |
| Project Settings → API → `anon` `public` | `eyJ…` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Project Settings → API → `service_role` `secret` | `eyJ…` | `SUPABASE_SERVICE_ROLE_KEY` |
| Project Settings → Database → Connection string → **Session pooler** | `postgresql://postgres.[REF]:[PW]@aws-0-[region].pooler.supabase.com:5432/postgres` | `SUPABASE_DB_URL` |

> Use the **Session pooler** string (port 5432) for migrations — it's
> IPv4-friendly from a laptop. The "Direct connection" is often IPv6-only and
> will fail to connect on home networks. Avoid the Transaction pooler (6543) for
> DDL.

From Clerk: Publishable key, Secret key, and (later) a webhook signing secret.

## Step 3 — Fill `.env.local`

```bash
cp .env.local.example .env.local   # if you don't have one yet
```

Set the Supabase + Clerk values, add `SUPABASE_DB_URL`, and **leave
`NEXT_PUBLIC_DEV_AUTH_BYPASS=false` for now** (you'll keep bypass off to use the
real DB; flip it back to `true` anytime to return to mock mode).

> `SUPABASE_DB_URL` is used **only** by the setup script — the app never reads
> it.

## Step 4 — Apply the schema

### 4a. With the script (recommended)

```bash
npm run setup:supabase          # migrations 0001→0004 + seed.sql (alert rules)
# or, to also load demo athletes (edit the clerk_id in seed_demo.sql first):
npm run setup:supabase:demo
```

The script applies `supabase/migrations/*.sql` in order, then `seed.sql`, using
`psql` (install it first: `brew install libpq && brew link --force libpq`).

### 4b. Regenerate types (optional, reference only)

```bash
npm run db:types   # writes types/database.generated.ts
```

Diff it against the hand-authored `types/database.ts`. **Do not overwrite**
`types/database.ts` — it carries custom helpers (`Table<>`, `Tables`,
`InsertDto`, enum aliases) the app imports.

### 4c. Zero-tooling fallback

No `psql` and don't want `npx`? In the Supabase **SQL editor**, paste and run
each file in this exact order:

```
supabase/migrations/0001_init.sql
supabase/migrations/0002_rls.sql
supabase/migrations/0003_combat_sports.sql
supabase/migrations/0004_client_roster_fields.sql
supabase/migrations/0005_body_composition.sql
supabase/migrations/0006_biomarkers.sql
supabase/seed.sql
```

## Step 5 — Wire Clerk → Supabase auth

RLS resolves identity from the Clerk JWT (`auth.jwt() ->> 'sub'`). Register
Clerk as a third-party auth provider:

Supabase → **Authentication → Sign In / Up → Third Party Auth → Add Clerk**,
and follow the prompts (paste your Clerk domain). No JWT template needed — the
app forwards the Clerk session token via the `accessToken` option in
`lib/supabase/server.ts`.

## Step 6 — Clerk user-sync webhook

So sign-ups create a `profiles` row:

1. Clerk → **Webhooks → Add endpoint** → `https://<your-app>/api/webhooks/clerk`
   (for local testing, expose it with `ngrok http 3000`).
2. Subscribe to `user.created`, `user.updated`, `user.deleted`.
3. Copy the signing secret into `CLERK_WEBHOOK_SIGNING_SECRET`.

## Step 7 — Run it

```bash
npm run dev
```

Sign up in the app → this creates your coach `profiles` row → you land on the
dashboard with an **empty** roster (no fakes). Now add clients (Step 8).

---

## CRUD smoke-test checklist

Run through this once against the live DB to confirm real storage works. After
each write, refresh and check the row in Supabase → **Table editor → clients**.

- [ ] **Add** — `/clients/new`, fill the form, save → redirects to
      `/clients/manage`; a new `clients` row exists with your `coach_id`.
- [ ] **List** — `/clients` and `/clients/manage` show the new athlete (and
      nothing seeded).
- [ ] **Edit** — `/clients/[id]/edit`, change weight/notes, save → the row
      updates in Postgres.
- [ ] **CSV import** — `/settings/import`, paste a few rows, **Import** →
      multiple `clients` rows inserted; `/clients` reflects them.
- [ ] **Delete** — `/clients/manage` → delete one → row removed (and its
      logs/competitions cascade per the FK rules).
- [ ] **Cross-page propagation** — the imported/added athletes appear on
      Dashboard, `/agenda`, `/tasks`, `/calendar`, `/competitions`.
- [ ] **RLS isolation** (optional) — sign up a second coach in another browser;
      confirm they see **none** of the first coach's clients.

---

## Reverting to mock mode

Set `NEXT_PUBLIC_DEV_AUTH_BYPASS=true` in `.env.local` and restart. The app
serves in-memory mock data again and never touches Supabase — handy for UI work
without credentials.

## Troubleshooting

- **`relation "clients" already exists`** — migrations were partially applied.
  Use a fresh project, or drop the public schema and re-run.
- **Empty roster after sign-up** — expected; you have no clients yet. Add or
  import some.
- **Rows insert but don't show / permission denied** — the Clerk↔Supabase
  third-party auth (Step 5) isn't configured, so RLS can't resolve your
  profile. Re-check that the session token reaches Supabase.
- **`profiles` row never created** — the Clerk webhook (Step 6) isn't reaching
  your app; verify the endpoint URL and signing secret.
