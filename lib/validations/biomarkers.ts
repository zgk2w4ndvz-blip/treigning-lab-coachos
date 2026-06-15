import { z } from "zod"

export const BIOMARKER_CATEGORIES = ["recovery", "performance", "blood", "other"] as const

const optText = z
  .string()
  .trim()
  .max(120)
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

export const biomarkerSchema = z.object({
  label: z.string().trim().min(1, "Marker name is required").max(120),
  value_num: optNum,
  value_text: optText,
  unit: optText,
  category: z.enum(BIOMARKER_CATEGORIES).default("other"),
  measured_at: optDateTime,
})

export type BiomarkerInput = z.infer<typeof biomarkerSchema>

/** Normalize a human label into a marker key, e.g. "Vitamin D" → "vitamin_d". */
export function toMarkerKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
}
