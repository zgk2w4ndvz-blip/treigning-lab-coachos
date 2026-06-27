-- ============================================================================
-- 0024_recovery_sync.sql — generic external recovery-sync framework.
--
-- Additive and backwards-compatible. Synced recovery data becomes PENDING
-- suggested_actions (coach approval, then the existing recovery_logs on
-- approve) — NEVER auto-written. These tables provide: connector enable/disable
-- + cursor, deterministic external→athlete mapping, and per-(connector, athlete,
-- day) idempotency so re-syncs never create duplicate recovery suggestions.
-- No athlete biometric values live here; recovery_logs is unchanged and reused.
-- ============================================================================

-- Which connectors are enabled per coach, with a cursor + free-form config.
create table if not exists sync_connectors (
  coach_id     uuid not null references profiles(id) on delete cascade,
  connector    text not null,                 -- 'treigninglab' | 'whoop' | ...
  enabled      boolean not null default false, -- opt-in; off until configured
  last_run_at  timestamptz,
  last_cursor  text,                           -- e.g. max sample date synced
  config       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (coach_id, connector)
);

-- Deterministic external→internal athlete map (established auto-matches +
-- manual overrides). One external id maps to exactly one client → no duplicates.
create table if not exists external_athlete_map (
  coach_id    uuid not null references profiles(id) on delete cascade,
  connector   text not null,
  external_id text not null,
  client_id   uuid not null references clients(id) on delete cascade,
  manual      boolean not null default false,  -- true = coach-set override
  created_at  timestamptz not null default now(),
  primary key (coach_id, connector, external_id)
);
create index if not exists external_athlete_map_client_idx
  on external_athlete_map (client_id);

-- Idempotency + incremental cursor: one row per synced (connector, external
-- athlete, day). Re-syncing the same athlete-day is a no-op.
create table if not exists recovery_sync_state (
  coach_id            uuid not null references profiles(id) on delete cascade,
  connector           text not null,
  external_athlete_id text not null,
  sample_date         date not null,
  client_id           uuid references clients(id) on delete set null,
  suggested_action_id uuid references suggested_actions(id) on delete set null,
  matched             boolean not null default false,
  created_at          timestamptz not null default now(),
  primary key (coach_id, connector, external_athlete_id, sample_date)
);
create index if not exists recovery_sync_state_cursor_idx
  on recovery_sync_state (coach_id, connector, sample_date);

alter table sync_connectors        enable row level security;
alter table external_athlete_map   enable row level security;
alter table recovery_sync_state    enable row level security;

-- Coach owns their rows; the service-role client (bridge/cron) bypasses RLS.
create policy sync_connectors_owner on sync_connectors
  for all using (coach_id = current_profile_id())
  with check (coach_id = current_profile_id());
create policy external_athlete_map_owner on external_athlete_map
  for all using (coach_id = current_profile_id())
  with check (coach_id = current_profile_id());
create policy recovery_sync_state_owner on recovery_sync_state
  for all using (coach_id = current_profile_id())
  with check (coach_id = current_profile_id());
