// ============================================================================
// Pure weight-planning math. No I/O, no ambient state — unit-tested directly.
// Drives the derived summary, the weekly projection, and nutrition targets.
//
// Formulas are deliberately simple and transparent (NOT AI): linear weight
// projection over the plan span, the standard 3500 kcal ≈ 1 lb fat energy
// equivalence, ~1 g protein per lb of goal weight, and a BMR×activity estimate
// only when no prescribed nutrition baseline exists. Potassium has no agreed
// formula, so it is left unset (null) rather than invented.
// ============================================================================

const DAY = 86_400_000
export const KCAL_PER_LB = 3500
export const PROTEIN_G_PER_LB = 1.0
/** BMR → maintenance multiplier used only when no nutrition plan is prescribed. */
export const MAINTENANCE_ACTIVITY_FACTOR = 1.5
/** Weekly rate (lb) above which a cut is flagged "aggressive". */
export const AGGRESSIVE_LB_PER_WEEK = 2

const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100

/** Whole days between two yyyy-MM-dd dates (date-only, timezone-agnostic). */
export function daysBetween(startDate: string, endDate: string): number {
  const s = Date.parse(`${startDate.slice(0, 10)}T00:00:00Z`)
  const e = Date.parse(`${endDate.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(s) || Number.isNaN(e)) return 0
  return Math.round((e - s) / DAY)
}

/** Plan span in whole weeks (>= 1 when the dates are valid and ordered). */
export function totalWeeks(startDate: string, targetDate: string): number | null {
  const d = daysBetween(startDate, targetDate)
  if (d <= 0) return null
  return Math.max(1, Math.round(d / 7))
}

/** Weeks from `from` (default today) to the target date, clamped at 0. */
export function weeksRemaining(targetDate: string, from: Date = new Date()): number {
  const days = daysBetween(from.toISOString(), targetDate)
  return Math.max(0, round1(days / 7))
}

export type PlanDirection = "cut" | "gain" | "maintain"
export function planDirection(current: number, goal: number): PlanDirection {
  if (current > goal) return "cut"
  if (current < goal) return "gain"
  return "maintain"
}

/** Pounds still to change toward the goal (positive magnitude). */
export function poundsRemaining(current: number, goal: number): number {
  return round1(Math.abs(current - goal))
}

/** Average lb/week implied by the plan span (magnitude). Null if span invalid. */
export function poundsPerWeek(
  current: number,
  goal: number,
  startDate: string,
  targetDate: string
): number | null {
  const weeks = totalWeeks(startDate, targetDate)
  if (!weeks) return null
  return round2(Math.abs(current - goal) / weeks)
}

/** Daily calorie deficit (cut) / surplus magnitude for a given lb/week. */
export function dailyCalorieDeficit(lbPerWeek: number | null): number | null {
  if (lbPerWeek == null) return null
  return Math.round((lbPerWeek * KCAL_PER_LB) / 7)
}

/** Maintenance calories: prescribed nutrition plan first, else BMR×activity. */
export function maintenanceCalories(opts: {
  nutritionCalories?: number | null
  bmr?: number | null
}): { calories: number | null; basis: "nutrition_plan" | "bmr_estimate" | "unknown" } {
  if (opts.nutritionCalories != null) {
    return { calories: Math.round(opts.nutritionCalories), basis: "nutrition_plan" }
  }
  if (opts.bmr != null) {
    return { calories: Math.round(opts.bmr * MAINTENANCE_ACTIVITY_FACTOR), basis: "bmr_estimate" }
  }
  return { calories: null, basis: "unknown" }
}

/** Daily calorie target = maintenance − deficit (for a cut) / + surplus (gain). */
export function dailyCalorieTarget(
  maintenance: number | null,
  dailyDelta: number | null,
  direction: PlanDirection
): number | null {
  if (maintenance == null || dailyDelta == null) return null
  if (direction === "cut") return Math.round(maintenance - dailyDelta)
  if (direction === "gain") return Math.round(maintenance + dailyDelta)
  return Math.round(maintenance)
}

/** Protein target (g) ≈ 1 g per lb of goal weight. */
export function proteinTargetG(goalWeight: number): number {
  return Math.round(goalWeight * PROTEIN_G_PER_LB)
}

export interface ProjectionPoint {
  week_index: number
  week_start: string // yyyy-MM-dd
  target_weight: number
  calorie_target: number | null
  protein_target_g: number | null
  potassium_target_mg: number | null
}

/** yyyy-MM-dd of `startDate` + `weeks*7` days (date-only, UTC-anchored). */
function addWeeks(startDate: string, weeks: number): string {
  const t = Date.parse(`${startDate.slice(0, 10)}T00:00:00Z`) + weeks * 7 * DAY
  return new Date(t).toISOString().slice(0, 10)
}

/**
 * Linear weekly projection from current (week 0) to goal (final week), inclusive.
 * Each row carries the (constant) daily calorie + protein targets; potassium is
 * left null. Returns [] when the plan span is invalid.
 */
export function buildProjection(
  plan: {
    current_weight: number
    goal_weight: number
    start_date: string
    target_date: string
  },
  nutrition: { dailyCalorieTarget: number | null; proteinTargetG: number | null }
): ProjectionPoint[] {
  const weeks = totalWeeks(plan.start_date, plan.target_date)
  if (!weeks) return []
  const out: ProjectionPoint[] = []
  for (let w = 0; w <= weeks; w++) {
    const frac = w / weeks
    const weight = round1(plan.current_weight + (plan.goal_weight - plan.current_weight) * frac)
    out.push({
      week_index: w,
      week_start: addWeeks(plan.start_date, w),
      target_weight: weight,
      calorie_target: nutrition.dailyCalorieTarget,
      protein_target_g: nutrition.proteinTargetG,
      potassium_target_mg: null,
    })
  }
  return out
}
