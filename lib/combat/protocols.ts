// ============================================================================
// Combat sports domain logic — readiness scoring + protocol templates.
// Pure functions (no I/O) so they run on both server and client.
// ============================================================================

import type {
  CombatDiscipline,
  ReadinessLevel,
  ReadinessScore,
  RefuelStep,
  RehydrationStep,
  WaterLoadDay,
  WeighInKind,
  WeightCutStatus,
} from "@/types/models"

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))
const round = (n: number) => Math.round(n)

export const DISCIPLINE_LABELS: Record<CombatDiscipline, string> = {
  mma: "MMA",
  boxing: "Boxing",
  bjj: "Brazilian Jiu-Jitsu",
  wrestling: "Wrestling",
  judo: "Judo",
  muay_thai: "Muay Thai",
  kickboxing: "Kickboxing",
  other: "Other",
}

export const CUT_STATUS_LABELS: Record<WeightCutStatus, string> = {
  planning: "Planning",
  active: "Active",
  peak_week: "Peak week",
  weigh_in: "Weigh-in",
  completed: "Completed",
  cancelled: "Cancelled",
}

export const WEIGH_IN_KIND_LABELS: Record<WeighInKind, string> = {
  check_in: "Check-in",
  official: "Official",
  unofficial: "Unofficial",
}

// ---------------------------------------------------------------------------
// Readiness score
// ---------------------------------------------------------------------------

export interface ReadinessInput {
  currentLbs: number | null
  targetLbs: number
  weighInAt: string | Date | null
  hydrationLogs7d: number
  recoveryLogs7d: number
  avgSleepHours: number | null
  trainingCompleted14d: number
}

const WEIGHTS = {
  weight: 0.35,
  safety: 0.2,
  hydration: 0.15,
  recovery: 0.15,
  training: 0.15,
} as const

function levelFor(score: number): ReadinessLevel {
  if (score >= 75) return "on_track"
  if (score >= 55) return "watch"
  return "at_risk"
}

export function computeReadiness(input: ReadinessInput): ReadinessScore {
  const { currentLbs, targetLbs, weighInAt } = input

  const daysToWeighIn =
    weighInAt != null
      ? Math.max(
          0,
          Math.ceil(
            (new Date(weighInAt).getTime() - Date.now()) / 86_400_000
          )
        )
      : null

  const weightToGoLbs =
    currentLbs != null ? Math.max(0, currentLbs - targetLbs) : null
  const pctBodyweightToGo =
    currentLbs != null && currentLbs > 0
      ? (Math.max(0, currentLbs - targetLbs) / currentLbs) * 100
      : null

  const flags: string[] = []

  // --- weight component (pace-adjusted proximity) --------------------------
  let weight = 70
  if (pctBodyweightToGo != null) {
    if (weightToGoLbs === 0) {
      weight = 100
    } else if (daysToWeighIn != null) {
      const capacity = 8 + daysToWeighIn * 0.5 // % BW safely removable
      const deficit = Math.max(0, pctBodyweightToGo - capacity)
      weight = clamp(100 - deficit * 15)
    } else {
      weight = clamp(100 - pctBodyweightToGo * 6)
    }
  }

  // --- safety component (cut aggressiveness) -------------------------------
  let safety = 80
  if (pctBodyweightToGo != null) {
    const perDay =
      daysToWeighIn != null
        ? pctBodyweightToGo / Math.max(1, daysToWeighIn)
        : pctBodyweightToGo / 7
    safety = clamp(100 - Math.max(0, perDay - 0.5) * 55)
    if (perDay > 1) flags.push("Cut pace exceeds 1% bodyweight/day — high risk")
  }

  // --- logging-based components --------------------------------------------
  const hydration = clamp((Math.min(input.hydrationLogs7d, 7) / 7) * 100)
  const coverage = (Math.min(input.recoveryLogs7d, 7) / 7) * 100
  const recovery =
    input.avgSleepHours != null
      ? round(0.5 * coverage + 0.5 * clamp((input.avgSleepHours / 8) * 100))
      : round(coverage)
  const training = clamp((Math.min(input.trainingCompleted14d, 8) / 8) * 100)

  const overall = round(
    weight * WEIGHTS.weight +
      safety * WEIGHTS.safety +
      hydration * WEIGHTS.hydration +
      recovery * WEIGHTS.recovery +
      training * WEIGHTS.training
  )

  if (weightToGoLbs === 0) flags.push("At or under target weight")
  if (pctBodyweightToGo != null && pctBodyweightToGo > 10)
    flags.push("Large amount to cut (>10% bodyweight)")
  if (daysToWeighIn != null && daysToWeighIn <= 7)
    flags.push("Weigh-in within a week")
  if (hydration < 50) flags.push("Low hydration logging this week")
  if (recovery < 50) flags.push("Recovery under-logged or poor")

  return {
    overall,
    level: levelFor(overall),
    components: {
      weight: round(weight),
      safety: round(safety),
      hydration: round(hydration),
      recovery: round(recovery),
      training: round(training),
    },
    flags,
    weightToGoLbs,
    daysToWeighIn,
    pctBodyweightToGo:
      pctBodyweightToGo != null ? round(pctBodyweightToGo * 10) / 10 : null,
  }
}

