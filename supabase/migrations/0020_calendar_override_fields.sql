-- ============================================================================
-- 0020_calendar_override_fields.sql  — Phase 5A: recurrence edit scopes
--
-- Extends athlete_calendar_event_overrides so a single occurrence can diverge in
-- its FIELDS (not just status) and can be cancelled (EXDATE). This powers the
-- "This occurrence only" edit/delete scope; "This and future" is handled by a
-- series split on athlete_calendar_events (recurrence_until + a new row) and
-- needs NO schema change. Recurrence is a SERIES property, so recurrence /
-- recurrence_until are deliberately NOT added here.
--
-- All columns are nullable (null = inherit from the base event) except
-- is_cancelled which defaults false — so existing status-only override rows are
-- unchanged. Additive / non-destructive. No backfill. No changes to existing
-- rows or to athlete_calendar_events.
-- ============================================================================

alter table athlete_calendar_event_overrides
  add column if not exists is_cancelled boolean not null default false,
  add column if not exists title        text,
  add column if not exists description  text,
  add column if not exists category     calendar_category,
  add column if not exists starts_at    timestamptz,
  add column if not exists ends_at      timestamptz,
  add column if not exists all_day      boolean;

-- No new index: overrides are fetched by event_id (already indexed); is_cancelled
-- is filtered in-memory during expansion. RLS is unchanged (row-level via the
-- parent event; new columns are covered automatically).
