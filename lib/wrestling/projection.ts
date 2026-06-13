// ============================================================================
// Wrestling cut projection math — pure functions.
// Projects weigh-in weight from the measured loss trend and derives the
// weekly/daily loss targets + on/off-pace + risk classification.
// ============================================================================

export type Pace = "on" | "off" | "unknown"
export type RiskLevel = "low" | "medium" | "high"

export interface WeightPoint {
  date: string // yyyy-MM-dd
  weight: number
}

const DAY = 86_400_000

/** Measured loss rate (lbs/day, positive = losing) from a recent window. */
export function measuredDailyLossRate(
  series: WeightPoint[],
  windowDays = 10
): number | null {
  if (series.length < 2) return null
  const cutoff = Date.now() - windowDays * DAY
  const recent = series.filter((p) => new Date(p.date).getTime() >= cutoff)
  const pts = recent.length >= 2 ? recent : series.slice(-2)
  const first = pts[0]
  const last = pts[pts.length - 1]
  const dayspan =
    (new Date(last.date).getTime() - new Date(first.date).getTime()) / DAY
  if (dayspan <= 0) return null
  // positive when weight is trending down
  return (first.weight - last.weight) / dayspan
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / DAY))
}

export interface ProjectionInput {
  currentLbs: number | null
  targetLbs: number
  weighInAt: string | null
  dailyLossRateLbs: number | null
  /** lbs of overshoot allowed and still considered "on pace" */
  toleranceLbs?: number
}

export interface CutProjection {
  currentLbs: number | null
  projectedLbs: number | null
  toGoLbs: number | null
  daysToWeighIn: number | null
  dailyLossRateLbs: number | null
  weeklyLossTargetLbs: number | null
  dailyLossTargetLbs: number | null
  pctBodyweightPerDay: number | null
  pace: Pace
  paceDeltaLbs: number | null // projected - target (positive = over)
}

export function projectCut(input: ProjectionInput): CutProjection {
  const { currentLbs, targetLbs, weighInAt, dailyLossRateLbs } = input
  const tolerance = input.toleranceLbs ?? 1
  const days = daysUntil(weighInAt)

  const toGo = currentLbs != null ? Math.max(0, currentLbs - targetLbs) : null

  const dailyLossTarget =
    toGo != null && days != null && days > 0 ? toGo / days : toGo // if 0 days, must be off now
  const weeklyLossTarget = dailyLossTarget != null ? dailyLossTarget * 7 : null

  const projected =
    currentLbs != null && days != null && dailyLossRateLbs != null
      ? Math.round((currentLbs - dailyLossRateLbs * days) * 10) / 10
      : null

  const paceDelta = projected != null ? projected - targetLbs : null

  let pace: Pace = "unknown"
  if (toGo === 0) pace = "on"
  else if (paceDelta != null) pace = paceDelta <= tolerance ? "on" : "off"

  const pctPerDay =
    dailyLossTarget != null && currentLbs && currentLbs > 0
      ? (dailyLossTarget / currentLbs) * 100
      : null

  return {
    currentLbs,
    projectedLbs: projected,
    toGoLbs: toGo,
    daysToWeighIn: days,
    dailyLossRateLbs:
      dailyLossRateLbs != null ? Math.round(dailyLossRateLbs * 100) / 100 : null,
    weeklyLossTargetLbs:
      weeklyLossTarget != null ? Math.round(weeklyLossTarget * 10) / 10 : null,
    dailyLossTargetLbs:
      dailyLossTarget != null ? Math.round(dailyLossTarget * 100) / 100 : null,
    pctBodyweightPerDay: pctPerDay != null ? Math.round(pctPerDay * 100) / 100 : null,
    pace,
    paceDeltaLbs: paceDelta != null ? Math.round(paceDelta * 10) / 10 : null,
  }
}

/**
 * Risk from cut aggressiveness (% bodyweight/day required) + readiness.
 * >1.5%/day is the high-risk threshold for rapid water-weight cuts.
 */
export function cutRisk(
  pctBodyweightPerDay: number | null,
  readinessOverall: number
): RiskLevel {
  if (pctBodyweightPerDay != null && pctBodyweightPerDay >= 1.5) return "high"
  if (readinessOverall < 55) return "high"
  if ((pctBodyweightPerDay != null && pctBodyweightPerDay >= 1.0) || readinessOverall < 70)
    return "medium"
  return "low"
}
