-- ============================================================================
-- Seed: global default alert rules (coach_id = null = applies to all coaches
-- unless overridden). Config drives the evaluator in lib/alerts/rules.ts.
-- ============================================================================

insert into alert_rules (coach_id, key, description, severity, config) values
  (null, 'missed_weigh_in',
   'No weight logged for N days',
   'critical',
   '{"days": 3}'::jsonb),

  (null, 'low_hydration',
   'Hydration below target percentage for N consecutive days',
   'warning',
   '{"pct": 50, "days": 3}'::jsonb),

  (null, 'poor_sleep',
   'Sleep below N hours for M consecutive nights',
   'warning',
   '{"hours": 6, "nights": 3}'::jsonb),

  (null, 'high_soreness',
   'Soreness at or above threshold for N consecutive days',
   'warning',
   '{"level": 8, "days": 2}'::jsonb),

  (null, 'competition_countdown',
   'Competition within N days',
   'info',
   '{"days": 14}'::jsonb),

  (null, 'weight_off_track',
   'Weight trending away from goal beyond tolerance',
   'warning',
   '{"tolerance_lbs": 3}'::jsonb)
on conflict do nothing;
