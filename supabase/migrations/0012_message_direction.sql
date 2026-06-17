-- ============================================================================
-- 0012_message_direction.sql
--
-- Conversation context: message_ingest can now hold OUTBOUND coach messages in
-- addition to inbound athlete messages, so future analysis has both sides of the
-- thread. A direction column distinguishes them.
--
--   incoming — from the athlete (the only direction that produces suggestions)
--   outgoing — from the coach (stored as context only; never analyzed/suggested)
--
-- Existing rows default to 'incoming' (they were all inbound). Additive /
-- non-destructive.
-- ============================================================================

create type message_direction as enum ('incoming', 'outgoing');

alter table message_ingest
  add column if not exists direction message_direction not null default 'incoming';
