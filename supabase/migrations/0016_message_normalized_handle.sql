-- ============================================================================
-- 0016_message_normalized_handle.sql
--
-- Store the canonical (normalized) sender handle on each ingested message for
-- auditability of athlete matching — the exact value matching was performed on,
-- alongside the raw sender_phone/sender_email. Additive / non-destructive.
-- ============================================================================

alter table message_ingest
  add column if not exists normalized_handle text;
