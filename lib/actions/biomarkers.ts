"use server"

import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"

import { requireCoach } from "@/lib/auth"
import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import {
  addStoredBiomarker,
  updateStoredBiomarker,
  deleteStoredBiomarker,
} from "@/lib/dev-biomarker-store"
import { biomarkerSchema, toMarkerKey } from "@/lib/validations/biomarkers"
import type { ActionState } from "@/lib/actions/types"

/**
 * Record a biomarker reading. Persists to the local dev store in bypass and to
 * `biomarker_readings` in real mode. Bound with the client id by the page.
 */
export async function logBiomarkerAction(
  clientId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = biomarkerSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }
  const d = parsed.data
  if (d.value_num == null && !d.value_text) {
    return { ok: false, error: "Enter a numeric or text value." }
  }

  const marker = toMarkerKey(d.label)
  const measuredAt = d.measured_at ?? new Date().toISOString()

  try {
    if (DEV_AUTH_BYPASS) {
      addStoredBiomarker(clientId, {
        id: randomUUID(),
        marker,
        label: d.label,
        valueNum: d.value_num,
        valueText: d.value_text,
        unit: d.unit,
        category: d.category,
        measuredAt,
      })
    } else {
      const coach = await requireCoach()
      const supabase = await createServerSupabase()
      const { error } = await supabase.from("biomarker_readings").insert({
        client_id: clientId,
        logged_by: coach.id,
        marker,
        label: d.label,
        value_num: d.value_num,
        value_text: d.value_text,
        unit: d.unit,
        category: d.category,
        measured_at: measuredAt,
        source: "manual",
      })
      if (error) return { ok: false, error: error.message }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." }
  }

  revalidatePath(`/clients/${clientId}/labs`)
  return { ok: true }
}

/** Update a biomarker reading. RLS-safe (biomarker_readings modify policy = coach). */
export async function updateBiomarkerAction(
  clientId: string,
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = biomarkerSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }
  const d = parsed.data
  if (d.value_num == null && !d.value_text) {
    return { ok: false, error: "Enter a numeric or text value." }
  }
  const marker = toMarkerKey(d.label)
  const measuredAt = d.measured_at ?? new Date().toISOString()

  try {
    if (DEV_AUTH_BYPASS) {
      const ok = updateStoredBiomarker(clientId, id, {
        marker, label: d.label, valueNum: d.value_num, valueText: d.value_text,
        unit: d.unit, category: d.category, measuredAt,
      })
      if (!ok) return { ok: false, error: "Reading not found." }
    } else {
      await requireCoach()
      const supabase = await createServerSupabase()
      const { error } = await supabase
        .from("biomarker_readings")
        .update({
          marker, label: d.label, value_num: d.value_num, value_text: d.value_text,
          unit: d.unit, category: d.category, measured_at: measuredAt,
        })
        .eq("id", id).eq("client_id", clientId)
      if (error) return { ok: false, error: error.message }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Update failed." }
  }

  revalidatePath(`/clients/${clientId}/labs`)
  return { ok: true }
}

/** Delete a biomarker reading. RLS-safe (biomarker_readings delete policy = coach). */
export async function deleteBiomarkerAction(
  clientId: string,
  id: string
): Promise<ActionState> {
  try {
    if (DEV_AUTH_BYPASS) {
      const ok = deleteStoredBiomarker(clientId, id)
      if (!ok) return { ok: false, error: "Reading not found." }
    } else {
      await requireCoach()
      const supabase = await createServerSupabase()
      const { error } = await supabase
        .from("biomarker_readings")
        .delete()
        .eq("id", id).eq("client_id", clientId)
      if (error) return { ok: false, error: error.message }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed." }
  }

  revalidatePath(`/clients/${clientId}/labs`)
  return { ok: true }
}
