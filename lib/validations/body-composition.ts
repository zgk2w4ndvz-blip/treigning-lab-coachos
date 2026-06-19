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

export const bodyCompSchema = z.object({
  weight_lbs: z.coerce.number().positive("Enter a weight").max(1500),
  body_fat_pct: optNum,
  body_fat_mass_lbs: optNum,
  bmr: optNum,
  total_body_water_lbs: optNum,
  skeletal_muscle_mass_lbs: optNum,
  logged_at: optDateTime,
  notes: optText,
})

export type BodyCompInput = z.infer<typeof bodyCompSchema>
