import { z } from "zod"

const optNum = z
  .union([z.coerce.number(), z.literal(""), z.undefined()])
  .transform((v) => (v === "" || v === undefined ? null : Number(v)))

const score10 = z
  .union([z.coerce.number().min(1).max(10), z.literal(""), z.undefined()])
  .transform((v) => (v === "" || v === undefined ? null : Number(v)))

export const weightEntrySchema = z.object({
  weight_lbs: z.coerce.number().positive("Enter your weight").max(1500),
})

export const hydrationEntrySchema = z.object({
  /** Ounces to add to today's running total. */
  oz: z.coerce.number().positive("Enter an amount").max(400),
})

export const nutritionEntrySchema = z.object({
  calories: optNum,
  protein: optNum,
  carbs: optNum,
  fat: optNum,
})

export const recoveryEntrySchema = z.object({
  sleep_hours: z
    .union([z.coerce.number().min(0).max(24), z.literal(""), z.undefined()])
    .transform((v) => (v === "" || v === undefined ? null : Number(v))),
  soreness: score10,
  energy: score10,
  stress: score10,
})

export type WeightEntryInput = z.infer<typeof weightEntrySchema>
export type HydrationEntryInput = z.infer<typeof hydrationEntrySchema>
export type NutritionEntryInput = z.infer<typeof nutritionEntrySchema>
export type RecoveryEntryInput = z.infer<typeof recoveryEntrySchema>