// ---------------------------------------------------------------------------
// Protocol templates
// ---------------------------------------------------------------------------

/** Standard 5-day water-load taper into weigh-in. */
export function generateWaterLoadPlan(): WaterLoadDay[] {
  return [
    { day_offset: 5, label: "Water load", water_oz: 256, sodium: "High (3–4 g)", notes: "Begin overloading; 2 gal/day" },
    { day_offset: 4, label: "Water load", water_oz: 256, sodium: "High (3–4 g)" },
    { day_offset: 3, label: "Water load", water_oz: 224, sodium: "Moderate" },
    { day_offset: 2, label: "Begin taper", water_oz: 128, sodium: "Low", notes: "Cut sodium; reduce fluids" },
    { day_offset: 1, label: "Cut water", water_oz: 32, sodium: "None", notes: "Sips only; passive sweat if needed" },
    { day_offset: 0, label: "Weigh-in day", water_oz: 0, sodium: "None", notes: "No fluids until on the scale" },
  ]
}

/**
 * Post-weigh-in rehydration over the available recovery window.
 * Front-loads fluids; caps steps inside the window (hours to competition).
 */
export function generateRehydrationProtocol(windowHours: number | null): RehydrationStep[] {
  const window = windowHours && windowHours > 0 ? windowHours : 24
  const base: RehydrationStep[] = [
    { hour_offset: 0, label: "Immediately after scale", fluid_oz: 24, electrolytes: "Na 1000 mg + K 300 mg", notes: "Sip, don't gulp" },
    { hour_offset: 0.5, label: "First 30 min", fluid_oz: 16, electrolytes: "Electrolyte mix" },
    { hour_offset: 1, label: "Hour 1", fluid_oz: 16, electrolytes: "Electrolyte mix" },
    { hour_offset: 2, label: "Hour 2", fluid_oz: 20, electrolytes: "Na 800 mg" },
    { hour_offset: 4, label: "Hour 4", fluid_oz: 20 },
    { hour_offset: 8, label: "Hour 8", fluid_oz: 24 },
    { hour_offset: 12, label: "Hour 12", fluid_oz: 24, notes: "Reassess urine color" },
  ]
  return base.filter((s) => s.hour_offset <= window)
}

/** Post-weigh-in carbohydrate + sodium refueling across the window. */
export function generateRefuelProtocol(windowHours: number | null): RefuelStep[] {
  const window = windowHours && windowHours > 0 ? windowHours : 24
  const base: RefuelStep[] = [
    { hour_offset: 0, label: "Fast carbs", carbs_g: 60, sodium_mg: 1000, food: "Sports drink + simple carbs", notes: "Easy on the gut" },
    { hour_offset: 1, label: "Light meal", carbs_g: 80, protein_g: 30, food: "Rice + lean protein", notes: "Low fat/fiber" },
    { hour_offset: 3, label: "Meal 2", carbs_g: 100, protein_g: 35, food: "Pasta + chicken" },
    { hour_offset: 6, label: "Meal 3", carbs_g: 90, protein_g: 30, food: "Familiar pre-comp meal" },
    { hour_offset: 12, label: "Evening", carbs_g: 70, protein_g: 25, food: "Balanced; hydrate alongside" },
  ]
  return base.filter((s) => s.hour_offset <= window)
}

/** Hours between weigh-in and competition (rehydration window). */
export function rehydrationWindowHours(
  weighInAt: string | Date | null,
  competitionAt: string | Date | null
): number | null {
  if (!weighInAt || !competitionAt) return null
  const diff =
    (new Date(competitionAt).getTime() - new Date(weighInAt).getTime()) /
    3_600_000
  return diff > 0 ? Math.round(diff * 10) / 10 : null
}
