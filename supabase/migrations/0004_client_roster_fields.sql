-- ============================================================================
-- Roster import fields on clients.
-- Stores the CSV-import values directly on the client record so the roster
-- round-trips through add/edit/import without extra tables.
-- ============================================================================

alter table clients
  add column if not exists current_weight   numeric(6,2),
  add column if not exists goal_weight       numeric(6,2),
  add column if not exists next_competition  text,
  add column if not exists competition_date  date;
