"use server"

import { revalidatePath } from "next/cache"

import { requireCoach } from "@/lib/auth"
import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { setStoredLowBase } from "@/lib/dev-low-base-store"
import { lowBaseSchema } from "@/lib/validations/low-base"
import type { ActionState } from "@/lib/actions/types"

/**
 * Create or update the athlete's Low Base prescription (one per client). RLS-safe
 * in real mode (low_base_prescriptions write policy = is_client_coach); persists
 * to the local dev store in bypass. Bound with the client id by the page.
 */
export async function saveLowBasePrescriptionAction(
  clientId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = lowBaseSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }
  const d = parsed.data

  try {
    if (DEV_AUTH_BYPASS) {
      setStoredLowBase(clientId, {
        mep_bpm: d.mep_bpm,
        frequency_per_week: d.frequency_per_week,
        minutes_per_session: d.minutes_per_session,
        notes: d.notes,
      })
    } else {
      const coach = await requireCoach()
      const supabase = await createServerSupabase()
      const { error } = await supabase.from("low_base_prescriptions").upsert(
        {
          coach_id: coach.id,
          client_id: clientId,
          mep_bpm: d.mep_bpm,
          frequency_per_week: d.frequency_per_week,
          minutes_per_session: d.minutes_per_session,
          notes: d.notes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id" }
      )
      if (error) return { ok: false, error: error.message }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." }
  }

  revalidatePath(`/clients/${clientId}/low-base`)
  revalidatePath(`/clients/${clientId}`)
  return { ok: true }
}
