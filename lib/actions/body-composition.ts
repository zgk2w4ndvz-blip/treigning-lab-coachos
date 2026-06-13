"use server"

import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"

import { requireCoach } from "@/lib/auth"
import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { addStoredMeasurement } from "@/lib/dev-body-comp-store"
import { bodyCompSchema } from "@/lib/validations/body-composition"
import type { ActionState } from "@/lib/actions/types"

/**
 * Record a body-composition measurement. Persists to the local dev store in
 * bypass and to `weight_logs` in real mode. Bound with the client id by the
 * page: `logBodyCompositionAction.bind(null, clientId)`.
 */
export async function logBodyCompositionAction(
  clientId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = bodyCompSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const d = parsed.data
  const loggedAt = d.logged_at ?? new Date().toISOString()

  try {
    if (DEV_AUTH_BYPASS) {
      addStoredMeasurement(clientId, {
        id: randomUUID(),
        loggedAt,
        weightLbs: d.weight_lbs,
        bodyFatPct: d.body_fat_pct,
        bodyFatMassLbs: d.body_fat_mass_lbs,
        bmr: d.bmr,
        totalBodyWaterLbs: d.total_body_water_lbs,
        skeletalMuscleMassLbs: d.skeletal_muscle_mass_lbs,
        notes: d.notes,
      })
    } else {
      const coach = await requireCoach()
      const supabase = await createServerSupabase()
      const { error } = await supabase.from("weight_logs").insert({
        client_id: clientId,
        logged_by: coach.id,
        weight_lbs: d.weight_lbs,
        body_fat_pct: d.body_fat_pct,
        body_fat_mass_lbs: d.body_fat_mass_lbs,
        bmr: d.bmr,
        total_body_water_lbs: d.total_body_water_lbs,
        skeletal_muscle_mass_lbs: d.skeletal_muscle_mass_lbs,
        muscle_mass_lbs: d.skeletal_muscle_mass_lbs,
        logged_at: loggedAt,
        notes: d.notes,
      })
      if (error) return { ok: false, error: error.message }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." }
  }

  revalidatePath(`/clients/${clientId}/weight`)
  revalidatePath(`/clients/${clientId}`)
  revalidatePath("/clients")
  revalidatePath("/dashboard")
  return { ok: true }
}
