import { z } from "zod"

const optNum = z
  .union([z.coerce.number(), z.literal(""), z.undefined(), z.null()])
  .transform((v) => (v === "" || v === undefined || v === null ? null : Number(v)))

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

/** A single measured curve point (one test stage / load). */
export const curvePointSchema = z.object({
  stage: z.coerce.number().int().min(0),
  intensity: optNum,
  heart_rate_bpm: optNum,
  ventilation_l_min: optNum,
  vo2: optNum,
})

export type CurvePointInput = z.infer<typeof curvePointSchema>

/**
 * A metabolic assessment. Scalar fields come from the form; `points` is a JSON
 * string (a serialized CurvePointInput[]) produced by the client form's curve
 * editor. Empty / malformed JSON yields no points rather than an error.
 */
export const metabolicSchema = z.object({
  vo2_max: optNum,
  mep_bpm: optNum,
  aerobic_threshold_bpm: optNum,
  max_hr_bpm: optNum,
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
