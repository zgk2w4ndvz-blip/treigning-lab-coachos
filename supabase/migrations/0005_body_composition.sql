-- ============================================================================
-- Body composition fields on weight_logs.
-- Extends the basic weigh-in (weight + body fat %) into a full body composition
-- measurement: fat mass, BMR, total body water, and skeletal muscle mass.
-- All nullable so existing/partial measurements never break.
-- ============================================================================

alter table weight_logs
  add column if not exists body_fat_mass_lbs        numeric(6,2),
  add column if not exists bmr                      numeric(7,1),
  add column if not exists total_body_water_lbs     numeric(6,2),
  add column if not exists skeletal_muscle_mass_lbs numeric(6,2);
