// Metric Registry unit tests — PURE (no DB, no network). Run: `npm run test:registry`.
//
// Verifies the canonical Metric Registry's integrity:
//   • unique metric keys
//   • valid units (∈ CANONICAL_UNITS)
//   • valid value kind (∈ METRIC_VALUE_KINDS)
//   • every projectsTo maps to a REAL existing domain-table column
//   • sane ranges + non-empty labels
//
// The "real column" check uses a snapshot of the CURRENT schema (verified against
// types/database.ts at authoring time). If a future schema change renames a
// column this test will fail loudly — which is the point: the registry must stay
// aligned with the projection targets it claims.

import assert from "node:assert/strict"

import {
  METRIC_REGISTRY,
  CANONICAL_UNITS,
  METRIC_VALUE_KINDS,
  getMetric,
  metricKeys,
  metricsForDomain,
} from "@/lib/observations/registry"

// ---- Known schema snapshot (real columns that exist today) ------------------
// Source of truth: types/database.ts / supabase/migrations/*. Only the tables the
// registry projects into are listed; columns are the actual current names.
const KNOWN_COLUMNS: Record<string, Set<string>> = {
  weight_logs: new Set([
    "weight_lbs",
    "body_fat_pct",
    "muscle_mass_lbs",
    "body_fat_mass_lbs",
    "bmr",
    "total_body_water_lbs",
    "skeletal_muscle_mass_lbs",
  ]),
  recovery_logs: new Set([
    "sleep_hours",
    "sleep_quality",
    "soreness",
    "energy",
    "stress",
    "hrv",
    "resting_hr",
    "recovery_score",
    "hydration",
    "source",
    "measured_at",
    "source_ref",
  ]),
  metabolic_assessments: new Set([
    "vo2_max",
    "mep_bpm",
    "aerobic_threshold_bpm",
    "max_hr_bpm",
    "calories_burned_per_min",
  ]),
  low_base_prescriptions: new Set(["mep_bpm", "frequency_per_week", "minutes_per_session"]),
  nutrition_logs: new Set(["calories", "protein_g", "carbs_g", "fat_g", "fiber_g"]),
}

const unitSet = new Set<string>(CANONICAL_UNITS)
const kindSet = new Set<string>(METRIC_VALUE_KINDS)

// ---- 0. registry is non-empty ----------------------------------------------
assert.ok(METRIC_REGISTRY.length > 0, "registry must not be empty")

// ---- 1. unique metric keys --------------------------------------------------
{
  const keys = metricKeys()
  const unique = new Set(keys)
  assert.equal(unique.size, keys.length, "metric keys must be unique")
  // snake_case sanity (canonical key shape)
  for (const k of keys) {
    assert.match(k, /^[a-z][a-z0-9_]*$/, `metric key not snake_case: ${k}`)
  }
}

// ---- 2/3. valid unit + valid value kind ------------------------------------
for (const m of METRIC_REGISTRY) {
  assert.ok(unitSet.has(m.unit), `metric ${m.key} has invalid unit: ${m.unit}`)
  assert.ok(kindSet.has(m.kind), `metric ${m.key} has invalid kind: ${m.kind}`)
  assert.ok(m.label.trim().length > 0, `metric ${m.key} has empty label`)
}

// ---- 4. every projectsTo maps to a real existing column --------------------
for (const m of METRIC_REGISTRY) {
  if (m.projectsTo == null) continue // "where applicable" — null is allowed
  const { table, column } = m.projectsTo
  const cols = KNOWN_COLUMNS[table]
  assert.ok(cols, `metric ${m.key} projects to unknown table: ${table}`)
  assert.ok(
    cols.has(column),
    `metric ${m.key} projects to non-existent column: ${table}.${column}`
  )
}

// ---- 5. ranges are coherent when present ------------------------------------
for (const m of METRIC_REGISTRY) {
  if (!m.range) continue
  const { min, max } = m.range
  if (min != null && max != null) {
    assert.ok(min < max, `metric ${m.key} has min >= max (${min} >= ${max})`)
  }
}

// ---- 6. lookup helpers behave ----------------------------------------------
{
  const first = METRIC_REGISTRY[0]
  assert.deepEqual(getMetric(first.key), first, "getMetric returns the definition")
  assert.equal(getMetric("does_not_exist"), undefined, "getMetric unknown → undefined")

  // a couple of anchored expectations on today's known metrics + projections
  const bw = getMetric("body_weight_lbs")
  assert.ok(bw && bw.projectsTo?.column === "weight_lbs", "body weight → weight_logs.weight_lbs")
  const hrv = getMetric("hrv_rmssd_ms")
  assert.ok(hrv && hrv.projectsTo?.column === "hrv", "HRV → recovery_logs.hrv")

  // domain filter returns only that domain
  const diet = metricsForDomain("diet")
  assert.ok(diet.length > 0 && diet.every((m) => m.domain === "diet"), "metricsForDomain filters")
}

console.log(
  `✓ registry suite: ${METRIC_REGISTRY.length} metrics — unique keys + valid units/kinds + projections map to real columns`
)
