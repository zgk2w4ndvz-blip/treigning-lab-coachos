"use server"

import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"

import { requireCoach } from "@/lib/auth"
import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import {
  addCreatedSession,
  deleteCreatedSession,
  setSessionOverride,
  updateCreatedSession,
} from "@/lib/dev-schedule-store"
import { getBypassClients } from "@/lib/dev-roster-store"
import { createSessionSchema, NO_CLIENT, NO_MODALITY } from "@/lib/validations/schedule"
import { fullName } from "@/lib/utils/format"
import type { ActionState } from "@/lib/actions/types"
import type { SessionStatus } from "@/types/database"

const AFFECTED = ["/schedule"]

function revalidateAll() {
  for (const p of AFFECTED) revalidatePath(p)
}

/** Create a new scheduled session. */
export async function createSessionAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = createSessionSchema.safeParse(
    Object.fromEntries(formData.entries())
  )
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const v = parsed.data
  const clientId = v.clientId && v.clientId !== NO_CLIENT ? v.clientId : null
  const location = v.location || null
  const notes = v.notes || null
  const modality = v.modality && v.modality !== NO_MODALITY ? v.modality as import("@/types/database").SessionModality : null
  const scheduledAt = `${v.scheduledDate}T${v.scheduledTime}:00`

  try {
    if (DEV_AUTH_BYPASS) {
      let clientName: string | null = null
      if (clientId) {
        const clients = getBypassClients()
        const c = clients.find((x) => x.id === clientId)
        clientName = c ? fullName(c.first_name, c.last_name) : null
      }

      addCreatedSession({
        id: randomUUID(),
        clientId,
        clientName,
        avatarUrl: null,
        title: v.title,
        sessionType: v.sessionType,
        scheduledAt,
        durationMin: v.durationMin,
        location,
        modality,
        notes,
        status: "scheduled",
        createdAt: new Date().toISOString(),
      })
    } else {
      const coach = await requireCoach()
      const supabase = await createServerSupabase()
      const { error } = await supabase.from("schedule_sessions").insert({
        coach_id: coach.id,
        client_id: clientId,
        title: v.title,
        session_type: v.sessionType,
        scheduled_at: scheduledAt,
        duration_min: v.durationMin,
        location,
        modality,
        notes,
        status: "scheduled",
      })
      if (error) return { ok: false, error: error.message }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Create failed." }
  }

  revalidateAll()
  return { ok: true }
}

/** Update an existing session (full edit). */
export async function updateSessionAction(
  sessionId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = createSessionSchema.safeParse(
    Object.fromEntries(formData.entries())
  )
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const v = parsed.data
  const clientId = v.clientId && v.clientId !== NO_CLIENT ? v.clientId : null
  const location = v.location || null
  const notes = v.notes || null
  const modality = v.modality && v.modality !== NO_MODALITY ? v.modality as import("@/types/database").SessionModality : null
  const scheduledAt = `${v.scheduledDate}T${v.scheduledTime}:00`

  try {
    if (DEV_AUTH_BYPASS) {
      let clientName: string | null = null
      if (clientId) {
        const clients = getBypassClients()
        const c = clients.find((x) => x.id === clientId)
        clientName = c ? fullName(c.first_name, c.last_name) : null
      }
      updateCreatedSession(sessionId, {
        clientId,
        clientName,
        title: v.title,
        sessionType: v.sessionType,
        scheduledAt,
        durationMin: v.durationMin,
        location,
        modality,
        notes,
      })
    } else {
      await requireCoach()
      const supabase = await createServerSupabase()
      const { error } = await supabase
        .from("schedule_sessions")
        .update({
          client_id: clientId,
          title: v.title,
          session_type: v.sessionType,
          scheduled_at: scheduledAt,
          duration_min: v.durationMin,
          location,
          modality,
          notes,
        })
        .eq("id", sessionId)
      if (error) return { ok: false, error: error.message }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Update failed." }
  }

  revalidateAll()
  return { ok: true }
}

/** Set session status (complete / cancel / no_show). */
export async function setSessionStatusAction(
  sessionId: string,
  status: SessionStatus
): Promise<ActionState> {
  try {
    if (DEV_AUTH_BYPASS) {
      setSessionOverride(sessionId, { status })
    } else {
      await requireCoach()
      const supabase = await createServerSupabase()
      const { error } = await supabase
        .from("schedule_sessions")
        .update({ status })
        .eq("id", sessionId)
      if (error) return { ok: false, error: error.message }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Update failed." }
  }

  revalidateAll()
  return { ok: true }
}

/** Delete a scheduled session. */
export async function deleteSessionAction(
  sessionId: string
): Promise<ActionState> {
  try {
    if (DEV_AUTH_BYPASS) {
      const deleted = deleteCreatedSession(sessionId)
      if (!deleted) {
        // Mock sessions can't be deleted; mark as cancelled instead
        setSessionOverride(sessionId, { status: "cancelled" })
      }
    } else {
      await requireCoach()
      const supabase = await createServerSupabase()
      const { error } = await supabase
        .from("schedule_sessions")
        .delete()
        .eq("id", sessionId)
      if (error) return { ok: false, error: error.message }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed." }
  }

  revalidateAll()
  return { ok: true }
}
