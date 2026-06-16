-- ============================================================================
-- 0010_body_composition_suggestion_domain.sql
--
-- Message ingestion can now extract structured body-weight measurements from an
-- athlete's message (e.g. "Morning weight 128.4, evening 130.1") and propose
-- them as suggested weight-log entries. Those suggestions need a domain of
-- their own so the approval queue labels them correctly and the approval step
-- can route them to `weight_logs` (via suggested_actions.details.action =
-- 'create_weight_log') instead of creating a prescription.
--
-- Additive / non-destructive: adds one enum value. Not used elsewhere in this
-- migration, so adding it in the same transaction is safe on PG12+.
-- ============================================================================

alter type suggestion_domain add value if not exists 'body_composition';
