import { z } from "zod"

import type { RosterClientInput } from "@/lib/data/client-repo"

const optText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null))

const optNum = z
  .union([z.coerce.number().positive(), z.literal(""), z.undefined()])
  .transform((v) => (v === "" || v === undefined ? null : Number(v)))

const optDate = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null))

export const rosterClientSchema = z
  .object({
    first_name: z.string().trim().min(1, "First name is required").max(80),
    last_name: z.string().trim().min(1, "Last name is required").max(80),
    email: z
      .string()
      .trim()
      .email("Enter a valid email")
      .optional()
      .or(z.literal(""))
      .transform((v) => (v ? v : null)),
    phone: optText,
    sport: optText,
    weight_class: optText,
    current_weight: optNum,
    goal_weight: optNum,
    next_competition: optText,
    competition_date: optDate,
    coach_notes: optText,
  })
  .transform(
    (v): RosterClientInput => ({
      firstName: v.first_name,
      lastName: v.last_name,
      email: v.email,
      phone: v.phone,
      sport: v.sport,
      weightClass: v.weight_class,
      currentWeight: v.current_weight,
      goalWeight: v.goal_weight,
      nextCompetition: v.next_competition,
      competitionDate: v.competition_date,
      coachNotes: v.coach_notes,
    })
  )
