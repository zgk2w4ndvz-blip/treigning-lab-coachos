-- ============================================================================
-- Treigning Lab CoachOS — Combat Sports module
-- Weight classes, weight-cut planning, weigh-in timelines, rehydration &
-- post-weigh-in fueling protocols. Readiness is computed in the app layer.
-- ============================================================================

create type combat_discipline as enum (
  'mma', 'boxing', 'bjj', 'wrestling', 'judo', 'muay_thai', 'kickboxing', 'other'
);
create type weight_cut_status as enum (
  'planning', 'active', 'peak_week', 'weigh_in', 'completed', 'cancelled'
);
create type weigh_in_kind as enum ('check_in', 'official', 'unofficial');

-- ----------------------------------------------------------------------------
-- WEIGHT CLASS CATALOG (global reference rows have coach_id = null)
-- ----------------------------------------------------------------------------
create table weight_classes (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid references profiles(id) on delete cascade, -- null = global
  discipline  combat_discipline not null,
  federation  text,
  name        text not null,
  gender      text,
  limit_lbs   numeric(6,2) not null,
  limit_kg    numeric(6,2),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index weight_classes_discipline_idx on weight_classes (discipline, sort_order);
create index weight_classes_coach_idx on weight_classes (coach_id);

-- ----------------------------------------------------------------------------
-- WEIGHT CUTS (core planning entity — one per competition campaign)
-- ----------------------------------------------------------------------------
create table weight_cuts (
  id                       uuid primary key default gen_random_uuid(),
  client_id                uuid not null references clients(id) on delete cascade,
  coach_id                 uuid not null references profiles(id) on delete cascade,
  competition_id           uuid references competitions(id) on delete set null,
  weight_class_id          uuid references weight_classes(id) on delete set null,
  discipline               combat_discipline not null default 'mma',
  class_name               text,
  class_limit_lbs          numeric(6,2) not null,
  walk_around_lbs          numeric(6,2),
  camp_start_lbs           numeric(6,2),
  target_weigh_in_lbs      numeric(6,2) not null,
  weigh_in_at              timestamptz,
  competition_at           timestamptz,
  rehydration_window_hours numeric(5,1),
  cut_method               text,
  -- structured protocol documents (typed in lib/combat/protocols.ts)
  water_load_plan          jsonb not null default '[]'::jsonb,
  hydration_restoration    jsonb not null default '[]'::jsonb,
  refuel_protocol          jsonb not null default '[]'::jsonb,
  status                   weight_cut_status not null default 'planning',
  made_weight              boolean,
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index weight_cuts_client_idx on weight_cuts (client_id, status);
create index weight_cuts_coach_weighin_idx on weight_cuts (coach_id, weigh_in_at);
create index weight_cuts_competition_idx on weight_cuts (competition_id);

-- ----------------------------------------------------------------------------
-- WEIGH-INS (scheduled + actual events under a cut)
-- ----------------------------------------------------------------------------
create table weigh_ins (
  id            uuid primary key default gen_random_uuid(),
  weight_cut_id uuid not null references weight_cuts(id) on delete cascade,
  client_id     uuid not null references clients(id) on delete cascade,
  kind          weigh_in_kind not null default 'check_in',
  scheduled_at  timestamptz not null,
  target_lbs    numeric(6,2),
  weight_lbs    numeric(6,2),
  made_weight   boolean,
  recorded_at   timestamptz,
  notes         text,
  created_at    timestamptz not null default now()
);
create index weigh_ins_cut_idx on weigh_ins (weight_cut_id, scheduled_at);
create index weigh_ins_client_idx on weigh_ins (client_id, scheduled_at desc);

create trigger weight_cuts_set_updated_at before update on weight_cuts
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table weight_classes enable row level security;
alter table weight_cuts    enable row level security;
alter table weigh_ins      enable row level security;

-- Weight classes: global rows readable by all; coach manages their own.
create policy weight_classes_read on weight_classes for select
  using (coach_id is null or coach_id = current_profile_id());
create policy weight_classes_write on weight_classes for all
  using (coach_id = current_profile_id())
  with check (coach_id = current_profile_id());

-- Weight cuts: coach manages; linked client can read their own.
create policy weight_cuts_read  on weight_cuts for select using (owns_client(client_id));
create policy weight_cuts_write on weight_cuts for all
  using (is_client_coach(client_id)) with check (is_client_coach(client_id));

-- Weigh-ins: coach manages; linked client may log their own check-ins.
create policy weigh_ins_read   on weigh_ins for select using (owns_client(client_id));
create policy weigh_ins_insert on weigh_ins for insert with check (owns_client(client_id));
create policy weigh_ins_update on weigh_ins for update using (owns_client(client_id));
create policy weigh_ins_delete on weigh_ins for delete using (is_client_coach(client_id));

-- ----------------------------------------------------------------------------
-- REFERENCE DATA — standard weight-class catalog (global)
-- ----------------------------------------------------------------------------
insert into weight_classes (discipline, federation, name, gender, limit_lbs, limit_kg, sort_order) values
  -- MMA (UFC men)
  ('mma','UFC','Flyweight','male',125,56.7,1),
  ('mma','UFC','Bantamweight','male',135,61.2,2),
  ('mma','UFC','Featherweight','male',145,65.8,3),
  ('mma','UFC','Lightweight','male',155,70.3,4),
  ('mma','UFC','Welterweight','male',170,77.1,5),
  ('mma','UFC','Middleweight','male',185,83.9,6),
  ('mma','UFC','Light Heavyweight','male',205,93.0,7),
  ('mma','UFC','Heavyweight','male',265,120.2,8),
  -- MMA (UFC women)
  ('mma','UFC','Strawweight','female',115,52.2,1),
  ('mma','UFC','Flyweight','female',125,56.7,2),
  ('mma','UFC','Bantamweight','female',135,61.2,3),
  -- Boxing (selected)
  ('boxing','—','Lightweight','male',135,61.2,4),
  ('boxing','—','Welterweight','male',147,66.7,5),
  ('boxing','—','Middleweight','male',160,72.6,6),
  -- Wrestling (freestyle senior men, selected)
  ('wrestling','UWW','57 kg','male',125.7,57.0,1),
  ('wrestling','UWW','65 kg','male',143.3,65.0,3),
  ('wrestling','UWW','74 kg','male',163.1,74.0,5),
  ('wrestling','UWW','86 kg','male',189.6,86.0,7),
  -- BJJ (IBJJF adult gi, selected, approx in lbs)
  ('bjj','IBJJF','Lightweight','male',168,76.0,4),
  ('bjj','IBJJF','Middleweight','male',181.5,82.3,5),
  -- Muay Thai (selected)
  ('muay_thai','—','Lightweight','male',135,61.2,4),
  ('muay_thai','—','Welterweight','male',147,66.7,5)
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Combat-specific alert rules (global defaults)
-- ----------------------------------------------------------------------------
insert into alert_rules (coach_id, key, description, severity, config) values
  (null, 'weigh_in_approaching',
   'Weigh-in within N days for an active cut',
   'info', '{"days": 7}'::jsonb),
  (null, 'aggressive_weight_cut',
   'Remaining cut exceeds safe percent of bodyweight per day to weigh-in',
   'critical', '{"max_pct_per_day": 1.0}'::jsonb),
  (null, 'cut_off_pace',
   'Athlete is off the planned descent toward weigh-in weight',
   'warning', '{"tolerance_lbs": 3}'::jsonb),
  (null, 'low_readiness',
   'Competition readiness score below threshold near weigh-in',
   'warning', '{"score": 60, "days": 10}'::jsonb)
on conflict do nothing;
