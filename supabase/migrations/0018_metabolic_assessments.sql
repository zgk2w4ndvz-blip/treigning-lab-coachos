-- ============================================================================
-- 0018_metabolic_assessments.sql
--
-- Metabolic / cardiopulmonary exercise testing (CPET-style). Two tables:
--
--   metabolic_assessments   — one row per test session (historical log, like
--                             body_measurements). Scalar results: VO2 max, MEP
--                             (Metabolic Efficiency Point, bpm), aerobic
--                             threshold (bpm), max HR (bpm). All nullable so a
--                             partial test never breaks.
--   metabolic_curve_points  — the measured curve for a session: one row per
--                             stage/load, carrying heart rate, ventilation (VE)
--                             and VO2. Powers the Heart-Rate and Ventilation
--                             curves. client_id is denormalized so RLS uses the
--                             same owns_client / is_client_coach helpers as
--                             every other per-client table (no subquery policy).
--
-- The MEP from an assessment is pushable into low_base_prescriptions via the
-- "Push MEP to Low Base" action (Low Base is an OUTPUT of metabolic testing).
-- ============================================================================

create table if not exists metabolic_assessments (
  id                    uuid primary key default gen_random_uuid(),
  client_id             uuid not null references clients(id) on delete cascade,
  logged_by             uuid references profiles(id) on delete set null,
  assessed_at           timestamptz not null default now(),
  vo2_max               numeric(5,2),
  mep_bpm               numeric(5,2),
  aerobic_threshold_bpm numeric(5,2),
  max_hr_bpm            integer,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index metabolic_assessments_client_time_idx
  on metabolic_assessments (client_id, assessed_at desc);

create table if not exists metabolic_curve_points (
  id                uuid primary key default gen_random_uuid(),
  assessment_id     uuid not null references metabolic_assessments(id) on delete cascade,
  client_id         uuid not null references clients(id) on delete cascade,
  stage             integer not null,
  intensity         numeric(6,2),
  heart_rate_bpm    numeric(5,2),
  ventilation_l_min numeric(6,2),
  vo2               numeric(6,2),
  created_at        timestamptz not null default now()
);
create index metabolic_curve_points_assessment_idx
  on metabolic_curve_points (assessment_id, stage);

alter table metabolic_assessments enable row level security;
alter table metabolic_curve_points enable row level security;

create policy metabolic_assessments_read on metabolic_assessments
  for select using (owns_client(client_id));
create policy metabolic_assessments_write on metabolic_assessments
  for all using (is_client_coach(client_id))
  with check (is_client_coach(client_id));

create policy metabolic_curve_points_read on metabolic_curve_points
  for select using (owns_client(client_id));
create policy metabolic_curve_points_write on metabolic_curve_points
  for all using (is_client_coach(client_id))
  with check (is_client_coach(client_id));

create trigger metabolic_assessments_set_updated_at
  before update on metabolic_assessments
  for each row execute function set_updated_at();
