import { z } from "zod"

export const CALENDAR_CATEGORIES = [
  "strength", "conditioning", "sport", "low_base", "supplementation", "altolab",
  "nutrition", "hydration", "recovery", "testing", "weigh_in", "competition",
  "check_in", "note",
] as const

const optText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null))

const toIso = (v: string) => {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

const optDateTime = z
  .string()
  .optional()
  .transform((v) => (v ? toIso(v) : null))

const optDate = z
  .string()
  .optional()
  .transform((v) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null))

export const calendarEventSchema = z.object({
  category: z.enum(CALENDAR_CATEGORIES),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: optText,
  starts_at: z
    .string()
    .min(1, "Start date/time is required")
    .transform((v, ctx) => {
      const iso = toIso(v)
      if (!iso) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date/time" })
        return z.NEVER
      }
      return iso
    }),
  ends_at: optDateTime,
  all_day: z
    .union([z.literal("on"), z.literal(""), z.undefined()])
    .transform((v) => v === "on"),
  status: z.enum(["planned", "completed", "skipped"]).default("planned"),
  recurrence: z.enum(["none", "daily", "weekly"]).default("none"),
  recurrence_until: optDate,
})

export type CalendarEventInput = z.infer<typeof calendarEventSchema>
