import { z } from "zod"

export const combatDisciplineEnum = z.enum([
  "mma",
  "boxing",
  "bjj",
  "wrestling",
  "judo",
  "muay_thai",
  "kickboxing",
  "other",
])

export const weightCutStatusEnum = z.enum([
  "planning",
  "active",
  "peak_week",
  "weigh_in",
  "completed",
  "cancelled",
])

export const weighInKindEnum = z.enum(["check_in", "official", "unofficial"])

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null))

const optionalNumber = z
  .union([z.coerce.number(), z.literal(""), z.undefined()])
  .transform((v) => (v === "" || v === undefined ? null : Number(v)))

const optionalDateTime = z
  .string()
  .optional()
  .transform((v) => {
    if (!v || v.length === 0) return null
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  })

const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null))

export const weightCutFormSchema = z.object({
  client_id: z.string().uuid(),
  discipline: combatDisciplineEnum.default("mma"),
  weight_class_id: optionalUuid,
  competition_id: optionalUuid,
  class_name: optionalText,
  class_limit_lbs: z.coerce.number().positive("Required"),
  target_weigh_in_lbs: z.coerce.number().positive("Required"),
  walk_around_lbs: optionalNumber,
  camp_start_lbs: optionalNumber,
  weigh_in_at: optionalDateTime,
  competition_at: optionalDateTime,
  cut_method: optionalText,
  status: weightCutStatusEnum.default("planning"),
  notes: optionalText,
})

export type WeightCutFormValues = z.output<typeof weightCutFormSchema>

export const weighInFormSchema = z.object({
  kind: weighInKindEnum.default("check_in"),
  scheduled_at: z
    .string()
    .min(1, "Date/time is required")
    .transform((v) => new Date(v).toISOString()),
  target_lbs: optionalNumber,
  weight_lbs: optionalNumber,
  notes: optionalText,
})

export type WeighInFormValues = z.output<typeof weighInFormSchema>
