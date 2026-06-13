import { z } from "zod"

export const TASK_TYPES = [
  "nutrition",
  "hydration",
  "supplements",
  "recovery",
  "weight_cut",
  "competition",
  "communication",
  "training",
  "general",
] as const

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const

/** Sentinel for the "no athlete / general" Select option (Radix forbids ""). */
export const NO_CLIENT = "__none__"

const optional = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""))

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: optional(1000),
  clientId: optional(64),
  type: z.enum(TASK_TYPES).default("general"),
  priority: z.enum(PRIORITIES).default("medium"),
  dueDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
    .optional()
    .or(z.literal("")),
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>
