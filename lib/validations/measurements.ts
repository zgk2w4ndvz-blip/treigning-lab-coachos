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
