import { z } from "zod"

export const SESSION_TYPES = [
  "training",
  "consultation",
  "check_in",
  "competition_prep",
  "follow_up",
  "group_session",
] as const

export const SESSION_MODALITIES = ["in_person", "virtual", "phone"] as const

export const SESSION_STATUSES = [
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
] as const

export const SESSION_TYPE_LABELS: Record<(typeof SESSION_TYPES)[number], string> = {
  training: "Training",
  consultation: "Consultation",
  check_in: "Check-in",
  competition_prep: "Competition Prep",
  follow_up: "Follow-up",
  group_session: "Group Session",
}

export const SESSION_MODALITY_LABELS: Record<(typeof SESSION_MODALITIES)[number], string> = {
  in_person: "In person",
  virtual: "Virtual",
  phone: "Phone",
}

/** Sentinel for the "no athlete / general" Select option. */
export const NO_CLIENT = "__none__"

/** Sentinel for the "no modality" Select option (Radix forbids empty string values). */
export const NO_MODALITY = "__none_modality__"

const optional = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""))

export const createSessionSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  clientId: optional(64),
  sessionType: z.enum(SESSION_TYPES).default("training"),
  scheduledDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
    .refine((d) => d >= new Date().toISOString().slice(0, 10) || true, "Date is in the past"),
  scheduledTime: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "Use HH:MM format"),
  durationMin: z.coerce
    .number()
    .int()
    .min(5, "Minimum 5 minutes")
    .max(480, "Maximum 8 hours")
    .default(60),
  location: optional(200),
  modality: z.enum(SESSION_MODALITIES).optional().or(z.literal(NO_MODALITY)),
  notes: optional(2000),
})

export type CreateSessionInput = z.infer<typeof createSessionSchema>
