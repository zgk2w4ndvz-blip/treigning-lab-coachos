#!/usr/bin/env bash
# ============================================================================
# setup-supabase.sh — apply the CoachOS schema to a live Supabase project.
#
# Applies migrations 0001→0004 in order, then seed.sql (global alert rules),
# and optionally seed_demo.sql. Idempotent-ish: migrations use `if not exists`
# where practical, but re-running 0001 on a populated DB will error on existing
# objects — intended for a fresh project.
#
# USAGE
#   SUPABASE_DB_URL="postgresql://postgres:[PW]@db.[REF].supabase.co:5432/postgres" \
#     bash scripts/setup-supabase.sh [--demo] [--types]
#
#   --demo   also load supabase/seed_demo.sql (demo athletes; edit clerk_id first)
#   --types  regenerate types/database.generated.ts (reference only)
#
# The connection string comes from the Supabase dashboard:
#   Project Settings → Database → Connection string.
# Prefer the **Session pooler** (port 5432, IPv4-friendly) for applying
# migrations from a laptop; the direct connection is often IPv6-only.
# It can also live in .env.local as SUPABASE_DB_URL (auto-loaded below).
#
# Requires psql (brew install libpq && brew link --force libpq).
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$ROOT/supabase/migrations"
cd "$ROOT"

WITH_DEMO=false
WITH_TYPES=false
for arg in "$@"; do
  case "$arg" in
    --demo) WITH_DEMO=true ;;
    --types) WITH_TYPES=true ;;
    *) echo "Unknown flag: $arg" >&2; exit 2 ;;
  esac
done

# Load SUPABASE_DB_URL from .env.local if not already set. The `|| true` keeps a
# missing line from aborting the script under `set -euo pipefail`.
if [[ -z "${SUPABASE_DB_URL:-}" && -f "$ROOT/.env.local" ]]; then
  line="$(grep -E '^SUPABASE_DB_URL=' "$ROOT/.env.local" | head -1 || true)"
  SUPABASE_DB_URL="$(printf '%s' "$line" | cut -d= -f2- | tr -d '"')"
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  cat >&2 <<'MSG'
✗ SUPABASE_DB_URL is not set.

  Get it from: Supabase dashboard → Project Settings → Database →
  Connection string → URI (the direct connection, port 5432).

  Then either add it to .env.local:
    SUPABASE_DB_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"
  or pass it inline:
    SUPABASE_DB_URL="postgresql://..." bash scripts/setup-supabase.sh

  No psql installed and no DB URL? See SUPABASE_SETUP.md for the
  zero-tooling fallback (paste each migration into the SQL editor).
MSG
  exit 1
fi

# SQL runner: psql applies whole .sql files (DDL) reliably. The Supabase CLI has
# no "run this file against a remote URL" command, so psql is required here.
run_sql_file() {
  local file="$1"
  echo "  → applying $(basename "$file")"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -f "$file"
}

# --types is a standalone mode: regenerate types and exit, no schema changes.
if [[ "$WITH_TYPES" == true ]]; then
  echo "▶ Generating types/database.generated.ts (reference only)…"
  npx --yes supabase@latest gen types typescript --db-url "$SUPABASE_DB_URL" \
    > "$ROOT/types/database.generated.ts"
  echo "  Wrote types/database.generated.ts — diff against the hand-authored"
  echo "  types/database.ts; do NOT overwrite the latter (it has custom helpers)."
  exit 0
fi

if ! command -v psql >/dev/null 2>&1; then
  cat >&2 <<'MSG'
✗ psql is required to apply the migrations but isn't on your PATH.

  Install it (macOS / Homebrew):
    brew install libpq && brew link --force libpq

  …then re-run this script. No psql and don't want to install it? Use the
  zero-tooling fallback in SUPABASE_SETUP.md (paste each migration into the
  Supabase SQL editor in order).
MSG
  exit 1
fi

echo "▶ Applying migrations to Supabase…"
shopt -s nullglob
migrations=("$MIGRATIONS_DIR"/*.sql)
if [[ ${#migrations[@]} -eq 0 ]]; then
  echo "✗ No migrations found in $MIGRATIONS_DIR" >&2
  exit 1
fi
# Sort so 0001 → 0004 apply in order.
IFS=$'\n' migrations=($(sort <<<"${migrations[*]}")); unset IFS
for m in "${migrations[@]}"; do
  run_sql_file "$m"
done

echo "▶ Seeding global alert rules (seed.sql)…"
run_sql_file "$ROOT/supabase/seed.sql"

if [[ "$WITH_DEMO" == true ]]; then
  echo "▶ Loading demo athletes (seed_demo.sql)…"
  echo "  ⚠ Make sure you edited the clerk_id placeholder in seed_demo.sql first."
  run_sql_file "$ROOT/supabase/seed_demo.sql"
fi

cat <<'DONE'

✓ Schema applied.

Next:
  1. Fill Supabase + Clerk keys in .env.local (see .env.local.example).
  2. Register Clerk as a Supabase third-party auth provider
     (Supabase → Authentication → Sign In/Up → Third Party Auth → Clerk).
  3. Set NEXT_PUBLIC_DEV_AUTH_BYPASS=false in .env.local.
  4. npm run dev, sign up (creates your coach profile via the Clerk webhook),
     then add/import clients.

Full walkthrough + CRUD smoke-test checklist: SUPABASE_SETUP.md
DONE
