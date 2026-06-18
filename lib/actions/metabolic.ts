"use server"

import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"

import { requireCoach } from "@/lib/auth"
import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import {
  addStoredAssessment,
  deleteStoredAssessment,
  getStoredAssessment,
} from "@/lib/dev-metabolic-store"
import { getStoredLowBase, setStoredLowBase } from "@/lib/dev-low-base-store"
import { metabolicSchema } from "@/lib/validations/metabolic"
import type { ActionState } from "@/lib/actions/types"

/** Default Low Base dose when pushing an MEP with no existing prescription. */
const DEFAULT_FREQUENCY_PER_WEEK = 4
const DEFAULT_MINUTES_PER_SESSION = 45

function revalidateMetabolic(clientId: string) {
  revalidatePath(`/clients/${clientId}/metabolic`)
  revalidatePath(`/clients/${clientId}/low-base`)
  revalidatePath(`/clients/${clientId}`)
}

/**
 * Record a metabolic assessment plus its curve points. Persists to the local
 * dev store in bypass and to `metabolic_assessments` + `metabolic_curve_points`
 * in real mode. Bound with the client id by the page:
 * `logMetabolicAssessmentAction.bind(null, clientId)`.
 */
export async function logMetabolicAssessmentAction(
  clientId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = metabolicSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const d = parsed.data
  const assessedAt = d.assessed_at ?? new Date().toISOString()
  const assessmentId = randomUUID()

  try {
    if (DEV_AUTH_BYPASS) {
      addStoredAssessment(clientId, {
        id: assessmentId,
        assessedAt,
        source: d.source,
        vo2Max: d.vo2_max,
        mepBpm: d.mep_bpm,
        aerobicThresholdBpm: d.aerobic_threshold_bpm,
        maxHrBpm: d.max_hr_bpm,
        caloriesBurnedPerMin: d.calories_burned_per_min,
        notes: d.notes,
        points: d.points.map((p) => ({
          id: randomUUID(),
          phase: p.phase,
          stage: p.stage,
          elapsedSec: p.elapsed_sec,
          heartRateBpm: p.heart_rate_bpm,
          ventilationLMin: p.ventilation_l_min,
          vo2: p.vo2,
        })),
      })
    } else {
      const coach = await requireCoach()
      const supabase = await createServerSupabase()
      const { error: aErr } = await supabase.from("metabolic_assessments").insert({
        id: assessmentId,
        client_id: clientId,
        logged_by: coach.id,
        assessed_at: assessedAt,
        source: d.source,
        vo2_max: d.vo2_max,
        mep_bpm: d.mep_bpm,
        aerobic_threshold_bpm: d.aerobic_threshold_bpm,
        max_hr_bpm: d.max_hr_bpm,
        calories_burned_per_min: d.calories_burned_per_min,
        notes: d.notes,
      })
      if (aErr) return { ok: false, error: aErr.message }

      if (d.points.length > 0) {
        const { error: pErr } = await supabase.from("metabolic_curve_points").insert(
          d.points.map((p) => ({
            assessment_id: assessmentId,
            client_id: clientId,
            phase: p.phase,
            stage: p.stage,
            elapsed_sec: p.elapsed_sec,
            heart_rate_bpm: p.heart_rate_bpm,
            ventilation_l_min: p.ventilation_l_min,
            vo2: p.vo2,
          }))
        )
        if (pErr) return { ok: false, error: pErr.message }
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." }
  }

  revalidateMetabolic(clientId)
  return { ok: true }
}

/** Delete an assessment (curve points cascade). RLS-safe (write policy =
 *  is_client_coach). Bound by the page: `.bind(null, clientId, assessmentId)`. */
export async function deleteMetabolicAssessmentAction(
  clientId: string,
  assessmentId: string
): Promise<ActionState> {
  try {
    if (DEV_AUTH_BYPASS) {
      const ok = deleteStoredAssessment(clientId, assessmentId)
      if (!ok) return { ok: false, error: "Assessment not found." }
    } else {
      await requireCoach()
      const supabase = await createServerSupabase()
      const { error } = await supabase
        .from("metabolic_assessments")
        .delete()
        .eq("id", assessmentId)
        .eq("client_id", clientId)
      if (error) return { ok: false, error: error.message }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed." }
  }

  revalidateMetabolic(clientId)
  return { ok: true }
}

/**
 * Push an assessment's MEP into the client's Low Base prescription. Low Base is
 * an OUTPUT of metabolic testing: this upserts mep_bpm onto low_base_prescriptions,
 * preserving the existing dose (frequency / minutes) or seeding sensible defaults
 * for a brand-new prescription. RLS-safe (low_base write policy = is_client_coach).
 */
export async function pushMepToLowBaseAction(
  clientId: string,
  assessmentId: string
): Promise<ActionState> {
  try {
    if (DEV_AUTH_BYPASS) {
      const a = getStoredAssessment(clientId, assessmentId)
      if (!a) return { ok: false, error: "Assessment not found." }
      if (a.mepBpm == null) return { ok: false, error: "This assessment has no MEP value." }
      const prev = getStoredLowBase(clientId)
      setStoredLowBase(clientId, {
        mep_bpm: a.mepBpm,
        frequency_per_week: prev?.frequency_per_week ?? DEFAULT_FREQUENCY_PER_WEEK,
        minutes_per_session: prev?.minutes_per_session ?? DEFAULT_MINUTES_PER_SESSION,
        notes: prev?.notes ?? null,
      })
    } else {
      const coach = await requireCoach()
      const supabase = await createServerSupabase()

      const { data: a, error: aErr } = await supabase
        .from("metabolic_assessments")
        .select("mep_bpm")
        .eq("id", assessmentId)
        .eq("client_id", clientId)
        .maybeSingle()
      if (aErr) return { ok: false, error: aErr.message }
      if (!a) return { ok: false, error: "Assessment not found." }
      if (a.mep_bpm == null) return { ok: false, error: "This assessment has no MEP value." }

      const { data: existing } = await supabase
        .from("low_base_prescriptions")
        .select("frequency_per_week, minutes_per_session, notes")
        .eq("client_id", clientId)
        .maybeSingle()

      const { error } = await supabase.from("low_base_prescriptions").upsert(
        {
          coach_id: coach.id,
          client_id: clientId,
          mep_bpm: a.mep_bpm,
          frequency_per_week: existing?.frequency_per_week ?? DEFAULT_FREQUENCY_PER_WEEK,
          minutes_per_session: existing?.minutes_per_session ?? DEFAULT_MINUTES_PER_SESSION,
          notes: existing?.notes ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id" }
      )
      if (error) return { ok: false, error: error.message }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Push failed." }
  }

  revalidateMetabolic(clientId)
  return { ok: true }
}
