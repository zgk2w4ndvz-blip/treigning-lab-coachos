-- ============================================================================
-- 0021_low_base_scheduling.sql  — Low Base prescription becomes the source of
-- truth for recurring Low Base calendar events.
--
-- Adds the per-week schedule + date window to low_base_prescriptions so the
-- prescription drives a deterministic set of weekly athlete_calendar_events
-- (one event per day-slot, category low_base, tagged in details.source =
-- 'low_base_schedule' + details.low_base_prescription_id). The calendar's
-- prescription_id column is left null (it FK-references the separate
-- `prescriptions` table), so linkage lives in details. NO changes to the
-- calendar tables: details already exists on athlete_calendar_events, and the
-- "future split" used by the reconciler reuses the existing recurrence_until
-- mechanism — so completed history is never rewritten.
--
-- Additive / non-destructive: existing rows get schedule = '[]' and null dates;
-- frequency_per_week / minutes_per_session / mep_bpm are unchanged. No backfill.
-- RLS is unchanged (new columns are covered by the existing row policies).
-- ============================================================================

alter table low_base_prescriptions
  add column if not exists start_date date,
  add column if not exists end_date   date,
  add column if not exists schedule   jsonb not null default '[]'::jsonb;

-- 0–7 weekly slots (each slot is { "day_of_week": 0-6, "time": "HH:MM" }).
alter table low_base_prescriptions
  drop constraint if exists low_base_schedule_len;
alter table low_base_prescriptions
  add constraint low_base_schedule_len
  check (jsonb_typeof(schedule) = 'array' and jsonb_array_length(schedule) between 0 and 7);
