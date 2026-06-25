-- ============================================================================
-- 0023_ai_router.sql — AI Router: routing metadata on ai_usage + a content-hash
-- extraction cache.
--
-- Additive and backwards-compatible. The router (lib/ai/router.ts) sends only
-- complex/ambiguous messages to Claude and keeps simple, high-confidence ones on
-- the deterministic regex path. This migration lets ai_usage record the routing
-- decision (so the dashboard can report Claude% / regex% / avg confidence /
-- cache-hit rate / cost saved) and adds a cache so a re-ingested message is not
-- re-sent to Claude — no duplicate Claude call, no duplicate ai_usage charge,
-- and no duplicate suggested_actions.
--
-- No athlete records are written here; this is metadata + cached extraction
-- output only. Existing rows/inserts keep working (every new column is
-- nullable or defaulted).
-- ============================================================================

alter table ai_usage
  add column if not exists routed_to_regex  boolean not null default false,
  add column if not exists routed_to_claude boolean not null default false,
  add column if not exists cache_hit        boolean not null default false,
  add column if not exists confidence       numeric(4,3),
  add column if not exists reason_for_ai    text,
  add column if not exists message_hash     text;

create index if not exists ai_usage_message_hash_idx on ai_usage (message_hash);
create index if not exists ai_usage_routing_idx
  on ai_usage (created_at, routed_to_claude, cache_hit);

-- Per-(message, model) extraction cache. The message_hash is a deterministic
-- sha256 of client + timestamp + body; `model` is the route's model id (the
-- Claude model, or 'regex' for the deterministic path). Re-ingesting the same
-- message finds a hit and reuses the stored suggestions instead of recomputing.
create table if not exists ai_extraction_cache (
  message_hash text not null,
  model        text not null,
  coach_id     uuid references profiles(id) on delete cascade,
  suggestions  jsonb not null,
  created_at   timestamptz not null default now(),
  primary key (message_hash, model)
);

alter table ai_extraction_cache enable row level security;

-- Coach reads their own cached rows; the service-role client used by the bridge
-- and cron bypasses RLS (same pattern as ai_usage).
create policy ai_extraction_cache_owner on ai_extraction_cache
  for all using (coach_id = current_profile_id())
  with check (coach_id = current_profile_id());
