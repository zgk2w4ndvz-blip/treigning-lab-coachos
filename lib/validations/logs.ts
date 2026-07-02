import { z } from "zod"

const optText = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null))

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

const score10 = z
  .union([z.coerce.number().min(1).max(10), z.literal(""), z.undefined()])
  .transform((v) => (v === "" || v === undefined ? null : Number(v)))

export const weightLogSchema = z.object({
  weight_lbs: z.coerce.number().positive("Enter a weight"),
  body_fat_pct: optNum,
  logged_at: optDateTime,
  notes: optText,
})

export const hydrationLogSchema = z.object({
  logged_date: z.string().min(1, "Date is required"),
  oz_consumed: z.coerce.number().min(0, "Required"),
  oz_target: optNum,
  notes: optText,
})

export const recoveryLogSchema = z.object({
  logged_date: z.string().min(1, "Date is required"),
  sleep_hours: optNum,
  sleep_quality: score10,
  soreness: score10,
  energy: score10,
  stress: score10,
  notes: optText,
})

export const nutritionLogSchema = z.object({
  logged_date: z.string().min(1, "Date is required"),
  meal_label: optText,
  calories: optNum,
  protein_g: optNum,
  carbs_g: optNum,
  fat_g: optNum,
  notes: optText,
})

export const trainingSessionSchema = z.object({
  scheduled_at: z.string().min(1, "Date/time is required").transform((v) => new Date(v).toISOString()),
  session_type: optText,
  duration_min: optNum,
  rpe: score10,
  // Checkbox: unchecked inputs are omitted from FormData, so the key can be
  // absent — `.optional()` is required under zod v4 (see athlete-calendar.ts).
  completed: z
    .union([z.literal("on"), z.literal("")])
    .optional()
    .transform((v) => v === "on"),
  notes: optText,
})

export const supplementSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  brand: optText,
  dosage: optText,
  frequency: optText,
  timing: optText,
  purpose: optText,
})
