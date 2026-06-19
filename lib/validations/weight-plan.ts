import { z } from "zod"

const optNum = z
  .union([z.literal(""), z.null(), z.undefined(), z.coerce.number()])
  .transform((v) => (typeof v === "number" ? v : null))

const reqDate = z
  .string()
  .min(1, "Required")
  .refine((v) => /^\d{4}-\d{2}-\d{2}/.test(v), "Invalid date")
  .transform((v) => v.slice(0, 10))

const optText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null))

export const weightPlanSchema = z
  .object({
    current_weight: z.coerce.number().positive("Enter a current weight").max(1500),
    goal_weight: z.coerce.number().positive("Enter a goal weight").max(1500),
    competition_weight: optNum,
    start_date: reqDate,
    target_date: reqDate,
    competition_id: z
      .string()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    notes: optText,
  })
  .refine(
    (d) => Date.parse(`${d.target_date}T00:00:00Z`) > Date.parse(`${d.start_date}T00:00:00Z`),
    { message: "Target date must be after the start date", path: ["target_date"] }
  )

export type WeightPlanInput = z.infer<typeof weightPlanSchema>
