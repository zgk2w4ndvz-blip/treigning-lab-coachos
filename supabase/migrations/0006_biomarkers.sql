-- ============================================================================
-- Biomarker readings — the "labs" vertical.
--
-- A flexible key/value store for heterogeneous athlete biomarkers that don't
-- fit the fixed weight_logs body-composition columns: recovery (HRV, resting
-- HR), performance (VO2max), and blood work (ferritin, vitamin D, testosterone,
-- …). One row per marker per measurement. Numeric values land in value_num;
-- anything non-numeric is preserved in value_text.
--
-- RLS mirrors the other per-client tables (read by coach or linked client,
-- write by the owning coach) using the helpers from 0002_rls.sql.
-- ============================================================================

create table if not exists biomarker_readings (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  logged_by   uuid references profiles(id) on delete set null,
  marker      text not null,            -- normalized key, e.g. 'hrv', 'ferritin'
  label       text,                     -- human label, e.g. 'HRV', 'Ferritin'
  value_num   numeric,                  -- numeric value when parseable
  value_text  text,                     -- raw/textual value fallback
  unit        text,                     -- e.g. 'ms', 'ng/mL'
  category    text,                     -- 'recovery' | 'performance' | 'blood' | 'other'
  measured_at timestamptz not null default now(),
  source      text,                     -- provenance, e.g. 'treigning-import'
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists biomarker_readings_client_idx
  on biomarker_readings (client_id, marker, measured_at desc);

alter table biomarker_readings enable row level security;

create policy biomarker_readings_read on biomarker_readings
  for select using (owns_client(client_id));
create policy biomarker_readings_insert on biomarker_readings
  for insert with check (owns_client(client_id));
create policy biomarker_readings_modify on biomarker_readings
  for update using (is_client_coach(client_id));
create policy biomarker_readings_delete on biomarker_readings
  for delete using (is_client_coach(client_id));
