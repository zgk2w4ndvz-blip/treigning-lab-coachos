// ============================================================================
// Pure metabolic-assessment metrics: heart-rate training zones derived from a
// max HR, and the zone a given bpm falls into. No server-only import, so this
// runs under tsx and is unit-tested directly. Used by the data layer + UI.
// ============================================================================

import type { HeartRateZone } from "@/types/models"

/** 5-zone model as percentages of max HR (lower-inclusive, upper-inclusive). */
export const HR_ZONE_DEFS: { zone: number; label: string; pctLow: number; pctHigh: number }[] = [
  { zone: 1, label: "Recovery", pctLow: 50, pctHigh: 60 },
  { zone: 2, label: "Aerobic", pctLow: 60, pctHigh: 70 },
  { zone: 3, label: "Tempo", pctLow: 70, pctHigh: 80 },
  { zone: 4, label: "Threshold", pctLow: 80, pctHigh: 90 },
  { zone: 5, label: "VO2 Max", pctLow: 90, pctHigh: 100 },
]

/**
 * Heart-rate zones (bpm ranges) for a given max HR. Returns [] when maxHr is
 * missing or non-positive so callers can render an empty state.
 */
export function heartRateZones(maxHr: number | null): HeartRateZone[] {
  if (maxHr == null || maxHr <= 0) return []
  return HR_ZONE_DEFS.map((d) => ({
    ...d,
    minBpm: Math.round((maxHr * d.pctLow) / 100),
    maxBpm: Math.round((maxHr * d.pctHigh) / 100),
  }))
}

/**
 * Which zone number a bpm falls into for a given max HR, or null if outside the
 * modeled range (< Z1 floor or maxHr unknown). Boundaries favor the higher zone
 * (e.g. exactly 70% of max → Zone 3), matching the inclusive-low convention.
 */
export function zoneForBpm(maxHr: number | null, bpm: number | null): number | null {
  if (maxHr == null || maxHr <= 0 || bpm == null) return null
  const pct = (bpm / maxHr) * 100
  if (pct < HR_ZONE_DEFS[0].pctLow) return null
  // Highest zone whose lower bound is <= pct.
  let found: number | null = null
  for (const d of HR_ZONE_DEFS) {
    if (pct >= d.pctLow) found = d.zone
  }
  return found
}
