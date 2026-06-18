// ============================================================================
// Pure metabolic (Stat Tracker) metrics. No server-only import, so this runs
// under tsx and is unit-tested directly. Used by the data layer + UI.
//
// The Stat Tracker shows a single training Zone built from the Set Point (MEP),
// NOT a generic %-of-max-HR zone model. Verified against the app:
//   Set Point 170.58 → Zone 161–181   (round(160.58)=161, round(180.58)=181)
//   Set Point 153.00 → Zone 143–163
// This is identical to the Low Base range (MEP ± 10), displayed rounded.
// ============================================================================

import type { MetabolicZone } from "@/types/models"

/** Half-width of the Set Point zone, in bpm (MEP ± ZONE_RADIUS). */
export const ZONE_RADIUS_BPM = 10

/**
 * Training Zone from the Set Point (MEP): round(MEP − 10) … round(MEP + 10).
 * Returns null when the Set Point is unknown.
 */
export function setPointZone(setPointBpm: number | null): MetabolicZone | null {
  if (setPointBpm == null) return null
  return {
    low: Math.round(setPointBpm - ZONE_RADIUS_BPM),
    high: Math.round(setPointBpm + ZONE_RADIUS_BPM),
  }
}
