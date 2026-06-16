-- ============================================================================
-- 0009_calendar_occurrence_overrides.sql
--
-- Phase 0 (category cleanup):
--   * add a first-class `labs` calendar category (previously folded into
--     `testing`). `weigh_in` is relabelled to "Body Composition" in the UI
--     layer only — the stored enum value stays `weigh_in` (renaming an enum
--     value in place is unsafe; the label lives in lib/calendar/categories.ts).
--
-- Phase 1 (per-occurrence completion):
--   * add a `missed` calendar status.
--   * add `athlete_calendar_event_overrides` — one row per *diverging*
--     occurrence of a (usually recurring) event. The parent recurring event is
--     never expanded into individual rows; an override only exists when a
--     specific occurrence's status/notes differ from the series default.
--     Effective status = override.status (if a row exists) else event.status.
--
-- All changes are additive / non-destructive. RLS mirrors the parent calendar
-- table: read by the owning coach or linked athlete, write by the coach.
-- ============================================================================

-- New enum values (no-ops if a prior run already added them). Not used within
-- this migration, so adding them in the same transaction is safe on PG12+.
alter type calendar_category add value if not exists 'labs';
alter type calendar_status   add value if not exists 'missed';

create table if not exists athlete_calendar_event_overrides (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references athlete_calendar_events(id) on delete cascade,
  occurrence_date date not null,
  status          calendar_status not null default 'planned',
  completed_at    timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (event_id, occurrence_date)
);
create index if not exists calendar_override_event_idx
  on athlete_calendar_event_overrides (event_id, occurrence_date);

alter table athlete_calendar_event_overrides enable row level security;

-- Read: coach who owns the parent event's client, or the linked athlete.
create policy calendar_override_read on athlete_calendar_event_overrides
  for select using (
    exists (
      select 1 from athlete_calendar_events e
      where e.id = athlete_calendar_event_overrides.event_id
        and owns_client(e.client_id)
    )
  );

-- Write: only the owning coach.
create policy calendar_override_write on athlete_calendar_event_overrides
  for all using (
    exists (
      select 1 from athlete_calendar_events e
      where e.id = athlete_calendar_event_overrides.event_id
        and is_client_coach(e.client_id)
    )
  ) with check (
    exists (
      select 1 from athlete_calendar_events e
      where e.id = athlete_calendar_event_overrides.event_id
        and is_client_coach(e.client_id)
    )
  );

create trigger calendar_override_set_updated_at
  before update on athlete_calendar_event_overrides
  for each row execute function set_updated_at();
