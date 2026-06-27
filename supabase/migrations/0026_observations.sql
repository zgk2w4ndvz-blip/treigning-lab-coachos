-- ============================================================================
-- 0026_observations.sql — L2 Spine: canonical Observation Store (P1a, SCHEMA ONLY)
--
-- Introduces the append-only `observations` table — the future canonical record
-- of coach-approved athlete data (see ARCHITECTURE_L2_SPINE.md). This migration
-- is SCHEMA-ONLY and SIDE-EFFECT-FREE:
--   • no data is written, no backfill runs;
--   • no existing table is altered or touched;
--   • no runtime code reads or writes `observations` yet.
-- Dual-write into this table lands later (P1b) behind the OBS_DUAL_WRITE flag
-- (default off); reads stay dark until P4. The table simply sits empty after this.
--
-- Additive and backwards-compatible. Coach-scoped RLS mirrors the rest of the
-- schema using the helpers from 0002_rls.sql (current_profile_id / owns_client /
-- is_client_coach).
--
-- `domain` and `metric` are TEXT validated in APPLICATION code against the Metric
-- Registry (lib/observations/registry.ts) — deliberately NOT a DB enum, so adding
-- a metric never requires a migration (RFC §2.3, D-decision). A lightweight
-- snake_case CHECK guards format only. `created_by_type` and `ingested_via` are
-- small, stable, closed sets, so a CHECK list is appropriate for them.
-- ============================================================================

create table if not exists observations (
  id                  uuid primary key default gen_random_uuid(),
  coach_id            uuid not null references profiles(id) on delete cascade,
  client_id           uuid not null references clients(id)  on delete cascade,

  -- ---- registry-governed identity (TEXT + format CHECK; validated in commit.ts)
  domain              text not null,
  metric              text not null,

  -- ---- value: exactly one kind per the registry; at least one non-null --------
  value_num           numeric,
  value_text          text,
  value_json          jsonb,
  unit                text not null,

  -- ---- time semantics: pertains-to vs canonical-commit vs row-insert ----------
  observed_at         timestamptz not null,
  committed_at        timestamptz not null default now(),

  -- ---- provenance triad (channel / actor-class / which-human) -----------------
  source              text not null,                         -- connector id / message source
  ingested_via        text not null,                         -- message|connector|manual|coach_entry
  created_by_type     text not null,                         -- coach|connector|athlete|system|migration
  created_by          uuid references profiles(id) on delete set null,

  -- ---- idempotency key (per-metric; see RFC §5) -------------------------------
  source_ref          text,

  -- ---- [D3] bundle linkage (metrics captured together share one group id) -----
  reading_group_id    uuid,

  -- ---- L1 provenance: nullable FK, SET NULL so deleting a suggestion never
  --      erases a canonical observation (no cycle: suggested_actions has no FK
  --      back to observations) -------------------------------------------------
  suggested_action_id uuid references suggested_actions(id) on delete set null,

  -- ---- append-only correction chain (RESERVED; unused in P1) ------------------
  supersedes_id       uuid references observations(id) on delete set null,
  superseded_by_id    uuid references observations(id) on delete set null,

  confidence          numeric(4,3) not null default 1.0,
  sensitive           boolean not null default false,

  created_at          timestamptz not null default now(),

  -- ---- value / format / vocabulary guards -------------------------------------
  constraint observations_value_present
    check (num_nonnulls(value_num, value_text, value_json) >= 1),
  constraint observations_metric_format
    check (metric ~ '^[a-z][a-z0-9_]*$'),
  constraint observations_domain_format
    check (domain ~ '^[a-z][a-z0-9_]*$'),
  constraint observations_ingested_via_valid
    check (ingested_via in ('message', 'connector', 'manual', 'coach_entry')),
  constraint observations_created_by_type_valid
    check (created_by_type in ('coach', 'connector', 'athlete', 'system', 'migration')),
  constraint observations_confidence_range
    check (confidence >= 0 and confidence <= 1)
);

-- ---- indexes ----------------------------------------------------------------

-- Idempotency: one row per (coach, source, source_ref). source_ref is per-metric
-- (e.g. '<recoverySourceKey>:<metric>'), so each metric in a reading group is a
-- distinct row. Manual entries (source_ref NULL) are unconstrained — NULLs are
-- distinct in a unique index — exactly like manual recovery_logs today.
create unique index if not exists observations_idem_uq
  on observations (coach_id, source, source_ref) where source_ref is not null;

-- Time-series / current-value reads (used from P4 onward).
create index if not exists observations_client_metric_idx
  on observations (client_id, metric, observed_at desc);

-- Bundle fetch [D3]: "show me the whole scan/import".
create index if not exists observations_group_idx
  on observations (reading_group_id) where reading_group_id is not null;

-- "Live" value filter once supersession is active (current = not superseded).
create index if not exists observations_live_idx
  on observations (client_id, metric) where superseded_by_id is null;

-- Coach-scoped recent listing.
create index if not exists observations_coach_committed_idx
  on observations (coach_id, committed_at desc);

-- ---- RLS --------------------------------------------------------------------
-- Coach-scoped, mirroring prescriptions (0007). Reads stay dark in P1 (no app
-- reader), but the FINAL read policy ships now to avoid a later RLS migration.
alter table observations enable row level security;

-- Read: the owning coach OR the linked athlete (future portal).
create policy observations_read on observations for select
  using (owns_client(client_id));

-- Write: only the owning coach. The approval gate runs as the coach via the RLS
-- client, so the P1b dual-write satisfies this. The service-role/bridge path
-- never writes observations (it only creates pending suggestions upstream).
create policy observations_write on observations for all
  using (is_client_coach(client_id))
  with check (is_client_coach(client_id));
