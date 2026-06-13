// ============================================================================
// Per-domain compliance scoring (0–100). Pure functions used by the athlete
// detail pages. Each blends logging consistency with hitting targets.
// ============================================================================

import { compliancePct } from "@/lib/utils/format"
import type {
  HydrationLog,
  NutritionLog,
  NutritionPlan,
  RecoveryLog,
  Supplement,
  SupplementLog,
  TrainingSession,
  WeightLog,
} from "@/types/models"

const avg = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0

/** Symmetric adherence: 100 when actual == target, falling off either side. */
function adherence(actual: number | null, target: number | null): number | null {
  if (actual == null || !target) return null
  const ratio = actual / target
  return compliancePct((1 - Math.min(1, Math.abs(1 - ratio))) * 100)
}

/** Weight: logging cadence over the window (target ≈ every other day). */
export function weightCompliance(logs: WeightLog[], windowDays: number): number {
  const expected = Math.max(1, Math.round(windowDays / 2))
  const distinctDays = new Set(logs.map((l) => l.logged_at.slice(0, 10))).size
  return compliancePct((Math.min(distinctDays, expected) / expected) * 100)
}

/** Nutrition: average adherence to calorie + macro targets. */
export function nutritionCompliance(
  plan: NutritionPlan | null,
  logs: NutritionLog[]
): number {
  if (!plan || logs.length === 0) return 0
  const recent = logs.slice(-7)
  const parts = [
    adherence(avg(recent.map((l) => l.calories ?? 0)), plan.calories),
    adherence(avg(recent.map((l) => l.protein_g ?? 0)), plan.protein_g),
    adherence(avg(recent.map((l) => l.carbs_g ?? 0)), plan.carbs_g),
    adherence(avg(recent.map((l) => l.fat_g ?? 0)), plan.fat_g),
  ].filter((n): n is number => n != null)
  return parts.length ? compliancePct(avg(parts)) : 0
}

/** Hydration: average % of target hit over the window. */
export function hydrationCompliance(logs: HydrationLog[]): number {
  const ratios = logs
    .filter((l) => l.oz_target && l.oz_target > 0)
    .map((l) => Math.min(1.1, l.oz_consumed / (l.oz_target as number)))
  return ratios.length ? compliancePct(avg(ratios) * 100) : 0
}

/** Recovery: logging coverage blended with sleep adequacy (target 8h). */
export function recoveryCompliance(
  logs: RecoveryLog[],
  windowDays: number
): number {
  if (logs.length === 0) return 0
  const coverage = Math.min(1, logs.length / windowDays)
  const sleepVals = logs
    .map((l) => l.sleep_hours)
    .filter((n): n is number => n != null)
  const sleepScore = sleepVals.length ? Math.min(1, avg(sleepVals) / 8) : 0.5
  return compliancePct((coverage * 0.5 + sleepScore * 0.5) * 100)
}

/** Supplements: doses taken vs expected over the window. */
export function supplementCompliance(
  supplements: Supplement[],
  logs: SupplementLog[],
  windowDays: number
): number {
  const active = supplements.filter((s) => s.is_active)
  if (active.length === 0) return 0
  const expected = active.length * windowDays
  const taken = logs.filter(
    (l) => l.taken && active.some((s) => s.id === l.supplement_id)
  ).length
  return compliancePct((Math.min(taken, expected) / expected) * 100)
}

/** Training: share of scheduled sessions completed. */
export function trainingCompliance(sessions: TrainingSession[]): number {
  if (sessions.length === 0) return 0
  const due = sessions.filter(
    (s) => s.scheduled_at && new Date(s.scheduled_at).getTime() <= Date.now()
  )
  if (due.length === 0) return 100
  const done = due.filter((s) => s.completed_at != null).length
  return compliancePct((done / due.length) * 100)
}

export function complianceAccent(
  score: number
): "success" | "warning" | "critical" {
  return score >= 80 ? "success" : score >= 50 ? "warning" : "critical"
}
