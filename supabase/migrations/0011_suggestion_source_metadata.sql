-- ============================================================================
-- 0011_suggestion_source_metadata.sql
--
-- Denormalize the originating message's provenance onto every suggested_action
-- so a suggestion carries where it came from without a join:
--   • source_message_id — the PROVIDER message id (e.g. an iMessage GUID,
--     Gmail id). Distinct from message_id (the internal message_ingest FK).
--   • source_timestamp  — when the athlete sent the message.
--   • source_handle     — the sender's phone or email.
--
-- These are provenance only; they never cause an automatic write. Suggestions
-- remain 'pending' until a coach approves them.
--
-- Additive / non-destructive.
-- ============================================================================

alter table suggested_actions
  add column if not exists source_message_id text,
  add column if not exists source_timestamp  timestamptz,
  add column if not exists source_handle     text;
