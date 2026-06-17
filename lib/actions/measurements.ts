"use server"

import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"

import { requireCoach } from "@/lib/auth"
import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import {
  addStoredMeasurementSession,
  updateStoredMeasurementSession,
  deleteStoredMeasurementSession,
} from "@/lib/dev-measurements-store"
import { measurementSchema } from "@/lib/validations/measurements"
import type { MeasurementInput } from "@/lib/validations/measurements"
import type { ActionState } from "@/lib/actions/types"

function revalidateMeasurements(clientId: string) {
  revalidatePath(`/clients/${clientId}/measurements`)
  revalidatePath(`/clients/${clientId}`)
}

/** Map validated input to the dev-store session shape (camelCase). */
function toStored(d: MeasurementInput, measuredAt: string, id: string) {
  return {
    id,
    measuredAt,
    waistIn: d.waist_in,
    hipsIn: d.hips_in,
    chestIn: d.chest_in,
    shoulderIn: d.shoulder_in,
    thighIn: d.thigh_in,
    calvesIn: d.calves_in,
    wristIn: d.wrist_in,
    ankleIn: d.ankle_in,
    neckIn: d.neck_in,
    bicepIn: d.bicep_in,
    heightIn: d.height_in,
    notes: d.notes,
  }
}

/** Map validated input to the body_measurements row shape (snake_case). */
function toRow(d: MeasurementInput, measuredAt: string) {
  return {
    measured_at: measuredAt,
    waist_in: d.waist_in,
    hips_in: d.hips_in,
    chest_in: d.chest_in,
    shoulder_in: d.shoulder_in,
    thigh_in: d.thigh_in,
    calves_in: d.calves_in,
    wrist_in: d.wrist_in,
    ankle_in: d.ankle_in,
    neck_in: d.neck_in,
    bicep_in: d.bicep_in,
    height_in: d.height_in,
    notes: d.notes,
  }
}

/**
 * Record a measurement session. Persists to the local dev store in bypass and
 * to `body_measurements` in real mode. Bound with the client id by the page:
 * `logMeasurementAction.bind(null, clientId)`.
 */
export async function logMeasurementAction(
  clientId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = measurementSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const d = parsed.data
  const measuredAt = d.measured_at ?? new Date().toISOString()

  try {
    if (DEV_AUTH_BYPASS) {
      addStoredMeasurementSession(clientId, toStored(d, measuredAt, randomUUID()))
    } else {
      const coach = await requireCoach()
      const supabase = await createServerSupabase()
      const { error } = await supabase.from("body_measurements").insert({
        client_id: clientId,
        logged_by: coach.id,
        ...toRow(d, measuredAt),
      })
      if (error) return { ok: false, error: error.message }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." }
  }

  revalidateMeasurements(clientId)
  return { ok: true }
}

/**
 * Update an existing measurement session. RLS-safe: the user-scoped Supabase
 * client only updates rows the coach owns (body_measurements write policy =
 * is_client_coach). Bound by the page: `.bind(null, clientId, measurementId)`.
 */
export async function updateMeasurementAction(
  clientId: string,
  measurementId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = measurementSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const d = parsed.data
  const measuredAt = d.measured_at ?? new Date().toISOString()

  try {
    if (DEV_AUTH_BYPASS) {
      const ok = updateStoredMeasurementSession(
        clientId,
        measurementId,
        toStored(d, measuredAt, measurementId)
      )
      if (!ok) return { ok: false, error: "Measurement not found." }
    } else {
      await requireCoach()
      const supabase = await createServerSupabase()
      const { error } = await supabase
        .from("body_measurements")
        .update(toRow(d, measuredAt))
        .eq("id", measurementId)
        .eq("client_id", clientId)
      if (error) return { ok: false, error: error.message }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Update failed." }
  }

  revalidateMeasurements(clientId)
  return { ok: true }
}

/** Delete a measurement session. RLS-safe (body_measurements write policy =
 *  is_client_coach). */
export async function deleteMeasurementAction(
  clientId: string,
  measurementId: string
): Promise<ActionState> {
  try {
    if (DEV_AUTH_BYPASS) {
      const ok = deleteStoredMeasurementSession(clientId, measurementId)
      if (!ok) return { ok: false, error: "Measurement not found." }
    } else {
      await requireCoach()
      const supabase = await createServerSupabase()
      const { error } = await supabase
        .from("body_measurements")
        .delete()
        .eq("id", measurementId)
        .eq("client_id", clientId)
      if (error) return { ok: false, error: error.message }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed." }
  }

  revalidateMeasurements(clientId)
  return { ok: true }
}
