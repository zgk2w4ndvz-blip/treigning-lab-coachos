import { z } from "zod"

const optText = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null))

export const lowBaseSchema = z.object({
  mep_bpm: z.coerce
    .number()
    .min(60, "Too low")
    .max(220, "Too high")
    .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "Max 2 decimal places"),
  frequency_per_week: z.coerce.number().int("Whole number").min(1, "At least 1").max(14, "Too many"),
  minutes_per_session: z.coerce.number().int("Whole number").min(1, "At least 1").max(300, "Too long"),
  notes: optText,
})

export type LowBaseInput = z.infer<typeof lowBaseSchema>
