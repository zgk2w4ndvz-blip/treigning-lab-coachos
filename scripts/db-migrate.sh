#!/usr/bin/env bash
# ============================================================================
# db-migrate.sh — lightweight migration ledger + drift check for Supabase.
#
# Prevents the "production schema lagged the repo" class of bug (e.g. a missing
# `bmr` column / `athlete_calendar_events` table) by tracking which migration
# files have actually been applied to the live database in a `schema_migrations`
# ledger, and refusing to deploy when the repo and database disagree.
#
# A "version" is the migration filename without the .sql suffix (e.g.
# `0006_schedule`). Filenames — not numeric prefixes — are the key, so the two
# distinct 0006_* migrations never collide.
#
# SUBCOMMANDS
#   check     (default) Compare repo migrations against the ledger. Prints the
#             applied / missing sets. Exits 1 if any are missing — use this as a
#             pre-deploy / CI gate.
#   apply     Run every migration not yet in the ledger, in filename order, each
#             inside a transaction that also records it in the ledger. Already-
#             applied migrations are skipped (never re-run — safe, non-destructive).
#   baseline  Record ALL current repo migrations as applied WITHOUT running them.
#             Use once to adopt the ledger on a database that is already migrated
#             (does not execute any DDL — purely marks the ledger).
#   status    Alias for check.
#
# CONNECTION
#   SUPABASE_DB_URL (postgresql://… session pooler, port 5432) — taken from the
#   environment or auto-loaded from .env.local, exactly like setup-supabase.sh.
#   Requires psql (brew install libpq && brew link --force libpq).
#
# EXAMPLES
#   bash scripts/db-migrate.sh check        # drift gate (run before every deploy)
#   bash scripts/db-migrate.sh apply        # apply only the missing migrations
#   bash scripts/db-migrate.sh baseline     # adopt the ledger on an already-migrated DB
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$ROOT/supabase/migrations"
CMD="${1:-check}"

# ---- Connection string (same resolution as setup-supabase.sh) --------------
if [[ -z "${SUPABASE_DB_URL:-}" && -f "$ROOT/.env.local" ]]; then
  line="$(grep -E '^SUPABASE_DB_URL=' "$ROOT/.env.local" | head -1 || true)"
  SUPABASE_DB_URL="$(printf '%s' "$line" | cut -d= -f2- | tr -d '"')"
fi
if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "✗ SUPABASE_DB_URL is not set (env or .env.local)." >&2
  echo "  Supabase dashboard → Project Settings → Database → Connection string (session pooler)." >&2
  exit 1
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "✗ psql is required (brew install libpq && brew link --force libpq)." >&2
  exit 1
fi

psql_q() { psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -At -c "$1"; }

# ---- Ledger bootstrap (idempotent, non-destructive) ------------------------
ensure_ledger() {
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -c "
    set client_min_messages = warning;
    create table if not exists schema_migrations (
      version     text primary key,
      applied_at  timestamptz not null default now()
    );" >/dev/null
}

# ---- Repo / ledger version lists -------------------------------------------
repo_versions() {
  shopt -s nullglob
  local files=("$MIGRATIONS_DIR"/*.sql) out=()
  for f in "${files[@]}"; do out+=("$(basename "$f" .sql)"); done
  printf '%s\n' "${out[@]}" | sort
}
applied_versions() { psql_q "select version from schema_migrations order by version;"; }

# ---------------------------------------------------------------------------
case "$CMD" in
  check|status)
    ensure_ledger
    repo="$(repo_versions)"
    applied="$(applied_versions || true)"
    missing="$(comm -23 <(printf '%s\n' "$repo") <(printf '%s\n' "$applied"))"
    extra="$(comm -13 <(printf '%s\n' "$repo") <(printf '%s\n' "$applied"))"

    echo "▶ Repo migrations:"; printf '  %s\n' $repo
    echo "▶ Applied in production:"; [[ -n "$applied" ]] && printf '  %s\n' $applied || echo "  (none)"
    if [[ -n "$extra" ]]; then
      echo "⚠ In ledger but NOT in repo (investigate):"; printf '  %s\n' $extra
    fi
    if [[ -n "$missing" ]]; then
      echo "✗ MISSING from production (run: bash scripts/db-migrate.sh apply):"
      printf '  %s\n' $missing
      exit 1
    fi
    echo "✓ Production is up to date with the repo migrations."
    ;;

  apply)
    ensure_ledger
    applied="$(applied_versions || true)"
    missing="$(comm -23 <(repo_versions) <(printf '%s\n' "$applied"))"
    if [[ -z "$missing" ]]; then echo "✓ Nothing to apply — already up to date."; exit 0; fi
    echo "▶ Applying missing migrations:"; printf '  %s\n' $missing
    for v in $missing; do
      echo "  → $v.sql"
      # One transaction: the migration DDL *and* its ledger record commit together.
      psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction \
        -f "$MIGRATIONS_DIR/$v.sql" \
        -c "insert into schema_migrations (version) values ('$v') on conflict do nothing;"
    done
    psql "$SUPABASE_DB_URL" -c "notify pgrst, 'reload schema';" >/dev/null
    echo "✓ Applied. PostgREST schema cache reloaded."
    ;;

  baseline)
    ensure_ledger
    echo "▶ Marking all repo migrations as applied (no DDL executed):"
    for v in $(repo_versions); do
      psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q \
        -c "insert into schema_migrations (version) values ('$v') on conflict do nothing;" >/dev/null
      echo "  • $v"
    done
    echo "✓ Ledger baselined. Run 'check' to confirm."
    ;;

  *)
    echo "Usage: bash scripts/db-migrate.sh [check|apply|baseline|status]" >&2
    exit 2
    ;;
esac
