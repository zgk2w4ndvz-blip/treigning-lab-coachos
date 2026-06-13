// ============================================================================
// Alert engine — evaluates a single athlete's recent data against the rule set
// and produces alerts. Pure + synchronous; the data layer feeds it.
// Output uses the full `Alert` shape so existing UI can render it directly.
// ============================================================================

import { DEFAULT_RULES, RULE_META, type RuleKey } from "@/lib/alerts/rules-config"
import type {
  Alert,
  Competition,
  HydrationLog,
  NutritionLog,
  NutritionPlan,
  RecoveryLog,
  TrainingSession,
  WeightGoal,
  WeightLog,
} from "@/types/models"

const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0

export interface CombatSignal {
  weighInAt: string | null
  targetLbs: number
  currentLbs: number | null
  readinessOverall: number
}

export interface AlertEvalInput {
  clientId: string
  clientName: string
  weightLogs: WeightLog[] // ascending by date
  weightGoal: WeightGoal | null
  hydration: HydrationLog[] // ascending by date
  recovery: RecoveryLog[] // ascending by date
  nextCompetition: Competition | null
  combat?: CombatSignal | null
  nutritionPlan?: NutritionPlan | null
  nutritionLogs?: NutritionLog[] // ascending by date
  training?: TrainingSession[]
}

const DAY = 86_400_000
const daysSince = (iso: string) =>
  Math.floor((Date.now() - new Date(iso).getTime()) / DAY)
const daysUntil = (iso: string) =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / DAY)

function mkAlert(
  input: AlertEvalInput,
  key: RuleKey,
  title: string,
  detail: string
): Alert {
  return {
    id: `${input.clientId}:${key}`,
    coach_id: "",
    client_id: input.clientId,
    rule_key: key,
    severity: RULE_META[key].severity,
    status: "active",
    title,
    detail,
    context: {},
    created_at: new Date().toISOString(),
    acknowledged_at: null,
    resolved_at: null,
    snoozed_until: null,
  }
}

