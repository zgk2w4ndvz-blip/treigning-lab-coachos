// Default alert-rule thresholds. Mirrors the seeded `alert_rules` rows; the
// engine in lib/alerts/engine.ts reads these to evaluate live athlete data.

import type { Severity } from "@/types/models"

export interface RuleMeta {
  severity: Severity
  label: string
}

export const DEFAULT_RULES = {
  missed_weigh_in: { days: 3 },
  low_hydration: { pct: 50, days: 3 },
  poor_sleep: { hours: 6, nights: 3 },
  high_soreness: { level: 8, days: 2 },
  competition_countdown: { days: 14 },
  weight_off_track: { tolerance_lbs: 3, within_days: 14 },
  low_protein: { pct: 80, days: 5 },
  low_calories: { pct: 80, days: 5 },
  missed_training: { days: 7 },
  weigh_in_approaching: { days: 7 },
  aggressive_weight_cut: { max_pct_per_day: 1.0 },
  cut_off_pace: { tolerance_lbs: 3, after_days: 7 },
  low_readiness: { score: 60, days: 10 },
} as const

export type RuleKey = keyof typeof DEFAULT_RULES

export const RULE_META: Record<RuleKey, RuleMeta> = {
  missed_weigh_in: { severity: "critical", label: "Missed weigh-in" },
  low_hydration: { severity: "warning", label: "Low hydration" },
  poor_sleep: { severity: "warning", label: "Poor sleep" },
  high_soreness: { severity: "warning", label: "High soreness" },
  competition_countdown: { severity: "info", label: "Competition countdown" },
  weight_off_track: { severity: "warning", label: "Weight off track" },
  low_protein: { severity: "warning", label: "Low protein" },
  low_calories: { severity: "info", label: "Under-eating" },
  missed_training: { severity: "warning", label: "Missed training" },
  weigh_in_approaching: { severity: "info", label: "Weigh-in approaching" },
  aggressive_weight_cut: { severity: "critical", label: "Aggressive cut" },
  cut_off_pace: { severity: "warning", label: "Cut off pace" },
  low_readiness: { severity: "warning", label: "Low readiness" },
}
