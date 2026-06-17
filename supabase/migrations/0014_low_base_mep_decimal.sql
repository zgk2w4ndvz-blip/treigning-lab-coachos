-- ============================================================================
-- 0014_low_base_mep_decimal.sql
--
-- MEP (Metabolic Efficiency Point) now supports two-decimal precision
-- (e.g. 129.50, 130.25). Widen low_base_prescriptions.mep_bpm from integer to
-- numeric(5,2). The cast is value-preserving (130 → 130.00); numeric(5,2) holds
-- the valid bpm range comfortably.
-- ============================================================================

alter table low_base_prescriptions
  alter column mep_bpm type numeric(5, 2) using mep_bpm::numeric(5, 2);
