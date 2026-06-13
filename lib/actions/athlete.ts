"use server"

import { revalidatePath } from "next/cache"

import { getCurrentAthleteClientId } from "@/lib/auth"
import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import {
  getAthleteDay,
  setAthleteSupplement,
  updateAthleteDay,
} from "@/lib/dev-athlete-log-store"
import {
  hydrationEntrySchema,
  nutritionEntrySchema,
  recoveryEntrySchema,
  weightEntrySchema,
} from "@/lib/validations/athlete"
import { todayStr } from "@/lib/utils/format"
import type { ActionState } from "@/lib/actions/types"
import type { z } from "zod"

const AFFECTED = ["/today", "/progress"]

function revalidateAll() {
  for (const p of AFFECTED) revalidatePath(p)
}

function fieldErrors(error: z.ZodError): ActionState {
  return {
    ok: false,
    error: "Please fix the highlighted fields.",
    fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
  }
}

/** Resolve the signed-in athlete, or an error state if unresolved. */
async function athleteId(): Promise<
  { id: string } | { error: ActionState }
> {
  const id = await getCurrentAthleteClientId()
  if (!id) {
    return {
      error: { ok: false, error: "No athlete profile is linked to your account." },
    }
  }
  return { id }
}

export async function logWeightAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = weightEntrySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrors(parsed.error)

  const who = await athleteId()
  if ("error" in who) return who.error
  const date = todayStr()

  try {
    if (DEV_AUTH_BYPASS) {
      updateAthleteDay(who.id, date, { weightLbs: parsed.data.weight_lbs })
    } else {
      const supabase = await createServerSupabase()
      const { error } = await supabase.from("weight_logs").insert({
        client_id: who.id,
        weight_lbs: parsed.data.weight_lbs,
        logged_at: new Date().toISOString(),
      })
      if (error) return { ok: false, error: error.message }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." }
  }
  revalidateAll()
  return { ok: true }
}

export async function addHydrationAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = hydrationEntrySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrors(parsed.error)

  const who = await athleteId()
  if ("error" in who) return who.error
  const date = todayStr()

  try {
    if (DEV_AUTH_BYPASS) {
      const current = getAthleteDay(who.id, date).hydrationOz ?? 0
      updateAthleteDay(who.id, date, { hydrationOz: current + parsed.data.oz })
    } else {
      const supabase = await createServerSupabase()
      // Upsert today's running total: read existing, then write the new sum.
      const { data: existing } = await supabase
        .from("hydration_logs")
        .select("id, oz_consumed")
        .eq("client_id", who.id)
        .eq("logged_date", date)
        .maybeSingle()
      const next = (existing?.oz_consumed ?? 0) + parsed.data.oz
      const { error } = existing
        ? await supabase
            .from("hydration_logs")
            .update({ oz_consumed: next })
            .eq("id", existing.id)
        : await supabase
            .from("hydration_logs")
            .insert({ client_id: who.id, logged_date: date, oz_consumed: next })
      if (error) return { ok: false, error: error.message }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." }
  }
  revalidateAll()
  return { ok: true }
}

export async function logNutritionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = nutritionEntrySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrors(parsed.error)
  const { calories, protein, carbs, fat } = parsed.data
  if (calories == null && protein == null && carbs == null && fat == null) {
    return { ok: false, error: "Enter at least your calories or protein." }
  }

  const who = await athleteId()
  if ("error" in who) return who.error
  const date = todayStr()

  try {
    if (DEV_AUTH_BYPASS) {
      updateAthleteDay(who.id, date, {
        nutrition: { calories, protein, carbs, fat },
      })
    } else {
      const supabase = await createServerSupabase()
      const { data: existing } = await supabase
        .from("nutrition_logs")
        .select("id")
        .eq("client_id", who.id)
        .eq("logged_date", date)
        .maybeSingle()
      const row = {
        client_id: who.id,
        logged_date: date,
        meal_label: "Daily total",
        calories,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,
      }
      const { error } = existing
        ? await supabase.from("nutrition_logs").update(row).eq("id", existing.id)
        : await supabase.from("nutrition_logs").insert(row)
      if (error) return { ok: false, error: error.message }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." }
  }
  revalidateAll()
  return { ok: true }
}

export async function logRecoveryAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = recoveryEntrySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrors(parsed.error)
  const { sleep_hours, soreness, energy, stress } = parsed.data

  const who = await athleteId()
  if ("error" in who) return who.error
  const date = todayStr()

  try {
    if (DEV_AUTH_BYPASS) {
      updateAthleteDay(who.id, date, {
        recovery: { sleepHours: sleep_hours, soreness, energy, stress },
      })
    } else {
      const supabase = await createServerSupabase()
      const { data: existing } = await supabase
        .from("recovery_logs")
        .select("id")
        .eq("client_id", who.id)
        .eq("logged_date", date)
        .maybeSingle()
      const row = {
        client_id: who.id,
        logged_date: date,
        sleep_hours,
        soreness,
        energy,
        stress,
      }
      const { error } = existing
        ? await supabase.from("recovery_logs").update(row).eq("id", existing.id)
        : await supabase.from("recovery_logs").insert(row)
      if (error) return { ok: false, error: error.message }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." }
  }
  revalidateAll()
  return { ok: true }
}

/** Toggle one supplement's taken-state for today. */
export async function toggleSupplementAction(
  supplementId: string,
  taken: boolean
): Promise<ActionState> {
  const who = await athleteId()
  if ("error" in who) return who.error
  const date = todayStr()

  try {
    if (DEV_AUTH_BYPASS) {
      setAthleteSupplement(who.id, date, supplementId, taken)
    } else {
      const supabase = await createServerSupabase()
      const { data: existing } = await supabase
        .from("supplement_logs")
        .select("id")
        .eq("client_id", who.id)
        .eq("supplement_id", supplementId)
        .gte("logged_at", `${date}T00:00:00`)
        .lte("logged_at", `${date}T23:59:59`)
        .maybeSingle()
      const { error } = existing
        ? await supabase
            .from("supplement_logs")
            .update({ taken })
            .eq("id", existing.id)
        : await supabase.from("supplement_logs").insert({
            client_id: who.id,
            supplement_id: supplementId,
            taken,
            logged_at: new Date().toISOString(),
          })
      if (error) return { ok: false, error: error.message }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." }
  }
  revalidateAll()
  return { ok: true }
}
