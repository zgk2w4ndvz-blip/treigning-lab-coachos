-- ============================================================================
-- 0025_recovery_log_source.sql — let recovery_logs hold connector-imported
-- metrics + provenance, so approving a `recovery_import` suggestion (PR #24)
-- writes one recovery_logs row.
--
-- Additive and backwards-compatible. Existing/manual recovery_logs are
-- untouched: every new column is nullable, and the idempotency index treats
-- NULL source_ref rows (manual logs) as distinct, so they're never constrained.
-- ============================================================================

alter table recovery_logs
  add column if not exists recovery_score numeric,
  add column if not exists hydration      numeric,
  add column if not exists source         text,          -- e.g. 'treigninglab'
  add column if not exists measured_at     timestamptz,  -- provider timestamp
  add column if not exists source_ref      text,         -- stable per-(connector,athlete,day) key
  add column if not exists raw            jsonb;         -- preserved import details

-- Idempotency: one connector-imported row per (client, source_ref). Manual logs
-- have source_ref = NULL → not constrained (NULLs are distinct in a unique idx).
create unique index if not exists recovery_logs_source_ref_key
  on recovery_logs (client_id, source_ref);
