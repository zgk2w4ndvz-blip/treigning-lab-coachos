import { z } from "zod"

const optNum = z
  .union([z.coerce.number(), z.literal(""), z.undefined()])
  .transform((v) => (v === "" || v === undefined ? null : Number(v)))

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
