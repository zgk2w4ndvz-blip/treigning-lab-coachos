-- ============================================================================
-- Athlete planning calendar.
--
-- A per-athlete programming calendar spanning training, recovery, nutrition,
-- supplementation, AltoLab, testing, weigh-ins, competitions, check-ins, and
-- coach notes. One row per planned item, with optional simple recurrence
-- (daily/weekly) expanded at read time. Supabase-backed (no local store).
--
-- RLS mirrors the other per-client tables (read by coach or linked athlete,
-- write by the owning coach) using the helpers from 0002_rls.sql.
-- ============================================================================

create type calendar_category as enum (
  'strength', 'conditioning', 'sport', 'low_base', 'supplementation', 'altolab',
  'nutrition', 'hydration', 'recovery', 'testing', 'weigh_in', 'competition',
  'check_in', 'note'
);
create type calendar_status     as enum ('planned', 'completed', 'skipped');
create type calendar_recurrence as enum ('none', 'daily', 'weekly');

create table athlete_calendar_events (
  id              uuid primary key default gen_random_uuid(),
  coach_id        uuid not null references profiles(id) on delete cascade,
  client_id       uuid not null references clients(id) on delete cascade,
  category        calendar_category not null,
  title           text not null,
  description     text,
  starts_at       timestamptz not null,
  ends_at         timestamptz,
  all_day         boolean not null default true,
  status          calendar_status not null default 'planned',
  recurrence      calendar_recurrence not null default 'none',
  recurrence_until date,
  prescription_id uuid references prescriptions(id) on delete set null,
  details         jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index athlete_calendar_client_idx
  on athlete_calendar_events (client_id, starts_at);

alter table athlete_calendar_events enable row level security;

create policy athlete_calendar_read on athlete_calendar_events
  for select using (owns_client(client_id));
create policy athlete_calendar_write on athlete_calendar_events
  for all using (is_client_coach(client_id))
  with check (is_client_coach(client_id));
