-- ============================================================================
-- Treigning Lab CoachOS — Initial Schema
-- Postgres / Supabase. Auth provided by Clerk (JWT 'sub' = clerk user id).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
create type role_t        as enum ('coach', 'client', 'admin');
create type client_status as enum ('active', 'inactive', 'prospect', 'archived');
create type plan_dir      as enum ('cut', 'maintain', 'bulk');
create type comp_status   as enum ('planned', 'registered', 'completed', 'cancelled');
create type task_status   as enum ('open', 'in_progress', 'done', 'cancelled');
create type priority_t    as enum ('low', 'medium', 'high', 'urgent');
create type alert_status  as enum ('active', 'acknowledged', 'resolved', 'snoozed');
create type severity_t    as enum ('info', 'warning', 'critical');
create type units_t       as enum ('imperial', 'metric');
create type comm_channel   as enum ('call', 'email', 'sms', 'in_person', 'other');
create type comm_direction as enum ('inbound', 'outbound');

-- ----------------------------------------------------------------------------
-- IDENTITY
-- ----------------------------------------------------------------------------
create table profiles (
  id          uuid primary key default gen_random_uuid(),
  clerk_id    text unique not null,
  role        role_t not null default 'coach',
  full_name   text,
  email       text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table coach_settings (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null references profiles(id) on delete cascade,
  business_name text,
  timezone      text not null default 'UTC',
  units         units_t not null default 'imperial',
  alert_prefs        jsonb not null default '{}'::jsonb,
  notification_prefs jsonb not null default '{}'::jsonb,
  unique (coach_id)
);

-- ----------------------------------------------------------------------------
-- CLIENTS
-- ----------------------------------------------------------------------------
create table clients (
  id                   uuid primary key default gen_random_uuid(),
  coach_id             uuid not null references profiles(id) on delete cascade,
  profile_id           uuid references profiles(id) on delete set null,
  first_name           text not null,
  last_name            text not null,
  email                text,
  phone                text,
  date_of_birth        date,
  gender               text,
  sport                text,
  discipline           text,
  current_weight_class text,
  goal_summary         text,
  status               client_status not null default 'active',
  start_date           date,
  avatar_url           text,
  emergency_contact    jsonb,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index clients_coach_status_idx on clients (coach_id, status);

create table client_invites (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  token       text unique not null,
  email       text,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- WEIGHT
-- ----------------------------------------------------------------------------
create table weight_goals (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references clients(id) on delete cascade,
  target_weight  numeric(6,2),
  target_date    date,
  direction      plan_dir not null default 'maintain',
  weekly_rate_lbs numeric(4,2),
  created_at     timestamptz not null default now()
);
create index weight_goals_client_idx on weight_goals (client_id);

create table weight_logs (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  logged_by     uuid references profiles(id) on delete set null,
  weight_lbs    numeric(6,2) not null,
  body_fat_pct  numeric(5,2),
  muscle_mass_lbs numeric(6,2),
  logged_at     timestamptz not null default now(),
  photo_url     text,
  notes         text,
  created_at    timestamptz not null default now()
);
create index weight_logs_client_time_idx on weight_logs (client_id, logged_at desc);

-- ----------------------------------------------------------------------------
-- NUTRITION
-- ----------------------------------------------------------------------------
create table nutrition_plans (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references clients(id) on delete cascade,
  coach_id       uuid not null references profiles(id) on delete cascade,
  name           text not null,
  calories       int,
  protein_g      int,
  carbs_g        int,
  fat_g          int,
  fiber_g        int,
  meal_structure jsonb,
  is_active      boolean not null default true,
  effective_date date,
  notes          text,
  created_at     timestamptz not null default now()
);
create index nutrition_plans_client_idx on nutrition_plans (client_id, is_active);

create table nutrition_logs (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  logged_by   uuid references profiles(id) on delete set null,
  logged_date date not null,
  meal_label  text,
  calories    int,
  protein_g   numeric(6,2),
  carbs_g     numeric(6,2),
  fat_g       numeric(6,2),
  fiber_g     numeric(6,2),
  photo_url   text,
  notes       text,
  created_at  timestamptz not null default now()
);
create index nutrition_logs_client_date_idx on nutrition_logs (client_id, logged_date desc);

-- ----------------------------------------------------------------------------
-- HYDRATION
-- ----------------------------------------------------------------------------
create table hydration_logs (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  logged_by   uuid references profiles(id) on delete set null,
  logged_date date not null,
  oz_consumed numeric(6,2) not null,
  oz_target   numeric(6,2),
  notes       text,
  created_at  timestamptz not null default now()
);
create index hydration_logs_client_date_idx on hydration_logs (client_id, logged_date desc);

-- ----------------------------------------------------------------------------
-- SUPPLEMENTS
-- ----------------------------------------------------------------------------
create table supplements (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients(id) on delete cascade,
  coach_id   uuid not null references profiles(id) on delete cascade,
  name       text not null,
  brand      text,
  dosage     text,
  frequency  text,
  timing     text,
  purpose    text,
  is_active  boolean not null default true,
  start_date date,
  end_date   date,
  notes      text,
  created_at timestamptz not null default now()
);
create index supplements_client_idx on supplements (client_id, is_active);

create table supplement_logs (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  supplement_id uuid not null references supplements(id) on delete cascade,
  logged_by     uuid references profiles(id) on delete set null,
  logged_at     timestamptz not null default now(),
  taken         boolean not null default true,
  notes         text
);
create index supplement_logs_client_time_idx on supplement_logs (client_id, logged_at desc);

-- ----------------------------------------------------------------------------
-- RECOVERY
-- ----------------------------------------------------------------------------
create table recovery_logs (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  logged_by     uuid references profiles(id) on delete set null,
  logged_date   date not null,
  sleep_hours   numeric(4,2),
  sleep_quality int check (sleep_quality between 1 and 10),
  soreness      int check (soreness between 1 and 10),
  energy        int check (energy between 1 and 10),
  stress        int check (stress between 1 and 10),
  hrv           numeric(6,2),
  resting_hr    int,
  modalities    text[] not null default '{}',
  notes         text,
  created_at    timestamptz not null default now()
);
create index recovery_logs_client_date_idx on recovery_logs (client_id, logged_date desc);

-- ----------------------------------------------------------------------------
-- TRAINING
-- ----------------------------------------------------------------------------
create table training_programs (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients(id) on delete cascade,
  coach_id   uuid not null references profiles(id) on delete cascade,
  name       text not null,
  phase      text,
  start_date date,
  end_date   date,
  is_active  boolean not null default true,
  notes      text,
  created_at timestamptz not null default now()
);
create index training_programs_client_idx on training_programs (client_id, is_active);

create table training_sessions (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  program_id   uuid references training_programs(id) on delete set null,
  scheduled_at timestamptz,
  completed_at timestamptz,
  session_type text,
  duration_min int,
  rpe          int check (rpe between 1 and 10),
  notes        text,
  created_at   timestamptz not null default now()
);
create index training_sessions_client_idx on training_sessions (client_id, scheduled_at desc);

create table exercises (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references training_sessions(id) on delete cascade,
  name         text not null,
  sets         int,
  reps         text,
  weight_lbs   numeric(7,2),
  duration_sec int,
  distance_m   numeric(8,2),
  notes        text,
  order_index  int not null default 0
);
create index exercises_session_idx on exercises (session_id, order_index);

-- ----------------------------------------------------------------------------
-- COMPETITION
-- ----------------------------------------------------------------------------
create table competitions (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references clients(id) on delete cascade,
  coach_id         uuid not null references profiles(id) on delete cascade,
  name             text not null,
  federation       text,
  location         text,
  competition_date date not null,
  weight_class     text,
  divisions        text[] not null default '{}',
  status           comp_status not null default 'planned',
  result           text,
  placement        int,
  peak_weight      numeric(6,2),
  weigh_in_weight  numeric(6,2),
  notes            text,
  created_at       timestamptz not null default now()
);
create index competitions_client_idx on competitions (client_id, competition_date);
create index competitions_coach_date_idx on competitions (coach_id, competition_date);

create table competition_tasks (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  task           text not null,
  due_date       date,
  completed      boolean not null default false,
  assigned_to    uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index competition_tasks_comp_idx on competition_tasks (competition_id);

-- ----------------------------------------------------------------------------
-- COMMUNICATION
-- ----------------------------------------------------------------------------
create table message_threads (
  id              uuid primary key default gen_random_uuid(),
  coach_id        uuid not null references profiles(id) on delete cascade,
  client_id       uuid not null references clients(id) on delete cascade,
  subject         text,
  last_message_at timestamptz,
  created_at      timestamptz not null default now()
);
create index message_threads_coach_idx on message_threads (coach_id, last_message_at desc);
create index message_threads_client_idx on message_threads (client_id);

create table messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references message_threads(id) on delete cascade,
  sender_id   uuid not null references profiles(id) on delete cascade,
  body        text not null,
  attachments jsonb not null default '[]'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index messages_thread_idx on messages (thread_id, created_at);

create table communications (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references profiles(id) on delete cascade,
  client_id   uuid not null references clients(id) on delete cascade,
  channel     comm_channel not null,
  direction   comm_direction not null,
  summary     text not null,
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index communications_client_idx on communications (client_id, occurred_at desc);

-- ----------------------------------------------------------------------------
-- COACH TASKS
-- ----------------------------------------------------------------------------
create table tasks (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null references profiles(id) on delete cascade,
  client_id    uuid references clients(id) on delete cascade,
  title        text not null,
  description  text,
  status       task_status not null default 'open',
  priority     priority_t not null default 'medium',
  due_date     date,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index tasks_coach_idx on tasks (coach_id, status, due_date);

-- ----------------------------------------------------------------------------
-- ALERTS
-- ----------------------------------------------------------------------------
create table alert_rules (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid references profiles(id) on delete cascade, -- null = global default
  key         text not null,
  description text,
  config      jsonb not null default '{}'::jsonb,
  severity    severity_t not null default 'warning',
  is_enabled  boolean not null default true,
  created_at  timestamptz not null default now()
);
create index alert_rules_coach_idx on alert_rules (coach_id);

create table alerts (
  id              uuid primary key default gen_random_uuid(),
  coach_id        uuid not null references profiles(id) on delete cascade,
  client_id       uuid not null references clients(id) on delete cascade,
  rule_key        text not null,
  severity        severity_t not null default 'warning',
  status          alert_status not null default 'active',
  title           text not null,
  detail          text,
  context         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at     timestamptz,
  snoozed_until   timestamptz
);
create index alerts_coach_status_idx on alerts (coach_id, status, severity);
create index alerts_client_idx on alerts (client_id);

-- ----------------------------------------------------------------------------
-- updated_at trigger
-- ----------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger clients_set_updated_at before update on clients
  for each row execute function set_updated_at();
create trigger tasks_set_updated_at before update on tasks
  for each row execute function set_updated_at();
