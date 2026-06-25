-- ============================================================================
-- 0022_ai_usage.sql  — AI usage / cost ledger for the OpenAI integration.
--
-- Records one row per AI call (extraction, etc.) with token counts and an
-- estimated USD cost, so the AI wrapper can enforce a per-day spend cap and the
-- coach can audit spend. Written server-side only. Additive; no other tables
-- touched. The AI feature ships disabled (AI_ENABLED=false) and never writes
-- athlete data — this table only logs metadata about model calls.
-- ============================================================================

create table if not exists ai_usage (
  id                uuid primary key default gen_random_uuid(),
  coach_id          uuid references profiles(id) on delete cascade,
  task              text not null,           -- e.g. 'message_extraction'
  model             text not null,
  prompt_tokens     integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens      integer not null default 0,
  est_cost_usd      numeric(10,6) not null default 0,
  ok                boolean not null default true,
  created_at        timestamptz not null default now()
);

-- Per-day cap reads sum(est_cost_usd) for "today" per coach.
create index if not exists ai_usage_coach_created_idx on ai_usage (coach_id, created_at);

alter table ai_usage enable row level security;

-- Coach can read/insert their own usage rows. (The service-role client used by
-- system callers bypasses RLS; interactive coach context is scoped here.)
create policy ai_usage_owner on ai_usage
  for all using (coach_id = current_profile_id())
  with check (coach_id = current_profile_id());
