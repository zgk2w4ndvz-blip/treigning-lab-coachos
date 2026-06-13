"use server"

import { revalidatePath } from "next/cache"

import { requireCoach } from "@/lib/auth"
import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { type ActionState, BYPASS_BLOCKED } from "@/lib/actions/types"
import {
  hydrationLogSchema,
  nutritionLogSchema,
  recoveryLogSchema,
  supplementSchema,
  trainingSessionSchema,
  weightLogSchema,
} from "@/lib/validations/logs"
import type { z } from "zod"

type Schema =
  | typeof weightLogSchema
  | typeof hydrationLogSchema
  | typeof recoveryLogSchema
  | typeof nutritionLogSchema
  | typeof trainingSessionSchema
  | typeof supplementSchema

function parse<S extends Schema>(schema: S, formData: FormData) {
  return schema.safeParse(Object.fromEntries(formData.entries())) as
    | { success: true; data: z.infer<S> }
    | { success: false; error: z.ZodError }
}

function fieldErrors(error: z.ZodError): ActionState {
  return {
    ok: false,
    error: "Please fix the highlighted fields.",
    fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
  }
}

async function guard() {
  if (DEV_AUTH_BYPASS) return null
  return requireCoach()
}

export async function createWeightLog(
  clientId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (DEV_AUTH_BYPASS) return BYPASS_BLOCKED
  const coach = await guard()
  const r = parse(weightLogSchema, formData)
  if (!r.success) return fieldErrors(r.error)

  const supabase = await createServerSupabase()
  const { error } = await supabase.from("weight_logs").insert({
    client_id: clientId,
    logged_by: coach?.id ?? null,
    weight_lbs: r.data.weight_lbs,
    body_fat_pct: r.data.body_fat_pct,
    logged_at: r.data.logged_at ?? new Date().toISOString(),
    notes: r.data.notes,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/clients/${clientId}/weight`)
  return { ok: true }
}

export async function createHydrationLog(
  clientId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (DEV_AUTH_BYPASS) return BYPASS_BLOCKED
  await guard()
  const r = parse(hydrationLogSchema, formData)
  if (!r.success) return fieldErrors(r.error)

  const supabase = await createServerSupabase()
  const { error } = await supabase.from("hydration_logs").insert({
    client_id: clientId,
    logged_date: r.data.logged_date,
    oz_consumed: r.data.oz_consumed,
    oz_target: r.data.oz_target,
    notes: r.data.notes,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/clients/${clientId}/hydration`)
  return { ok: true }
}

export async function createRecoveryLog(
  clientId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (DEV_AUTH_BYPASS) return BYPASS_BLOCKED
  await guard()
  const r = parse(recoveryLogSchema, formData)
  if (!r.success) return fieldErrors(r.error)

  const supabase = await createServerSupabase()
  const { error } = await supabase.from("recovery_logs").insert({
    client_id: clientId,
    logged_date: r.data.logged_date,
    sleep_hours: r.data.sleep_hours,
    sleep_quality: r.data.sleep_quality,
    soreness: r.data.soreness,
    energy: r.data.energy,
    stress: r.data.stress,
    notes: r.data.notes,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/clients/${clientId}/recovery`)
  return { ok: true }
}

export async function createNutritionLog(
  clientId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (DEV_AUTH_BYPASS) return BYPASS_BLOCKED
  await guard()
  const r = parse(nutritionLogSchema, formData)
  if (!r.success) return fieldErrors(r.error)

  const supabase = await createServerSupabase()
  const { error } = await supabase.from("nutrition_logs").insert({
    client_id: clientId,
    logged_date: r.data.logged_date,
    meal_label: r.data.meal_label,
    calories: r.data.calories,
    protein_g: r.data.protein_g,
    carbs_g: r.data.carbs_g,
    fat_g: r.data.fat_g,
    notes: r.data.notes,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/clients/${clientId}/nutrition`)
  return { ok: true }
}

export async function createTrainingSession(
  clientId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (DEV_AUTH_BYPASS) return BYPASS_BLOCKED
  await guard()
  const r = parse(trainingSessionSchema, formData)
  if (!r.success) return fieldErrors(r.error)

  const supabase = await createServerSupabase()
  const { error } = await supabase.from("training_sessions").insert({
    client_id: clientId,
    scheduled_at: r.data.scheduled_at,
    completed_at: r.data.completed ? r.data.scheduled_at : null,
    session_type: r.data.session_type,
    duration_min: r.data.duration_min,
    rpe: r.data.rpe,
    notes: r.data.notes,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/clients/${clientId}/training`)
  return { ok: true }
}

export async function createSupplement(
  clientId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (DEV_AUTH_BYPASS) return BYPASS_BLOCKED
  const coach = await guard()
  const r = parse(supplementSchema, formData)
  if (!r.success) return fieldErrors(r.error)

  const supabase = await createServerSupabase()
  const { error } = await supabase.from("supplements").insert({
    client_id: clientId,
    coach_id: coach?.id ?? "",
    name: r.data.name,
    brand: r.data.brand,
    dosage: r.data.dosage,
    frequency: r.data.frequency,
    timing: r.data.timing,
    purpose: r.data.purpose,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/clients/${clientId}/supplements`)
  return { ok: true }
}
