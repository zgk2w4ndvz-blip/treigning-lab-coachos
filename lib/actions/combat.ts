"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireCoach } from "@/lib/auth"
import { createServerSupabase } from "@/lib/supabase/server"
import {
  weighInFormSchema,
  weightCutFormSchema,
} from "@/lib/validations/combat"
import {
  generateRefuelProtocol,
  generateRehydrationProtocol,
  generateWaterLoadPlan,
  rehydrationWindowHours,
} from "@/lib/combat/protocols"
import { type ActionState, BYPASS_BLOCKED } from "@/lib/actions/types"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import type { Json } from "@/types/database"

function clientPath(clientId: string) {
  return `/clients/${clientId}/combat`
}

/** Typed protocol arrays are structurally JSON; cast at the DB boundary. */
const asJson = <T>(v: T): Json => v as unknown as Json

/** Create a weight cut and auto-generate its protocol templates. */
export async function createWeightCutAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (DEV_AUTH_BYPASS) return BYPASS_BLOCKED
  const coach = await requireCoach()
  const parsed = weightCutFormSchema.safeParse(
    Object.fromEntries(formData.entries())
  )
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const v = parsed.data
  const windowHours = rehydrationWindowHours(v.weigh_in_at, v.competition_at)

  const supabase = await createServerSupabase()
  const { error } = await supabase.from("weight_cuts").insert({
    ...v,
    coach_id: coach.id,
    rehydration_window_hours: windowHours,
    water_load_plan: asJson(generateWaterLoadPlan()),
    hydration_restoration: asJson(generateRehydrationProtocol(windowHours)),
    refuel_protocol: asJson(generateRefuelProtocol(windowHours)),
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath(clientPath(v.client_id))
  revalidatePath("/combat")
  revalidatePath("/dashboard")
  redirect(clientPath(v.client_id))
}

/** Update an existing cut (protocols regenerated if the window changed). */
export async function updateWeightCutAction(
  cutId: string,
  clientId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (DEV_AUTH_BYPASS) return BYPASS_BLOCKED
  await requireCoach()
  const parsed = weightCutFormSchema.safeParse(
    Object.fromEntries(formData.entries())
  )
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const v = parsed.data
  const windowHours = rehydrationWindowHours(v.weigh_in_at, v.competition_at)

  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from("weight_cuts")
    .update({ ...v, rehydration_window_hours: windowHours })
    .eq("id", cutId)

  if (error) return { ok: false, error: error.message }

  revalidatePath(clientPath(clientId))
  revalidatePath("/combat")
  return { ok: true }
}

/** Log a weigh-in event against a cut. Marks made_weight when applicable. */
export async function recordWeighInAction(
  cutId: string,
  clientId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (DEV_AUTH_BYPASS) return BYPASS_BLOCKED
  await requireCoach()
  const parsed = weighInFormSchema.safeParse(
    Object.fromEntries(formData.entries())
  )
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const v = parsed.data
  const madeWeight =
    v.weight_lbs != null && v.target_lbs != null
      ? v.weight_lbs <= v.target_lbs
      : null

  const supabase = await createServerSupabase()
  const { error } = await supabase.from("weigh_ins").insert({
    weight_cut_id: cutId,
    client_id: clientId,
    kind: v.kind,
    scheduled_at: v.scheduled_at,
    target_lbs: v.target_lbs,
    weight_lbs: v.weight_lbs,
    made_weight: madeWeight,
    recorded_at: v.weight_lbs != null ? new Date().toISOString() : null,
    notes: v.notes,
  })

  if (error) return { ok: false, error: error.message }

  // Official weigh-in with a recorded weight closes out the cut.
  if (v.kind === "official" && v.weight_lbs != null) {
    await supabase
      .from("weight_cuts")
      .update({ status: "weigh_in", made_weight: madeWeight })
      .eq("id", cutId)
  }

  revalidatePath(clientPath(clientId))
  revalidatePath("/combat")
  return { ok: true }
}

/** Regenerate the three protocol documents from the current window. */
export async function regenerateProtocolsAction(
  cutId: string,
  clientId: string
): Promise<ActionState> {
  if (DEV_AUTH_BYPASS) return BYPASS_BLOCKED
  await requireCoach()
  const supabase = await createServerSupabase()

  const { data: cut } = await supabase
    .from("weight_cuts")
    .select("weigh_in_at, competition_at")
    .eq("id", cutId)
    .maybeSingle()
  if (!cut) return { ok: false, error: "Cut not found." }

  const windowHours = rehydrationWindowHours(
    cut.weigh_in_at,
    cut.competition_at
  )
  const { error } = await supabase
    .from("weight_cuts")
    .update({
      rehydration_window_hours: windowHours,
      water_load_plan: asJson(generateWaterLoadPlan()),
      hydration_restoration: asJson(generateRehydrationProtocol(windowHours)),
      refuel_protocol: asJson(generateRefuelProtocol(windowHours)),
    })
    .eq("id", cutId)

  if (error) return { ok: false, error: error.message }

  revalidatePath(clientPath(clientId))
  return { ok: true }
}

/** Cancel/delete a cut. */
export async function deleteWeightCutAction(
  cutId: string,
  clientId: string
): Promise<ActionState> {
  if (DEV_AUTH_BYPASS) return BYPASS_BLOCKED
  await requireCoach()
  const supabase = await createServerSupabase()
  const { error } = await supabase.from("weight_cuts").delete().eq("id", cutId)
  if (error) return { ok: false, error: error.message }

  revalidatePath(clientPath(clientId))
  revalidatePath("/combat")
  return { ok: true }
}
