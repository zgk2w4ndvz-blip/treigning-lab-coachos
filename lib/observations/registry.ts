// ============================================================================
// CoachOS L2 Spine — Canonical Metric Registry  (RFC: ARCHITECTURE_L2_SPINE.md §2.3)
//
// The single, typed source of truth for every metric the Observation Store can
// hold. A connector, the AI normalizer, and the (future) projection layer all
// agree on names/units/kinds THROUGH THIS FILE — adding a signal is adding an
// entry here, not growing a bespoke write path.
//
// P0 SCOPE: code-only. No schema, no DB access, no runtime behavior. This module
// is pure data + types and is intentionally NOT imported into any live path yet.
// It enumerates ONLY metrics CoachOS already handles today, each mapped to the
// real domain-table column it will project to under coexistence [D1].
// ============================================================================

/** How an observation's value is stored. */
export type MetricValueKind = "num" | "text" | "json"

/** Canonical L2 domains — a superset of today's `suggestion_domain` enum. The DB
 *  enum is introduced in P1; this code-level union is the contract until then. */
export type ObservationDomain =
  | "body_composition"
  | "recovery"
  | "metabolic"
  | "low_base"
  | "diet"
  | "hydration"

/** The closed set of canonical units. Keeping this a union (not free text) is
 *  what lets the registry test assert "valid unit" structurally. */
export type CanonicalUnit =
  | "lbs"
  | "pct"
  | "kcal"
  | "kcal_per_min"
  | "ms"
  | "bpm"
  | "score"
  | "min"
  | "per_week"
  | "g"
  | "ml_per_kg_min"

/** Where a committed observation projects in the existing schema (coexistence
 *  layer, [D1]). `null` would mean "no legacy projection" — none today. */
export interface ProjectionTarget {
  table: string
  column: string
}

/** One canonical metric definition. */
export interface MetricDefinition {
  /** Stable canonical key (snake_case). The L2 `observations.metric` value. */
  key: string
  domain: ObservationDomain
  unit: CanonicalUnit
  kind: MetricValueKind
  /** Human label for UI/debugging. */
  label: string
  /** Soft sanity bounds for the numeric value (validation/anomaly hints only —
   *  never a hard gate; coaches can always override on approval). */
  range?: { min?: number; max?: number }
  /** Existing domain-table column this metric projects to, or null. */
  projectsTo: ProjectionTarget | null
}

// ----------------------------------------------------------------------------
// The registry. Ordered by domain for readability. Every entry below maps to a
// column that EXISTS in the current schema (verified against types/database.ts).
// ----------------------------------------------------------------------------

