import { z } from "zod"

const optText = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null))

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const optDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null))
  .refine((v) => v == null || DATE_RE.test(v), "Invalid date")

/** One weekly Low Base slot: day-of-week 0–6 + "HH:MM" local time. */
export const lowBaseSlotSchema = z.object({
  day_of_week: z.coerce.number().int().min(0).max(6),
  time: z.string().regex(TIME_RE, "Use HH:MM"),
})

export const lowBaseSchema = z
  .object({
    mep_bpm: z.coerce
      .number()
      .min(60, "Too low")
      .max(220, "Too high")
      .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "Max 2 decimal places"),
    frequency_per_week: z.coerce.number().int("Whole number").min(1, "At least 1").max(14, "Too many"),
    minutes_per_session: z.coerce.number().int("Whole number").min(1, "At least 1").max(300, "Too long"),
    notes: optText,
    start_date: optDate,
    end_date: optDate,
    // The weekly builder is posted as a JSON string of LowBaseSlot[].
    schedule: z
      .string()
      .optional()
      .transform((v) => {
        if (!v) return [] as unknown[]
        try {
          return JSON.parse(v) as unknown[]
        } catch {
          return null
        }
      })
      .pipe(
        z
          .array(lowBaseSlotSchema)
          .max(7, "At most 7 sessions per week")
          .nullable()
          .refine((v) => v !== null, "Invalid schedule")
      ),
  })
  .superRefine((d, ctx) => {
    if (d.start_date && d.end_date && d.end_date < d.start_date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["end_date"], message: "End date is before start date." })
    }
    // A schedule requires a start date to anchor recurrence.
    if (d.schedule && d.schedule.length > 0 && !d.start_date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["start_date"], message: "Set a start date for the schedule." })
    }
  })

export type LowBaseInput = z.infer<typeof lowBaseSchema>
