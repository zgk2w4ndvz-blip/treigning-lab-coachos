-- ============================================================================
-- 0015_low_base_mep_nullable.sql
--
-- Coach prescriptions sent by iMessage (Phase 4B) can set the Low Base dose
-- (minutes/session + sessions/week) without specifying an MEP. Allow mep_bpm to
-- be null so a dose-only prescription can be created and the MEP filled in later
-- from the Low Base tab. Existing rows are unaffected. Non-destructive.
-- ============================================================================

alter table low_base_prescriptions
  alter column mep_bpm drop not null;
