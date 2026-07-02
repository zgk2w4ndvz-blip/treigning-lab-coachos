import { z } from "zod"

export const CALENDAR_CATEGORIES = [
  "strength", "conditioning", "sport", "low_base", "supplementation", "altolab",
  "nutrition", "hydration", "recovery", "testing", "labs", "weigh_in",
  "competition", "check_in", "note",
] as const

const optText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null))

// Timezone-naive wall-clock from <input type="datetime-local">. We keep the
// wall-clock string here and convert it to a UTC instant in the action using
// the operating timezone — NEVER parse it with `new Date()` (which would bind it
// to the ambient runtime zone, i.e. UTC on the server). See lib/calendar/timezone.
const WALL_CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

const optWallClock = z
  .string()
  .optional()
  .transform((v) => (v && WALL_CLOCK.test(v) ? v : null))

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
    .refine((v) => WALL_CLOCK.test(v), "Invalid date/time"),
  ends_at: optWallClock,
  // Checkbox: unchecked inputs are omitted from FormData entirely, so the key
  // can be absent. `.optional()` is required for a missing key under zod v4
  // (a bare union with z.undefined() still treats the field as nonoptional).
  all_day: z
    .union([z.literal("on"), z.literal("")])
    .optional()
    .transform((v) => v === "on"),
  status: z.enum(["planned", "completed", "skipped"]).default("planned"),
  recurrence: z.enum(["none", "daily", "weekly"]).default("none"),
  recurrence_until: optDate,
})

export type CalendarEventInput = z.infer<typeof calendarEventSchema>
