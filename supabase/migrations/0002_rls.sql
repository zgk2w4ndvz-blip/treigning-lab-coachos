-- ============================================================================
-- Treigning Lab CoachOS — Row Level Security
-- Identity comes from the Clerk JWT: auth.jwt() ->> 'sub' is the clerk user id.
-- ============================================================================

-- Clerk user id from the JWT presented to PostgREST.
create or replace function clerk_user_id() returns text
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::text;
$$;

-- Resolve the current profile id (security definer to read profiles safely).
create or replace function current_profile_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from profiles where clerk_id = clerk_user_id() limit 1;
$$;

-- True when the current user is the coach who owns the client,
-- or the client themselves (linked via clients.profile_id).
create or replace function owns_client(target_client uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from clients c
    where c.id = target_client
      and (
        c.coach_id = current_profile_id()
        or c.profile_id = current_profile_id()
      )
  );
$$;

-- True when current user is the coach who owns the client (write-side guard).
create or replace function is_client_coach(target_client uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from clients c
    where c.id = target_client and c.coach_id = current_profile_id()
  );
$$;

-- ----------------------------------------------------------------------------
-- Enable RLS on every table
-- ----------------------------------------------------------------------------
alter table profiles            enable row level security;
alter table coach_settings      enable row level security;
alter table clients             enable row level security;
alter table client_invites      enable row level security;
alter table weight_goals        enable row level security;
alter table weight_logs         enable row level security;
alter table nutrition_plans     enable row level security;
alter table nutrition_logs      enable row level security;
alter table hydration_logs      enable row level security;
alter table supplements         enable row level security;
alter table supplement_logs     enable row level security;
alter table recovery_logs       enable row level security;
alter table training_programs   enable row level security;
alter table training_sessions   enable row level security;
alter table exercises           enable row level security;
alter table competitions        enable row level security;
alter table competition_tasks   enable row level security;
alter table message_threads     enable row level security;
alter table messages            enable row level security;
alter table communications      enable row level security;
alter table tasks               enable row level security;
alter table alert_rules         enable row level security;
alter table alerts              enable row level security;

-- ----------------------------------------------------------------------------
-- PROFILES — a user can read/update their own profile.
-- ----------------------------------------------------------------------------
create policy profiles_self_select on profiles
  for select using (clerk_id = clerk_user_id());
create policy profiles_self_update on profiles
  for update using (clerk_id = clerk_user_id());

-- ----------------------------------------------------------------------------
-- COACH_SETTINGS — coach owns their settings row.
-- ----------------------------------------------------------------------------
create policy coach_settings_owner on coach_settings
  for all using (coach_id = current_profile_id())
  with check (coach_id = current_profile_id());

-- ----------------------------------------------------------------------------
-- CLIENTS — coach manages; linked client can read their own record.
-- ----------------------------------------------------------------------------
create policy clients_coach_all on clients
  for all using (coach_id = current_profile_id())
  with check (coach_id = current_profile_id());
create policy clients_self_select on clients
  for select using (profile_id = current_profile_id());

-- ----------------------------------------------------------------------------
-- CLIENT_INVITES — coach only.
-- ----------------------------------------------------------------------------
create policy client_invites_coach on client_invites
  for all using (is_client_coach(client_id))
  with check (is_client_coach(client_id));

-- ----------------------------------------------------------------------------
-- Per-client domain tables: read by coach OR linked client; write by coach.
-- Client-loggable tables additionally allow the linked client to insert.
-- ----------------------------------------------------------------------------

-- helper macro pattern applied table by table -------------------------------

-- WEIGHT GOALS (coach manages)
create policy weight_goals_read  on weight_goals for select using (owns_client(client_id));
create policy weight_goals_write on weight_goals for all
  using (is_client_coach(client_id)) with check (is_client_coach(client_id));

-- WEIGHT LOGS (client may log)
create policy weight_logs_read   on weight_logs for select using (owns_client(client_id));
create policy weight_logs_insert on weight_logs for insert with check (owns_client(client_id));
create policy weight_logs_modify on weight_logs for update using (is_client_coach(client_id));
create policy weight_logs_delete on weight_logs for delete using (is_client_coach(client_id));

-- NUTRITION PLANS (coach manages)
create policy nutrition_plans_read  on nutrition_plans for select using (owns_client(client_id));
create policy nutrition_plans_write on nutrition_plans for all
  using (is_client_coach(client_id)) with check (is_client_coach(client_id));

-- NUTRITION LOGS (client may log)
create policy nutrition_logs_read   on nutrition_logs for select using (owns_client(client_id));
create policy nutrition_logs_insert on nutrition_logs for insert with check (owns_client(client_id));
create policy nutrition_logs_modify on nutrition_logs for update using (owns_client(client_id));
create policy nutrition_logs_delete on nutrition_logs for delete using (owns_client(client_id));

