import { z } from "zod"

// NOTE: the empty/null/undefined branches MUST precede z.coerce.number(), or
// coercion eats "" and null into 0 (Number("") === 0) before they can map to
// null — blank optional fields would persist as 0. Order matters: a union
// returns the first matching member. Explicit "0" still parses to 0.
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

export const measurementSchema = z.object({
  waist_in: optNum,
  hips_in: optNum,
  chest_in: optNum,
  shoulder_in: optNum,
  thigh_in: optNum,
  calves_in: optNum,
  wrist_in: optNum,
  ankle_in: optNum,
  neck_in: optNum,
  bicep_in: optNum,
  height_in: optNum,
  measured_at: optDateTime,
  notes: optText,
})

export type MeasurementInput = z.infer<typeof measurementSchema>
