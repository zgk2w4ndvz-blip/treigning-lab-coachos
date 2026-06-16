"use server"

import { revalidatePath } from "next/cache"

import { requireCoach } from "@/lib/auth"
import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { calendarEventSchema } from "@/lib/validations/athlete-calendar"
import type { ActionState } from "@/lib/actions/types"
import type { CalendarStatus } from "@/types/models"

const OCCURRENCE_STATUSES: CalendarStatus[] = [
  "planned",
  "completed",
  "skipped",
  "missed",
]

const BYPASS_NOTICE: ActionState = {
  ok: false,
  error: "Calendar editing requires the live database (disabled in dev bypass).",
}

function revalidate(clientId: string) {
  revalidatePath(`/clients/${clientId}/calendar`)
  revalidatePath("/calendar")
}

function parse(formData: FormData) {
  return calendarEventSchema.safeParse(Object.fromEntries(formData))
}

function fieldErrors(error: import("zod").ZodError): ActionState {
  return {
    ok: false,
    error: "Please fix the highlighted fields.",
    fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
  }
}

/** Create a calendar event for an athlete. */
export async function createCalendarEventAction(
  clientId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (DEV_AUTH_BYPASS) return BYPASS_NOTICE
  const r = parse(formData)
  if (!r.success) return fieldErrors(r.error)
  const d = r.data
  try {
    const coach = await requireCoach()
    const supabase = await createServerSupabase()
    const { error } = await supabase.from("athlete_calendar_events").insert({
      coach_id: coach.id, client_id: clientId, category: d.category, title: d.title,
      description: d.description, starts_at: d.starts_at, ends_at: d.ends_at,
      all_day: d.all_day, status: d.status, recurrence: d.recurrence,
      recurrence_until: d.recurrence_until,
    })
    if (error) return { ok: false, error: error.message }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." }
  }
  revalidate(clientId)
  return { ok: true }
}

/** Update an existing calendar event. */
export async function updateCalendarEventAction(
  clientId: string,
  eventId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (DEV_AUTH_BYPASS) return BYPASS_NOTICE
  const r = parse(formData)
  if (!r.success) return fieldErrors(r.error)
  const d = r.data
  try {
    const supabase = await createServerSupabase()
    const { error } = await supabase
      .from("athlete_calendar_events")
      .update({
        category: d.category, title: d.title, description: d.description,
        starts_at: d.starts_at, ends_at: d.ends_at, all_day: d.all_day,
        status: d.status, recurrence: d.recurrence, recurrence_until: d.recurrence_until,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId)
    if (error) return { ok: false, error: error.message }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." }
  }
  revalidate(clientId)
  return { ok: true }
}

/** Delete a calendar event. */
export async function deleteCalendarEventAction(
  clientId: string,
  eventId: string
): Promise<ActionState> {
  if (DEV_AUTH_BYPASS) return BYPASS_NOTICE
  try {
    const supabase = await createServerSupabase()
    const { error } = await supabase.from("athlete_calendar_events").delete().eq("id", eventId)
    if (error) return { ok: false, error: error.message }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed." }
  }
  revalidate(clientId)
  return { ok: true }
}

/** Duplicate an event (clone of the same item, ready to reschedule). */
export async function duplicateCalendarEventAction(
  clientId: string,
  eventId: string
): Promise<ActionState> {
  if (DEV_AUTH_BYPASS) return BYPASS_NOTICE
  try {
    const coach = await requireCoach()
    const supabase = await createServerSupabase()
    const { data: ev, error: getErr } = await supabase
      .from("athlete_calendar_events").select("*").eq("id", eventId).single()
    if (getErr || !ev) return { ok: false, error: getErr?.message ?? "Event not found." }
    const { error } = await supabase.from("athlete_calendar_events").insert({
      coach_id: coach.id, client_id: ev.client_id, category: ev.category,
      title: `${ev.title} (copy)`, description: ev.description,
      starts_at: ev.starts_at, ends_at: ev.ends_at, all_day: ev.all_day,
      status: "planned", recurrence: ev.recurrence, recurrence_until: ev.recurrence_until,
      details: ev.details,
    })
    if (error) return { ok: false, error: error.message }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Duplicate failed." }
  }
  revalidate(clientId)
  return { ok: true }
}

/**
 * Set the status of a single occurrence of an event (recurring or not) without
 * touching the parent definition or other occurrences. Upserts a row in
 * athlete_calendar_event_overrides keyed by (event_id, occurrence_date).
 */
export async function setOccurrenceStatusAction(
  clientId: string,
  eventId: string,
  occurrenceDate: string, // yyyy-MM-dd
  status: CalendarStatus
): Promise<ActionState> {
  if (DEV_AUTH_BYPASS) return BYPASS_NOTICE
  if (!OCCURRENCE_STATUSES.includes(status)) {
    return { ok: false, error: "Invalid status." }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate)) {
    return { ok: false, error: "Invalid occurrence date." }
  }
  try {
    const supabase = await createServerSupabase()
    // Omit `notes` so the upsert preserves any existing note on conflict.
    const { error } = await supabase
      .from("athlete_calendar_event_overrides")
      .upsert(
        {
          event_id: eventId,
          occurrence_date: occurrenceDate,
          status,
          completed_at: status === "completed" ? new Date().toISOString() : null,
        },
        { onConflict: "event_id,occurrence_date" }
      )
    if (error) return { ok: false, error: error.message }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Update failed." }
  }
  revalidate(clientId)
  return { ok: true }
}

/** Clear an occurrence override, reverting that day to the series default. */
export async function clearOccurrenceStatusAction(
  clientId: string,
  eventId: string,
  occurrenceDate: string
): Promise<ActionState> {
  if (DEV_AUTH_BYPASS) return BYPASS_NOTICE
  try {
    const supabase = await createServerSupabase()
    const { error } = await supabase
      .from("athlete_calendar_event_overrides")
      .delete()
      .eq("event_id", eventId)
      .eq("occurrence_date", occurrenceDate)
    if (error) return { ok: false, error: error.message }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Reset failed." }
  }
  revalidate(clientId)
  return { ok: true }
}
