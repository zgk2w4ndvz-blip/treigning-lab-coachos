import { z } from "zod"

// NOTE: the empty/null/undefined branches MUST precede z.coerce.number(), or
// coercion eats "" and null into 0 (Number("") === 0) before they can map to
// null. Order matters — a union returns the first matching member.
const optNum = z
  .union([z.literal(""), z.null(), z.undefined(), z.coerce.number()])
  .transform((v) => (typeof v === "number" ? v : null))

const optDateTime = z
  .string()
  .optional()
  .transform((v) => {
    if (!v) return null
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  })

const optText = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null))

/** A single curve sample (time-series point within one test phase). */
export const curvePointSchema = z.object({
  phase: z.enum(["increase", "decrease"]),
  stage: z.coerce.number().int().min(0),
  elapsed_sec: optNum,
  heart_rate_bpm: optNum,
  ventilation_l_min: optNum,
  vo2: optNum,
})

export type CurvePointInput = z.infer<typeof curvePointSchema>

/**
 * A metabolic ("Stat Tracker") assessment. `source` is the Cart vs Manual Cart
 * origin; `points` is a JSON string (serialized CurvePointInput[]) produced by
 * the client curve editor. Empty / malformed JSON yields no points (not an error).
 */
export const metabolicSchema = z.object({
  source: z.enum(["cart", "manual_cart"]).default("manual_cart"),
  vo2_max: optNum,
  mep_bpm: optNum, // "Set Point"
  aerobic_threshold_bpm: optNum, // "Aerobic"
  max_hr_bpm: optNum,
  calories_burned_per_min: optNum, // Manual Cart only
  assessed_at: optDateTime,
  notes: optText,
  points: z
    .string()
    .optional()
    .transform((v): CurvePointInput[] => {
      if (!v) return []
      try {
        const raw = JSON.parse(v)
        if (!Array.isArray(raw)) return []
        return raw
          .map((p) => curvePointSchema.safeParse(p))
          .filter((r): r is { success: true; data: CurvePointInput } => r.success)
          .map((r) => r.data)
      } catch {
        return []
      }
    }),
})

export type MetabolicInput = z.infer<typeof metabolicSchema>
