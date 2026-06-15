# Treigning Lab → CoachOS importer

A safe, one-time migration tool to export **your own** athlete roster + biometric
data from your authorized Treigning Lab account and load it into your CoachOS
Supabase project — deduped, with a dry run first and no destructive writes.

It runs **outside** the Next app (excluded from lint/build) and is invoked with
`tsx`. No credentials are ever read or stored: you log in manually in a real
browser window, and the only secret used is your Supabase service-role key from
`.env.local`.

## Pipeline

```
scrape.ts   → raw-backup/   (Playwright; manual login; captures JSON + DOM)
transform.ts→ out/          (maps raw → CoachOS rows + CSV; row counts)
upsert.ts   → Supabase      (DRY RUN by default; --apply to write; deduped)
```

Maps onto the existing schema: roster fields → `clients`; the six body-comp
metrics (weight, body fat %, fat mass, skeletal muscle mass, total body water,
BMR) → `weight_logs`. Other biomarkers (HRV, VO2max, blood work, …) have **no
destination table yet** — they're preserved in `out/unmapped-biomarkers.json`
for the future labs vertical, not imported.

## One-time setup

```bash
npm install                       # picks up the playwright devDependency
npx playwright install chromium   # one-time browser download
```

## Required env (in `.env.local` — never commit real values)

| Var | Purpose |
|---|---|
| `TREIGNING_TEAM_URL` | Your athlete-list URL (the `/teams/team/…/athletes/athlete-list` page) |
| `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`) | Supabase project URL (already set) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (already set) — used only by `upsert.ts` |
| `COACH_ID` | The `profiles.id` that should own the imported clients. Get it via SQL: `select id, clerk_id from profiles;` |
| `TREIGNING_USER_DATA_DIR` | *(optional)* persistent browser profile dir (default `.session/`, gitignored) |
| `IMPORT_MAX_ATHLETES` | *(optional)* cap athletes visited — great for a first test run |
| `IMPORT_DELAY_MS` | *(optional)* delay between athlete pages (default 1500ms, be polite) |

## Run it

```bash
# 1. Scrape (opens a browser — log in, then press Enter in the terminal).
#    Start small to validate, e.g. IMPORT_MAX_ATHLETES=3
npx tsx tools/treigning-import/scrape.ts

# 2. Calibrate (one time): open raw-backup/athletes.json + network-responses.json.
#    If fields didn't map, adjust FIELD_CANDIDATES / SCRAPE in config.ts.

# 3. Transform → review out/coachos-clients.csv and the printed counts.
npx tsx tools/treigning-import/transform.ts
#    (try it now on the sample, no scrape needed:)
npx tsx tools/treigning-import/transform.ts tools/treigning-import/sample/athletes.sample.json

# 4. Dry-run the DB plan (no writes) — shows inserts/updates/snapshots.
npx tsx tools/treigning-import/upsert.ts

# 5. Apply only after you're happy with the plan.
npx tsx tools/treigning-import/upsert.ts --apply
```

## Safety properties

- **No stored credentials** — manual login in a persistent browser session.
- **Read-only scrape** — only navigates (GET); never posts to Treigning Lab.
- **Raw backup** — everything captured is saved to `raw-backup/` before any transform.
- **Dry run by default** — `upsert.ts` writes nothing without `--apply` and prints
  the full plan (+ `out/plan.json`) first.
- **Dedupe** — match by `coach_id`+email, else `coach_id`+normalized name; matches
  update in place. Body-comp snapshots are tagged so re-runs refresh, not pile up.
- **Non-destructive** — the tool never deletes. Schema changes (if ever needed)
  would be proposed as migrations for your review, not run ad hoc.

> Use of this tool against Treigning Lab is your own data export from an account
> you're authorized to use; make sure it's consistent with their terms of service.