-- HYDRATION LOGS (client may log)
create policy hydration_logs_read   on hydration_logs for select using (owns_client(client_id));
create policy hydration_logs_insert on hydration_logs for insert with check (owns_client(client_id));
create policy hydration_logs_modify on hydration_logs for update using (owns_client(client_id));
create policy hydration_logs_delete on hydration_logs for delete using (owns_client(client_id));

-- SUPPLEMENTS (coach manages)
create policy supplements_read  on supplements for select using (owns_client(client_id));
create policy supplements_write on supplements for all
  using (is_client_coach(client_id)) with check (is_client_coach(client_id));

-- SUPPLEMENT LOGS (client may log adherence)
create policy supplement_logs_read   on supplement_logs for select using (owns_client(client_id));
create policy supplement_logs_insert on supplement_logs for insert with check (owns_client(client_id));
create policy supplement_logs_modify on supplement_logs for update using (owns_client(client_id));
create policy supplement_logs_delete on supplement_logs for delete using (is_client_coach(client_id));

-- RECOVERY LOGS (client may log)
create policy recovery_logs_read   on recovery_logs for select using (owns_client(client_id));
create policy recovery_logs_insert on recovery_logs for insert with check (owns_client(client_id));
create policy recovery_logs_modify on recovery_logs for update using (owns_client(client_id));
create policy recovery_logs_delete on recovery_logs for delete using (is_client_coach(client_id));

-- TRAINING PROGRAMS (coach manages)
create policy training_programs_read  on training_programs for select using (owns_client(client_id));
create policy training_programs_write on training_programs for all
  using (is_client_coach(client_id)) with check (is_client_coach(client_id));

-- TRAINING SESSIONS (coach manages; client can mark complete)
create policy training_sessions_read   on training_sessions for select using (owns_client(client_id));
create policy training_sessions_insert on training_sessions for insert with check (owns_client(client_id));
create policy training_sessions_modify on training_sessions for update using (owns_client(client_id));
create policy training_sessions_delete on training_sessions for delete using (is_client_coach(client_id));

-- EXERCISES (scoped through parent session)
create policy exercises_read on exercises for select using (
  exists (select 1 from training_sessions s where s.id = session_id and owns_client(s.client_id))
);
create policy exercises_write on exercises for all using (
  exists (select 1 from training_sessions s where s.id = session_id and owns_client(s.client_id))
) with check (
  exists (select 1 from training_sessions s where s.id = session_id and owns_client(s.client_id))
);

-- COMPETITIONS (coach manages)
create policy competitions_read  on competitions for select using (owns_client(client_id));
create policy competitions_write on competitions for all
  using (is_client_coach(client_id)) with check (is_client_coach(client_id));

-- COMPETITION TASKS (scoped through parent competition)
create policy competition_tasks_read on competition_tasks for select using (
  exists (select 1 from competitions c where c.id = competition_id and owns_client(c.client_id))
);
create policy competition_tasks_write on competition_tasks for all using (
  exists (select 1 from competitions c where c.id = competition_id and is_client_coach(c.client_id))
) with check (
  exists (select 1 from competitions c where c.id = competition_id and is_client_coach(c.client_id))
);

-- MESSAGE THREADS (coach or linked client)
create policy message_threads_access on message_threads for all
  using (coach_id = current_profile_id() or owns_client(client_id))
  with check (coach_id = current_profile_id() or owns_client(client_id));

-- MESSAGES (scoped through parent thread)
create policy messages_read on messages for select using (
  exists (
    select 1 from message_threads t
    where t.id = thread_id
      and (t.coach_id = current_profile_id() or owns_client(t.client_id))
  )
);
create policy messages_insert on messages for insert with check (
  sender_id = current_profile_id() and exists (
    select 1 from message_threads t
    where t.id = thread_id
      and (t.coach_id = current_profile_id() or owns_client(t.client_id))
  )
);
create policy messages_update on messages for update using (
  exists (
    select 1 from message_threads t
    where t.id = thread_id
      and (t.coach_id = current_profile_id() or owns_client(t.client_id))
  )
);

-- COMMUNICATIONS (coach only)
create policy communications_coach on communications for all
  using (coach_id = current_profile_id())
  with check (coach_id = current_profile_id());

-- TASKS (coach only)
create policy tasks_coach on tasks for all
  using (coach_id = current_profile_id())
  with check (coach_id = current_profile_id());

-- ALERT RULES (global readable; coach manages own)
create policy alert_rules_read on alert_rules for select
  using (coach_id is null or coach_id = current_profile_id());
create policy alert_rules_write on alert_rules for all
  using (coach_id = current_profile_id())
  with check (coach_id = current_profile_id());

-- ALERTS (coach only)
create policy alerts_coach on alerts for all
  using (coach_id = current_profile_id())
  with check (coach_id = current_profile_id());
