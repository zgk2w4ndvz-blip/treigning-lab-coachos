-- ============================================================================
-- 0013_low_base_prescriptions.sql
--
-- Standalone Low Base aerobic prescription, one active row per athlete:
--   mep_bpm              — Metabolic Efficiency Point (bpm)
--   frequency_per_week   — sessions / week
--   minutes_per_session  — minutes / session
-- The Low Base range (MEP ± 10) and weekly total (frequency × minutes) are
-- derived in the UI, not stored. Prescription-style (not a workout log).
--
-- RLS mirrors the other per-client tables (coach/linked-athlete read, coach
-- write). One prescription per client (unique client_id) — upsert to update.
-- ============================================================================

create table if not exists low_base_prescriptions (
  id                  uuid primary key default gen_random_uuid(),
  coach_id            uuid not null references profiles(id) on delete cascade,
  client_id           uuid not null references clients(id) on delete cascade,
  mep_bpm             integer not null,
  frequency_per_week  integer not null,
  minutes_per_session integer not null,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (client_id)
);
create index low_base_prescriptions_client_idx on low_base_prescriptions (client_id);

alter table low_base_prescriptions enable row level security;

create policy low_base_read on low_base_prescriptions
  for select using (owns_client(client_id));
create policy low_base_write on low_base_prescriptions
  for all using (is_client_coach(client_id))
  with check (is_client_coach(client_id));

create trigger low_base_set_updated_at
  before update on low_base_prescriptions
  for each row execute function set_updated_at();
