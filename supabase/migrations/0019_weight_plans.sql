-- ============================================================================
-- 0019_weight_plans.sql  — Phase 1B: Weight Planning Engine
--
-- A per-athlete weight plan (current → goal over a date range, optionally tied
-- to a competition) plus its materialized weekly projection.
--
--   weight_plans         — the plan inputs. One active plan per athlete (older
--                          plans kept with is_active=false for history).
--   weight_plan_targets  — the weekly projection generated from the plan
--                          (regenerated on save): per-week target weight +
--                          calorie / protein targets. client_id is denormalized
--                          so RLS uses the same owns_client / is_client_coach
--                          helpers as every other per-client table.
--
-- Derived values shown in the UI (pounds remaining, weeks remaining, lb/week,
-- daily calorie deficit) are NOT stored — they are computed in lib/metrics.
-- RLS mirrors the other per-client tables. All additive / non-destructive.
-- ============================================================================

create table if not exists weight_plans (
  id                 uuid primary key default gen_random_uuid(),
  coach_id           uuid not null references profiles(id) on delete cascade,
  client_id          uuid not null references clients(id) on delete cascade,
  current_weight     numeric(6,2) not null,
  goal_weight        numeric(6,2) not null,
  competition_weight numeric(6,2),
  start_date         date not null,
  target_date        date not null,
  competition_id     uuid references competitions(id) on delete set null,
  is_active          boolean not null default true,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index weight_plans_client_idx on weight_plans (client_id, is_active);

create table if not exists weight_plan_targets (
  id                  uuid primary key default gen_random_uuid(),
  plan_id             uuid not null references weight_plans(id) on delete cascade,
  client_id           uuid not null references clients(id) on delete cascade,
  week_index          integer not null,
  week_start          date not null,
  target_weight       numeric(6,2) not null,
  calorie_target      integer,
  protein_target_g    integer,
  potassium_target_mg integer,
  created_at          timestamptz not null default now(),
  unique (plan_id, week_index)
);
create index weight_plan_targets_plan_idx on weight_plan_targets (plan_id, week_index);

alter table weight_plans        enable row level security;
alter table weight_plan_targets enable row level security;

create policy weight_plans_read on weight_plans
  for select using (owns_client(client_id));
create policy weight_plans_write on weight_plans
  for all using (is_client_coach(client_id))
  with check (is_client_coach(client_id));

create policy weight_plan_targets_read on weight_plan_targets
  for select using (owns_client(client_id));
create policy weight_plan_targets_write on weight_plan_targets
  for all using (is_client_coach(client_id))
  with check (is_client_coach(client_id));

create trigger weight_plans_set_updated_at
  before update on weight_plans
  for each row execute function set_updated_at();