/** Evaluate every rule against one athlete; returns triggered alerts. */
export function evaluateAlerts(input: AlertEvalInput): Alert[] {
  const out: Alert[] = []
  const name = input.clientName

  // -- missed weigh-in -------------------------------------------------------
  const latestWeight = input.weightLogs.at(-1)
  if (latestWeight) {
    const d = daysSince(latestWeight.logged_at)
    if (d > DEFAULT_RULES.missed_weigh_in.days) {
      out.push(
        mkAlert(
          input,
          "missed_weigh_in",
          `${name} — no weigh-in for ${d} days`,
          `Last weight logged ${d} days ago. Nudge to resume tracking.`
        )
      )
    }
  }

  // -- low hydration ---------------------------------------------------------
  {
    const { days, pct } = DEFAULT_RULES.low_hydration
    const recent = input.hydration.slice(-days)
    if (recent.length >= days) {
      const ratios = recent
        .filter((h) => h.oz_target && h.oz_target > 0)
        .map((h) => h.oz_consumed / (h.oz_target as number))
      if (ratios.length > 0) {
        const avg = (ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100
        if (avg < pct) {
          out.push(
            mkAlert(
              input,
              "low_hydration",
              `${name} — hydration under ${pct}% target`,
              `Averaging ${Math.round(avg)}% of target over the last ${days} days.`
            )
          )
        }
      }
    }
  }

  // -- poor sleep ------------------------------------------------------------
  {
    const { hours, nights } = DEFAULT_RULES.poor_sleep
    const recent = input.recovery.slice(-nights)
    if (
      recent.length >= nights &&
      recent.every((r) => r.sleep_hours != null && r.sleep_hours < hours)
    ) {
      out.push(
        mkAlert(
          input,
          "poor_sleep",
          `${name} — sleep under ${hours}h for ${nights} nights`,
          `Recovery is compromised; check stressors and schedule.`
        )
      )
    }
  }

  // -- high soreness ---------------------------------------------------------
  {
    const { level, days } = DEFAULT_RULES.high_soreness
    const recent = input.recovery.slice(-days)
    if (
      recent.length >= days &&
      recent.every((r) => r.soreness != null && r.soreness >= level)
    ) {
      out.push(
        mkAlert(
          input,
          "high_soreness",
          `${name} — soreness ≥ ${level} for ${days} days`,
          `Consider deloading or added recovery modalities.`
        )
      )
    }
  }

  // -- competition countdown -------------------------------------------------
  if (input.nextCompetition) {
    const d = daysUntil(input.nextCompetition.competition_date)
    if (d >= 0 && d <= DEFAULT_RULES.competition_countdown.days) {
      out.push(
        mkAlert(
          input,
          "competition_countdown",
          `${name} — competition in ${d} day${d === 1 ? "" : "s"}`,
          `${input.nextCompetition.name}. Begin peak/taper planning.`
        )
      )
    }
  }

  // -- weight off track ------------------------------------------------------
  if (
    input.weightGoal?.target_weight != null &&
    input.weightGoal.target_date &&
    latestWeight
  ) {
    const { tolerance_lbs, within_days } = DEFAULT_RULES.weight_off_track
    const dTarget = daysUntil(input.weightGoal.target_date)
    const gap = Math.abs(latestWeight.weight_lbs - input.weightGoal.target_weight)
    if (dTarget >= 0 && dTarget <= within_days && gap > tolerance_lbs) {
      out.push(
        mkAlert(
          input,
          "weight_off_track",
          `${name} — ${gap.toFixed(1)} lb from goal with ${dTarget}d left`,
          `Goal ${input.weightGoal.target_weight} lb (${input.weightGoal.direction}). Reassess plan.`
        )
      )
    }
  }

  // -- nutrition: low protein / under-eating --------------------------------
  if (input.nutritionPlan && (input.nutritionLogs?.length ?? 0) > 0) {
    const plan = input.nutritionPlan
    const logs = input.nutritionLogs as NutritionLog[]

    if (plan.protein_g) {
      const { pct, days } = DEFAULT_RULES.low_protein
      const vals = logs
        .slice(-days)
        .map((l) => l.protein_g)
        .filter((n): n is number => n != null)
      if (vals.length >= days) {
        const avgP = mean(vals)
        if (avgP < (plan.protein_g * pct) / 100) {
          out.push(
            mkAlert(
              input,
              "low_protein",
              `${name} — protein ${Math.round(avgP)}g vs ${plan.protein_g}g target`,
              `Averaging ${Math.round((avgP / plan.protein_g) * 100)}% of protein target over ${days} days.`
            )
          )
        }
      }
    }

    if (plan.calories) {
      const { pct, days } = DEFAULT_RULES.low_calories
      const vals = logs
        .slice(-days)
        .map((l) => l.calories)
        .filter((n): n is number => n != null)
      if (vals.length >= days) {
        const avgC = mean(vals)
        if (avgC < (plan.calories * pct) / 100) {
          out.push(
            mkAlert(
              input,
              "low_calories",
              `${name} — calories ${Math.round(avgC)} vs ${plan.calories} target`,
              `Under-eating at ${Math.round((avgC / plan.calories) * 100)}% of target; watch performance + recovery.`
            )
          )
        }
      }
    }
  }

  // -- training: missed sessions --------------------------------------------
  if (input.training && input.training.length > 0) {
    const { days } = DEFAULT_RULES.missed_training
    const since = Date.now() - days * DAY
    const due = input.training.filter(
      (s) =>
        s.scheduled_at &&
        new Date(s.scheduled_at).getTime() <= Date.now() &&
        new Date(s.scheduled_at).getTime() >= since
    )
    const done = due.filter((s) => s.completed_at != null)
    if (due.length >= 1 && done.length === 0) {
      out.push(
        mkAlert(
          input,
          "missed_training",
          `${name} — no training completed in ${days} days`,
          `${due.length} scheduled session${due.length === 1 ? "" : "s"} not marked complete.`
        )
      )
    }
  }

  // -- combat: weigh-in / cut signals ---------------------------------------
  const c = input.combat
  if (c && c.weighInAt) {
    const d = daysUntil(c.weighInAt)
    const toGoLbs = c.currentLbs != null ? Math.max(0, c.currentLbs - c.targetLbs) : null
    const pctToGo =
      c.currentLbs != null && c.currentLbs > 0
        ? (Math.max(0, c.currentLbs - c.targetLbs) / c.currentLbs) * 100
        : null

    if (d >= 0 && d <= DEFAULT_RULES.weigh_in_approaching.days) {
      out.push(
        mkAlert(
          input,
          "weigh_in_approaching",
          `${name} — weigh-in in ${d} day${d === 1 ? "" : "s"}`,
          `Confirm water-load and rehydration protocols.`
        )
      )
    }

    if (pctToGo != null && d >= 0) {
      const perDay = pctToGo / Math.max(1, d)
      if (perDay > DEFAULT_RULES.aggressive_weight_cut.max_pct_per_day) {
        out.push(
          mkAlert(
            input,
            "aggressive_weight_cut",
            `${name} — cut pace ${perDay.toFixed(2)}%/day`,
            `${toGoLbs?.toFixed(1)} lb to lose in ${d}d exceeds the 1%/day safe limit.`
          )
        )
      }
    }

    if (
      toGoLbs != null &&
      toGoLbs > DEFAULT_RULES.cut_off_pace.tolerance_lbs &&
      d > DEFAULT_RULES.cut_off_pace.after_days
    ) {
      out.push(
        mkAlert(
          input,
          "cut_off_pace",
          `${name} — ${toGoLbs.toFixed(1)} lb remaining to target`,
          `Monitor the descent through peak week.`
        )
      )
    }

    if (
      c.readinessOverall < DEFAULT_RULES.low_readiness.score &&
      d >= 0 &&
      d <= DEFAULT_RULES.low_readiness.days
    ) {
      out.push(
        mkAlert(
          input,
          "low_readiness",
          `${name} — readiness ${c.readinessOverall} near weigh-in`,
          `Readiness below ${DEFAULT_RULES.low_readiness.score} with ${d}d to weigh-in.`
        )
      )
    }
  }

  return out
}

const SEVERITY_RANK: Record<Alert["severity"], number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

/** Sort alerts by severity (critical first). */
export function sortBySeverity(alerts: Alert[]): Alert[] {
  return [...alerts].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
  )
}
