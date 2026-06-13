-- ============================================================================
-- DEMO SEED — realistic athlete data for local development.
--
-- HOW TO USE
--   1. Sign up in the app once (creates your coach row in `profiles`).
--   2. Replace 'REPLACE_WITH_YOUR_CLERK_ID' below with your Clerk user id
--      (Clerk dashboard → Users → your user → "User ID", looks like user_...).
--      OR run against an existing coach by editing the SELECT in the DO block.
--   3. Run this file in the Supabase SQL editor.
--
-- Safe to re-run: it removes prior demo clients (tagged in notes) first.
-- ============================================================================

do $$
declare
  v_clerk   text := 'REPLACE_WITH_YOUR_CLERK_ID';
  v_coach   uuid;
  c_jordan  uuid;
  c_maya    uuid;
  c_devon   uuid;
  c_priya   uuid;
  c_luca    uuid;
  c_kai     uuid;
  v_comp    uuid;
  v_cut     uuid;
begin
  -- Resolve coach profile. Prefer the given clerk id; else the first coach.
  select id into v_coach from profiles where clerk_id = v_clerk limit 1;
  if v_coach is null then
    select id into v_coach from profiles where role = 'coach'
      order by created_at limit 1;
  end if;
  if v_coach is null then
    raise exception 'No coach profile found. Sign up first, then set v_clerk.';
  end if;

  -- Clean prior demo rows for this coach (cascades to all child data).
  delete from clients where coach_id = v_coach and notes = 'DEMO_SEED';

  -- -- CLIENTS ----------------------------------------------------------------
  insert into clients (coach_id, first_name, last_name, email, sport, discipline,
                       current_weight_class, goal_summary, status, start_date, notes)
  values
    (v_coach, 'Jordan', 'Vance', 'jordan.vance@example.com', 'Powerlifting',
     'Raw', '-83kg', 'Cut to 83kg for nationals; hold strength.', 'active',
     current_date - 220, 'DEMO_SEED')
  returning id into c_jordan;

  insert into clients (coach_id, first_name, last_name, email, sport, discipline,
                       current_weight_class, goal_summary, status, start_date, notes)
  values
    (v_coach, 'Maya', 'Okafor', 'maya.okafor@example.com', 'Weightlifting',
     'Olympic', '-71kg', 'Peak snatch/CJ for regional qualifier.', 'active',
     current_date - 160, 'DEMO_SEED')
  returning id into c_maya;

  insert into clients (coach_id, first_name, last_name, email, sport, discipline,
                       current_weight_class, goal_summary, status, start_date, notes)
  values
    (v_coach, 'Devon', 'Reyes', 'devon.reyes@example.com', 'CrossFit',
     'Rx', null, 'General prep; improve engine + recovery.', 'active',
     current_date - 90, 'DEMO_SEED')
  returning id into c_devon;

  insert into clients (coach_id, first_name, last_name, email, sport, discipline,
                       current_weight_class, goal_summary, status, start_date, notes)
  values
    (v_coach, 'Priya', 'Nair', 'priya.nair@example.com', 'Powerlifting',
     'Raw', '-63kg', 'Off-season hypertrophy block.', 'active',
     current_date - 300, 'DEMO_SEED')
  returning id into c_priya;

  insert into clients (coach_id, first_name, last_name, email, sport, discipline,
                       current_weight_class, goal_summary, status, start_date, notes)
  values
    (v_coach, 'Luca', 'Bianchi', 'luca.bianchi@example.com', 'Weightlifting',
     'Olympic', '-96kg', 'Returning from shoulder rehab.', 'prospect',
     current_date - 30, 'DEMO_SEED')
  returning id into c_luca;

  -- -- WEIGHT: goals + 60-day trend ------------------------------------------
  insert into weight_goals (client_id, target_weight, target_date, direction, weekly_rate_lbs)
  values
    (c_jordan, 183.0, current_date + 25, 'cut', 1.0),
    (c_maya,   156.5, current_date + 40, 'maintain', 0.0),
    (c_priya,  140.0, current_date + 60, 'bulk', 0.5);

  -- Jordan: gentle downward cut from ~192 -> ~184
  insert into weight_logs (client_id, weight_lbs, logged_at, body_fat_pct)
  select c_jordan,
         192.0 - (g * 0.13) + (random() - 0.5),
         (now() - make_interval(days => 60 - g)),
         15.5 - (g * 0.02)
  from generate_series(0, 60, 2) as g;

  -- Maya: stable around 156
  insert into weight_logs (client_id, weight_lbs, logged_at)
  select c_maya, 156.0 + (random() - 0.5) * 1.5,
         (now() - make_interval(days => 60 - g))
  from generate_series(0, 60, 3) as g;

  -- Priya: slow lean gain 134 -> 138
  insert into weight_logs (client_id, weight_lbs, logged_at)
  select c_priya, 134.0 + (g * 0.07) + (random() - 0.5),
         (now() - make_interval(days => 60 - g))
  from generate_series(0, 60, 2) as g;

  -- Devon: a couple recent entries
  insert into weight_logs (client_id, weight_lbs, logged_at) values
    (c_devon, 178.4, now() - interval '5 days'),
    (c_devon, 177.9, now() - interval '1 day');

  -- -- NUTRITION plans + recent logs -----------------------------------------
  insert into nutrition_plans (client_id, coach_id, name, calories, protein_g, carbs_g, fat_g, is_active, effective_date)
  values
    (c_jordan, v_coach, 'Cut Phase 2', 2600, 200, 250, 70, true, current_date - 20),
    (c_maya,   v_coach, 'Performance Maintenance', 2900, 175, 360, 85, true, current_date - 30),
    (c_priya,  v_coach, 'Lean Gain', 2400, 165, 290, 65, true, current_date - 15);

  insert into nutrition_logs (client_id, logged_date, meal_label, calories, protein_g, carbs_g, fat_g)
  select c_jordan, current_date - d, 'Daily total',
         2550 + (random() * 200)::int, 195 + (random() * 20)::int,
         240 + (random() * 40)::int, 68 + (random() * 10)::int
  from generate_series(0, 6) as d;

  -- -- HYDRATION (last 7 days; Devon intentionally low to trigger alerts) -----
  insert into hydration_logs (client_id, logged_date, oz_consumed, oz_target)
  select c_jordan, current_date - d, 90 + (random() * 20)::int, 110
  from generate_series(0, 6) as d;
  insert into hydration_logs (client_id, logged_date, oz_consumed, oz_target)
  select c_maya, current_date - d, 80 + (random() * 15)::int, 100
  from generate_series(0, 6) as d;
  insert into hydration_logs (client_id, logged_date, oz_consumed, oz_target)
  select c_devon, current_date - d, 35 + (random() * 10)::int, 100
  from generate_series(0, 4) as d;
  insert into hydration_logs (client_id, logged_date, oz_consumed, oz_target)
  select c_priya, current_date - d, 70 + (random() * 20)::int, 90
  from generate_series(0, 6) as d;

  -- -- RECOVERY (last 7 days) -------------------------------------------------
  insert into recovery_logs (client_id, logged_date, sleep_hours, sleep_quality, soreness, energy, stress, modalities)
  select c_jordan, current_date - d,
         6.5 + random(), 6 + (random() * 3)::int, 3 + (random() * 3)::int,
         6 + (random() * 3)::int, 3 + (random() * 3)::int,
         array['mobility']
  from generate_series(0, 6) as d;
  insert into recovery_logs (client_id, logged_date, sleep_hours, sleep_quality, soreness, energy, stress, modalities)
  select c_maya, current_date - d,
         7.5 + random(), 7 + (random() * 2)::int, 2 + (random() * 2)::int,
         7 + (random() * 2)::int, 2 + (random() * 2)::int,
         array['massage','sauna']
  from generate_series(0, 6) as d;
  insert into recovery_logs (client_id, logged_date, sleep_hours, sleep_quality, soreness, energy, stress, modalities)
  select c_priya, current_date - d,
         7.0 + random(), 7, 3 + (random() * 2)::int, 7, 3, array['ice bath']
  from generate_series(0, 6) as d;

  -- -- SUPPLEMENTS ------------------------------------------------------------
  insert into supplements (client_id, coach_id, name, brand, dosage, frequency, timing, purpose)
  values
    (c_jordan, v_coach, 'Creatine Monohydrate', 'BulkLabs', '5 g', 'Daily', 'Morning', 'Strength/output'),
    (c_jordan, v_coach, 'Whey Isolate', 'PureForm', '30 g', 'Daily', 'Post-workout', 'Protein target'),
    (c_jordan, v_coach, 'Vitamin D3', 'NordHealth', '2000 IU', 'Daily', 'Morning', 'Immune/bone'),
    (c_maya,   v_coach, 'Creatine Monohydrate', 'BulkLabs', '5 g', 'Daily', 'Morning', 'Strength/output'),
    (c_maya,   v_coach, 'Magnesium Glycinate', 'NordHealth', '400 mg', 'Daily', 'Evening', 'Sleep/recovery'),
    (c_priya,  v_coach, 'Iron Bisglycinate', 'NordHealth', '25 mg', 'Daily', 'Morning', 'Ferritin support');

  -- -- TRAINING ---------------------------------------------------------------
  insert into training_programs (client_id, coach_id, name, phase, start_date, is_active)
  values
    (c_jordan, v_coach, 'Peak Block', 'peak', current_date - 14, true),
    (c_maya,   v_coach, 'Qualifier Prep', 'competition', current_date - 28, true),
    (c_priya,  v_coach, 'Hypertrophy A', 'off-season', current_date - 10, true);

  insert into training_sessions (client_id, scheduled_at, completed_at, session_type, duration_min, rpe)
  values
    (c_jordan, now() - interval '2 days', now() - interval '2 days', 'strength', 75, 8),
    (c_jordan, now() + interval '1 day', null, 'strength', 80, null),
    (c_maya,   now() - interval '1 day', now() - interval '1 day', 'technique', 90, 7),
    (c_priya,  now() - interval '3 days', now() - interval '3 days', 'strength', 70, 8);

  -- -- COMPETITIONS + checklist -----------------------------------------------
  insert into competitions (client_id, coach_id, name, federation, location, competition_date, weight_class, status)
  values (c_jordan, v_coach, 'USAPL Raw Nationals', 'USAPL', 'Columbus, OH',
          current_date + 25, '-83kg', 'registered')
  returning id into v_comp;
  insert into competition_tasks (competition_id, task, due_date, completed) values
    (v_comp, 'Confirm flight + hotel', current_date + 5, true),
    (v_comp, 'Finalize attempt selections', current_date + 18, false),
    (v_comp, 'Send water-cut protocol', current_date + 20, false),
    (v_comp, 'Day-of meal timing plan', current_date + 22, false);

  insert into competitions (client_id, coach_id, name, federation, location, competition_date, weight_class, status)
  values (c_maya, v_coach, 'State Weightlifting Qualifier', 'USAW', 'Austin, TX',
          current_date + 40, '-71kg', 'planned');

  -- -- ALERTS -----------------------------------------------------------------
  insert into alerts (coach_id, client_id, rule_key, severity, title, detail) values
    (v_coach, c_devon, 'missed_weigh_in', 'critical',
     'Devon Reyes — no weigh-in for 4 days',
     'Last weight logged 5 days ago. Nudge to resume tracking.'),
    (v_coach, c_devon, 'low_hydration', 'warning',
     'Devon Reyes — hydration under 50% target',
     'Averaging ~38 oz against a 100 oz target this week.'),
    (v_coach, c_jordan, 'competition_countdown', 'info',
     'Jordan Vance — competition in 25 days',
     'USAPL Raw Nationals. Begin peak taper planning.');

  -- -- COACH TASKS ------------------------------------------------------------
  insert into tasks (coach_id, client_id, title, status, priority, due_date) values
    (v_coach, c_jordan, 'Review Jordan''s peak-week macros', 'open', 'high', current_date + 1),
    (v_coach, c_devon,  'Call Devon re: hydration + check-in', 'open', 'urgent', current_date),
    (v_coach, c_maya,   'Update Maya''s attempt selections', 'in_progress', 'medium', current_date + 3),
    (v_coach, c_priya,  'Program hypertrophy block week 3', 'open', 'medium', current_date + 4),
    (v_coach, null,     'Draft monthly newsletter', 'open', 'low', current_date + 7);

  -- -- COMMUNICATIONS ---------------------------------------------------------
  insert into communications (coach_id, client_id, channel, direction, summary, occurred_at) values
    (v_coach, c_jordan, 'call', 'outbound', 'Checked in on cut; feeling strong, sleep good.', now() - interval '2 days'),
    (v_coach, c_devon,  'sms', 'outbound', 'Reminder to log hydration daily.', now() - interval '1 day');

  -- -- COMBAT SPORTS: an MMA fighter mid-cut ----------------------------------
  insert into clients (coach_id, first_name, last_name, email, sport, discipline,
                       current_weight_class, goal_summary, status, start_date, notes)
  values
    (v_coach, 'Kai', 'Tanaka', 'kai.tanaka@example.com', 'MMA', 'Pro',
     'Welterweight (-170)', 'Make 170 for title fight; 24h rehydration window.',
     'active', current_date - 120, 'DEMO_SEED')
  returning id into c_kai;

  -- Bodyweight descent 191 -> ~179 over 30 days (still ~9 lb to go)
  insert into weight_logs (client_id, weight_lbs, logged_at)
  select c_kai, 191.0 - (g * 0.40) + (random() - 0.5),
         (now() - make_interval(days => 30 - g))
  from generate_series(0, 30, 2) as g;

  insert into hydration_logs (client_id, logged_date, oz_consumed, oz_target)
  select c_kai, current_date - d, 180 + (random() * 40)::int, 200
  from generate_series(0, 6) as d;  -- water loading phase

  insert into recovery_logs (client_id, logged_date, sleep_hours, sleep_quality, soreness, energy, stress, modalities)
  select c_kai, current_date - d,
         6.0 + random(), 5 + (random() * 3)::int, 4 + (random() * 3)::int,
         5 + (random() * 3)::int, 5 + (random() * 3)::int, array['sauna']
  from generate_series(0, 6) as d;

  insert into training_sessions (client_id, scheduled_at, completed_at, session_type, duration_min, rpe)
  values
    (c_kai, now() - interval '2 days', now() - interval '2 days', 'sparring', 90, 8),
    (c_kai, now() - interval '4 days', now() - interval '4 days', 'conditioning', 60, 7);

  insert into competitions (client_id, coach_id, name, federation, location, competition_date, weight_class, status)
  values (c_kai, v_coach, 'Apex FC 42 — Title Fight', 'Apex FC', 'Las Vegas, NV',
          current_date + 11, '-170 (Welterweight)', 'registered')
  returning id into v_comp;

  insert into weight_cuts (
    client_id, coach_id, competition_id, discipline, class_name, class_limit_lbs,
    walk_around_lbs, camp_start_lbs, target_weigh_in_lbs,
    weigh_in_at, competition_at, rehydration_window_hours, cut_method,
    status, water_load_plan, hydration_restoration, refuel_protocol, notes
  ) values (
    c_kai, v_coach, v_comp, 'mma', 'Welterweight', 170,
    191, 185, 170,
    (current_date + 10)::timestamptz + time '09:00',
    (current_date + 11)::timestamptz + time '17:00',
    32, 'Water load + sauna',
    'active',
    '[{"day_offset":5,"label":"Water load","water_oz":256,"sodium":"High (3-4 g)","notes":"2 gal/day"},
      {"day_offset":4,"label":"Water load","water_oz":256,"sodium":"High (3-4 g)"},
      {"day_offset":3,"label":"Water load","water_oz":224,"sodium":"Moderate"},
      {"day_offset":2,"label":"Begin taper","water_oz":128,"sodium":"Low","notes":"Cut sodium"},
      {"day_offset":1,"label":"Cut water","water_oz":32,"sodium":"None","notes":"Sips only; sauna"},
      {"day_offset":0,"label":"Weigh-in day","water_oz":0,"sodium":"None","notes":"No fluids until scale"}]'::jsonb,
    '[{"hour_offset":0,"label":"After scale","fluid_oz":24,"electrolytes":"Na 1000 mg + K 300 mg"},
      {"hour_offset":1,"label":"Hour 1","fluid_oz":16,"electrolytes":"Electrolyte mix"},
      {"hour_offset":2,"label":"Hour 2","fluid_oz":20,"electrolytes":"Na 800 mg"},
      {"hour_offset":4,"label":"Hour 4","fluid_oz":20},
      {"hour_offset":8,"label":"Hour 8","fluid_oz":24}]'::jsonb,
    '[{"hour_offset":0,"label":"Fast carbs","carbs_g":60,"protein_g":0,"food":"Sports drink + simple carbs"},
      {"hour_offset":1,"label":"Light meal","carbs_g":80,"protein_g":30,"food":"Rice + lean protein"},
      {"hour_offset":3,"label":"Meal 2","carbs_g":100,"protein_g":35,"food":"Pasta + chicken"},
      {"hour_offset":6,"label":"Meal 3","carbs_g":90,"protein_g":30,"food":"Familiar pre-comp meal"}]'::jsonb,
    'Title fight; disciplined water load underway.'
  )
  returning id into v_cut;

  insert into weigh_ins (weight_cut_id, client_id, kind, scheduled_at, target_lbs, weight_lbs, made_weight, recorded_at, notes) values
    (v_cut, c_kai, 'check_in', (now() - interval '7 days'), 170, 186.0, false, now() - interval '7 days', 'Camp start check'),
    (v_cut, c_kai, 'check_in', (now() - interval '3 days'), 170, 181.5, false, now() - interval '3 days', 'On pace'),
    (v_cut, c_kai, 'check_in', now(), 170, 179.0, false, now(), 'Begin water load'),
    (v_cut, c_kai, 'official', (current_date + 10)::timestamptz + time '09:00', 170, null, null, null, 'Official weigh-in');

  insert into alerts (coach_id, client_id, rule_key, severity, title, detail) values
    (v_coach, c_kai, 'weigh_in_approaching', 'info',
     'Kai Tanaka — weigh-in in 10 days',
     'Apex FC 42 welterweight title fight. Water load protocol active.'),
    (v_coach, c_kai, 'cut_off_pace', 'warning',
     'Kai Tanaka — ~9 lb remaining to 170',
     'Monitor descent through peak week; reassess sodium taper.');

  insert into tasks (coach_id, client_id, title, status, priority, due_date) values
    (v_coach, c_kai, 'Confirm Kai''s sauna/water-load schedule', 'open', 'high', current_date + 2);

  raise notice 'Demo seed complete for coach %', v_coach;
end $$;
