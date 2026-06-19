// Weight-planning engine tests. Run: `npm run test:weightplan`.
// Covers the derived summary, calorie math, protein, and weekly projection.

import assert from "node:assert/strict"

import {
  daysBetween,
  totalWeeks,
  weeksRemaining,
  poundsRemaining,
  poundsPerWeek,
  dailyCalorieDeficit,
  maintenanceCalories,
  dailyCalorieTarget,
  proteinTargetG,
  planDirection,
  buildProjection,
} from "@/lib/metrics/weight-plan"

// ---- span + remaining -------------------------------------------------------
assert.equal(daysBetween("2026-06-01", "2026-08-10"), 70)
assert.equal(totalWeeks("2026-06-01", "2026-08-10"), 10) // 70 days → 10 weeks
assert.equal(totalWeeks("2026-06-01", "2026-06-01"), null) // zero span
assert.equal(totalWeeks("2026-08-10", "2026-06-01"), null) // reversed

// weeksRemaining from a fixed "today"
assert.equal(weeksRemaining("2026-08-10", new Date("2026-07-13T12:00:00Z")), 4) // 28 days
assert.equal(weeksRemaining("2026-06-01", new Date("2026-08-10T00:00:00Z")), 0) // past → clamp 0

// ---- direction + pounds -----------------------------------------------------
assert.equal(planDirection(200, 180), "cut")
assert.equal(planDirection(180, 200), "gain")
assert.equal(planDirection(180, 180), "maintain")
assert.equal(poundsRemaining(200, 180), 20)

// ---- rate + deficit ---------------------------------------------------------
// 20 lb over 10 weeks = 2 lb/week
assert.equal(poundsPerWeek(200, 180, "2026-06-01", "2026-08-10"), 2)
// 2 lb/week → 2*3500/7 = 1000 kcal/day
assert.equal(dailyCalorieDeficit(2), 1000)
assert.equal(dailyCalorieDeficit(null), null)

// ---- maintenance + targets --------------------------------------------------
// nutrition plan wins
assert.deepEqual(maintenanceCalories({ nutritionCalories: 2800, bmr: 1800 }), {
  calories: 2800,
  basis: "nutrition_plan",
})
// else BMR × 1.5
assert.deepEqual(maintenanceCalories({ nutritionCalories: null, bmr: 1800 }), {
  calories: 2700,
  basis: "bmr_estimate",
})
assert.deepEqual(maintenanceCalories({ nutritionCalories: null, bmr: null }), {
  calories: null,
  basis: "unknown",
})
// cut subtracts the deficit
assert.equal(dailyCalorieTarget(2800, 1000, "cut"), 1800)
assert.equal(dailyCalorieTarget(2800, 1000, "gain"), 3800)
assert.equal(dailyCalorieTarget(null, 1000, "cut"), null)
// protein ≈ 1 g / lb goal
assert.equal(proteinTargetG(180), 180)

// ---- projection -------------------------------------------------------------
const proj = buildProjection(
  { current_weight: 200, goal_weight: 180, start_date: "2026-06-01", target_date: "2026-08-10" },
  { dailyCalorieTarget: 1800, proteinTargetG: 180 }
)
assert.equal(proj.length, 11) // weeks 0..10 inclusive
assert.equal(proj[0].target_weight, 200) // starts at current
assert.equal(proj[0].week_start, "2026-06-01")
assert.equal(proj[10].target_weight, 180) // ends at goal
assert.equal(proj[10].week_start, "2026-08-10")
assert.equal(proj[5].target_weight, 190) // linear midpoint
assert.equal(proj[0].calorie_target, 1800)
assert.equal(proj[0].protein_target_g, 180)
assert.equal(proj[0].potassium_target_mg, null) // not invented
// invalid span → no rows
assert.deepEqual(
  buildProjection(
    { current_weight: 200, goal_weight: 180, start_date: "2026-06-01", target_date: "2026-06-01" },
    { dailyCalorieTarget: null, proteinTargetG: 180 }
  ),
  []
)

console.log("weight-plan engine tests passed")