export const METRIC_REGISTRY: readonly MetricDefinition[] = [
  // ---- Body composition → weight_logs (body-comp fields, migration 0005) ----
  {
    key: "body_weight_lbs",
    domain: "body_composition",
    unit: "lbs",
    kind: "num",
    label: "Body weight",
    range: { min: 50, max: 600 },
    projectsTo: { table: "weight_logs", column: "weight_lbs" },
  },
  {
    key: "body_fat_pct",
    domain: "body_composition",
    unit: "pct",
    kind: "num",
    label: "Body fat",
    range: { min: 1, max: 60 },
    projectsTo: { table: "weight_logs", column: "body_fat_pct" },
  },
  {
    key: "body_fat_mass_lbs",
    domain: "body_composition",
    unit: "lbs",
    kind: "num",
    label: "Fat mass",
    range: { min: 1, max: 300 },
    projectsTo: { table: "weight_logs", column: "body_fat_mass_lbs" },
  },
  {
    key: "skeletal_muscle_mass_lbs",
    domain: "body_composition",
    unit: "lbs",
    kind: "num",
    label: "Skeletal muscle mass (SMM)",
    range: { min: 10, max: 200 },
    projectsTo: { table: "weight_logs", column: "skeletal_muscle_mass_lbs" },
  },
  {
    key: "total_body_water_lbs",
    domain: "body_composition",
    unit: "lbs",
    kind: "num",
    label: "Total body water",
    range: { min: 10, max: 200 },
    projectsTo: { table: "weight_logs", column: "total_body_water_lbs" },
  },
  {
    key: "basal_metabolic_rate_kcal",
    domain: "body_composition",
    unit: "kcal",
    kind: "num",
    label: "Basal metabolic rate (BMR)",
    range: { min: 500, max: 4000 },
    projectsTo: { table: "weight_logs", column: "bmr" },
  },

  // ---- Recovery → recovery_logs (migrations 0001 + 0025) --------------------
  {
    key: "hrv_rmssd_ms",
    domain: "recovery",
    unit: "ms",
    kind: "num",
    label: "HRV (RMSSD)",
    range: { min: 1, max: 300 },
    projectsTo: { table: "recovery_logs", column: "hrv" },
  },
  {
    key: "resting_hr_bpm",
    domain: "recovery",
    unit: "bpm",
    kind: "num",
    label: "Resting heart rate",
    range: { min: 25, max: 150 },
    projectsTo: { table: "recovery_logs", column: "resting_hr" },
  },
  {
    key: "recovery_score",
    domain: "recovery",
    unit: "score",
    kind: "num",
    label: "Recovery score",
    range: { min: 0, max: 100 },
    projectsTo: { table: "recovery_logs", column: "recovery_score" },
  },
  {
    key: "recovery_hydration_pct",
    domain: "recovery",
    unit: "pct",
    kind: "num",
    label: "Hydration (recovery)",
    range: { min: 0, max: 100 },
    projectsTo: { table: "recovery_logs", column: "hydration" },
  },

  // ---- Metabolic assessment → metabolic_assessments (migration 0018) --------
  {
    key: "vo2_max",
    domain: "metabolic",
    unit: "ml_per_kg_min",
    kind: "num",
    label: "VO2 max",
    range: { min: 10, max: 90 },
    projectsTo: { table: "metabolic_assessments", column: "vo2_max" },
  },
  {
    key: "metabolic_set_point_bpm",
    domain: "metabolic",
    unit: "bpm",
    kind: "num",
    label: "Metabolic set point (MEP)",
    range: { min: 60, max: 220 },
    projectsTo: { table: "metabolic_assessments", column: "mep_bpm" },
  },
  {
    key: "aerobic_threshold_bpm",
    domain: "metabolic",
    unit: "bpm",
    kind: "num",
    label: "Aerobic threshold",
    range: { min: 60, max: 220 },
    projectsTo: { table: "metabolic_assessments", column: "aerobic_threshold_bpm" },
  },
  {
    key: "max_hr_bpm",
    domain: "metabolic",
    unit: "bpm",
    kind: "num",
    label: "Max heart rate",
    range: { min: 100, max: 230 },
    projectsTo: { table: "metabolic_assessments", column: "max_hr_bpm" },
  },
  {
    key: "calories_burned_per_min",
    domain: "metabolic",
    unit: "kcal_per_min",
    kind: "num",
    label: "Calories burned per minute",
    range: { min: 1, max: 40 },
    projectsTo: { table: "metabolic_assessments", column: "calories_burned_per_min" },
  },

  // ---- Low Base prescription → low_base_prescriptions (migration 0013) ------
  {
    key: "low_base_mep_bpm",
    domain: "low_base",
    unit: "bpm",
    kind: "num",
    label: "Low Base MEP",
    range: { min: 60, max: 220 },
    projectsTo: { table: "low_base_prescriptions", column: "mep_bpm" },
  },
  {
    key: "low_base_minutes_per_session",
    domain: "low_base",
    unit: "min",
    kind: "num",
    label: "Low Base minutes per session",
    range: { min: 1, max: 240 },
    projectsTo: { table: "low_base_prescriptions", column: "minutes_per_session" },
  },
  {
    key: "low_base_frequency_per_week",
    domain: "low_base",
    unit: "per_week",
    kind: "num",
    label: "Low Base frequency per week",
    range: { min: 1, max: 14 },
    projectsTo: { table: "low_base_prescriptions", column: "frequency_per_week" },
  },

  // ---- Nutrition macros → nutrition_logs (migration 0001) -------------------
  {
    key: "nutrition_calories",
    domain: "diet",
    unit: "kcal",
    kind: "num",
    label: "Calories",
    range: { min: 0, max: 10000 },
    projectsTo: { table: "nutrition_logs", column: "calories" },
  },
  {
    key: "nutrition_protein_g",
    domain: "diet",
    unit: "g",
    kind: "num",
    label: "Protein",
    range: { min: 0, max: 1000 },
    projectsTo: { table: "nutrition_logs", column: "protein_g" },
  },
  {
    key: "nutrition_carbs_g",
    domain: "diet",
    unit: "g",
    kind: "num",
    label: "Carbohydrates",
    range: { min: 0, max: 2000 },
    projectsTo: { table: "nutrition_logs", column: "carbs_g" },
  },
  {
    key: "nutrition_fat_g",
    domain: "diet",
    unit: "g",
    kind: "num",
    label: "Fat",
    range: { min: 0, max: 1000 },
    projectsTo: { table: "nutrition_logs", column: "fat_g" },
  },
  {
    key: "nutrition_fiber_g",
    domain: "diet",
    unit: "g",
    kind: "num",
    label: "Fiber",
    range: { min: 0, max: 500 },
    projectsTo: { table: "nutrition_logs", column: "fiber_g" },
  },
] as const

/** All valid canonical units, derived for validation/tests. */
export const CANONICAL_UNITS: readonly CanonicalUnit[] = [
  "lbs",
  "pct",
  "kcal",
  "kcal_per_min",
  "ms",
  "bpm",
  "score",
  "min",
  "per_week",
  "g",
  "ml_per_kg_min",
]

/** All valid value kinds, derived for validation/tests. */
export const METRIC_VALUE_KINDS: readonly MetricValueKind[] = ["num", "text", "json"]

/** Indexed lookup by canonical key. */
const REGISTRY_BY_KEY: ReadonlyMap<string, MetricDefinition> = new Map(
  METRIC_REGISTRY.map((m) => [m.key, m])
)

/** Look up a metric definition by its canonical key, or undefined if unknown. */
export function getMetric(key: string): MetricDefinition | undefined {
  return REGISTRY_BY_KEY.get(key)
}

/** Every canonical metric key in the registry. */
export function metricKeys(): string[] {
  return METRIC_REGISTRY.map((m) => m.key)
}

/** All metrics in a given domain. */
export function metricsForDomain(domain: ObservationDomain): MetricDefinition[] {
  return METRIC_REGISTRY.filter((m) => m.domain === domain)
}
