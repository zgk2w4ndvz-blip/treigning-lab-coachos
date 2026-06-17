-- ============================================================================
-- 0017_body_measurements.sql
--
-- Anthropometric circumference measurements, one row per measuring session
-- (historical log, like weight_logs). All site columns are inches and nullable
-- so a partial session (e.g. waist + hips only) never breaks. Derived ratios —
-- Hip/Waist (hips ÷ waist) and Waist/Height (waist ÷ height) — are computed in
-- the data layer / UI, not stored. height_in is captured per-row so the
-- Waist/Height ratio is self-contained (clients has no height column).
--
-- RLS mirrors the other per-client tables (coach/linked-athlete read, coach
-- write). Many rows per client — insert to append, update/delete by id.
-- ============================================================================

create table if not exists body_measurements (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  logged_by    uuid references profiles(id) on delete set null,
  measured_at  timestamptz not null default now(),
  waist_in     numeric(5,2),
  hips_in      numeric(5,2),
  chest_in     numeric(5,2),
  shoulder_in  numeric(5,2),
  thigh_in     numeric(5,2),
  calves_in    numeric(5,2),
  wrist_in     numeric(5,2),
  ankle_in     numeric(5,2),
  neck_in      numeric(5,2),
  bicep_in     numeric(5,2),
  height_in    numeric(5,2),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index body_measurements_client_time_idx
  on body_measurements (client_id, measured_at desc);

alter table body_measurements enable row level security;

create policy body_measurements_read on body_measurements
  for select using (owns_client(client_id));
create policy body_measurements_write on body_measurements
  for all using (is_client_coach(client_id))
  with check (is_client_coach(client_id));

create trigger body_measurements_set_updated_at
  before update on body_measurements
  for each row execute function set_updated_at();
