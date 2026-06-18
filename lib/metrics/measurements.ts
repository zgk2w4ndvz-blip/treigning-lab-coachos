// ============================================================================
// Pure measurement-derived metrics. Used by the data layer and tested directly
// (no server-only import, so it runs under tsx). Both ratios are unitless and
// only defined when their inputs are present and the denominator is positive.
// ============================================================================

const round2 = (n: number) => Math.round(n * 100) / 100

/** Hip-to-waist ratio (hips ÷ waist). Null unless both present & waist > 0. */
export function hipWaistRatio(m: {
  hips_in: number | null
  waist_in: number | null
}): number | null {
  if (m.hips_in == null || m.waist_in == null || m.waist_in <= 0) return null
  return round2(m.hips_in / m.waist_in)
}

/**
 * Hip/Waist percent (hips ÷ waist × 100), as shown on the Stat Tracker "Tape"
 * card (values like 98%, 101%). Isolated here so the orientation/formula can be
 * changed in one place if the real definition turns out different. Null unless
 * both present & waist > 0. Rounded to 2 decimals.
 */
export function hipWaistPercent(m: {
  hips_in: number | null
  waist_in: number | null
}): number | null {
  if (m.hips_in == null || m.waist_in == null || m.waist_in <= 0) return null
  return round2((m.hips_in / m.waist_in) * 100)
}

/** Waist-to-height ratio (waist ÷ height). Null unless both present & height > 0. */
export function waistHeightRatio(m: {
  waist_in: number | null
  height_in: number | null
}): number | null {
  if (m.waist_in == null || m.height_in == null || m.height_in <= 0) return null
  return round2(m.waist_in / m.height_in)
}
