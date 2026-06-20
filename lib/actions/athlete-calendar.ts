"use server"

import { revalidatePath } from "next/cache"

import { requireCoach } from "@/lib/auth"
import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { getOperatingTimeZone } from "@/lib/data/settings"
import { wallClockToUtc, dayKeyInZone, previousLocalDay } from "@/lib/calendar/timezone"
import { calendarEventSchema } from "@/lib/validations/athlete-calendar"
import type { ActionState } from "@/lib/actions/types"
import type { CalendarStatus } from "@/types/models"

/** Edit/delete scope for a recurring event. */
type EditScope = "this" | "future" | "series"

function readScope(formData: FormData): EditScope {
  const s = String(formData.get("scope") ?? "series")
  return s === "this" || s === "future" ? s : "series"
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

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
    const tz = await getOperatingTimeZone()
    const startsAt = wallClockToUtc(d.starts_at, tz)
    if (!startsAt) return { ok: false, error: "Invalid start date/time." }
    const endsAt = d.ends_at ? wallClockToUtc(d.ends_at, tz) : null
    const supabase = await createServerSupabase()
    const { error } = await supabase.from("athlete_calendar_events").insert({
      coach_id: coach.id, client_id: clientId, category: d.category, title: d.title,
      description: d.description,
      starts_at: startsAt.toISOString(), ends_at: endsAt?.toISOString() ?? null,
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

/**
 * Update a calendar event with an explicit scope (recurring events):
 *   series — update the base row (affects all occurrences, incl. past).
 *   this   — write a field override for one occurrence only.
 *   future — split the series: truncate the original + create a new series from
 *            the selected occurrence; re-point future overrides.
 * Non-recurring events post no scope → defaults to "series" (a plain update).
 */
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
  const scope = readScope(formData)
  const occurrenceDate = String(formData.get("occurrence_date") ?? "")
  if ((scope === "this" || scope === "future") && !DATE_RE.test(occurrenceDate)) {
    return { ok: false, error: "Missing occurrence date for scoped edit." }
  }

  try {
    const tz = await getOperatingTimeZone()
    const startsAt = wallClockToUtc(d.starts_at, tz)
    if (!startsAt) return { ok: false, error: "Invalid start date/time." }
    const endsAt = d.ends_at ? wallClockToUtc(d.ends_at, tz) : null
    const supabase = await createServerSupabase()

    if (scope === "this") {
      const { data: base, error: gErr } = await supabase
        .from("athlete_calendar_events").select("*").eq("id", eventId).single()
      if (gErr || !base) return { ok: false, error: gErr?.message ?? "Event not found." }
      // Store only fields that differ from the base (null = inherit).
      const sameInstant = (a: string | null, b: string | null) =>
        (a == null && b == null) || (a != null && b != null && Date.parse(a) === Date.parse(b))
      const { error } = await supabase
        .from("athlete_calendar_event_overrides")
        .upsert(
          {
            event_id: eventId,
            occurrence_date: occurrenceDate,
            title: d.title === base.title ? null : d.title,
            description: d.description === base.description ? null : d.description,
            category: d.category === base.category ? null : d.category,
            all_day: d.all_day === base.all_day ? null : d.all_day,
            starts_at: sameInstant(startsAt.toISOString(), base.starts_at) ? null : startsAt.toISOString(),
            ends_at: sameInstant(endsAt?.toISOString() ?? null, base.ends_at) ? null : (endsAt?.toISOString() ?? null),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "event_id,occurrence_date" } // preserves status/notes/is_cancelled
        )
      if (error) return { ok: false, error: error.message }
      revalidate(clientId)
      return { ok: true }
    }

    if (scope === "future") {
      const { data: base, error: gErr } = await supabase
        .from("athlete_calendar_events").select("*").eq("id", eventId).single()
      if (gErr || !base) return { ok: false, error: gErr?.message ?? "Event not found." }
      // Editing the first occurrence as "future" == editing the whole series.
      if (occurrenceDate > dayKeyInZone(new Date(base.starts_at), tz)) {
        const coach = await requireCoach()
        const { data: created, error: cErr } = await supabase
          .from("athlete_calendar_events")
          .insert({
            coach_id: coach.id, client_id: clientId, category: d.category, title: d.title,
            description: d.description, starts_at: startsAt.toISOString(),
            ends_at: endsAt?.toISOString() ?? null, all_day: d.all_day, status: d.status,
            recurrence: d.recurrence, recurrence_until: base.recurrence_until,
            prescription_id: base.prescription_id, details: base.details,
          })
          .select("id").single()
        if (cErr || !created) return { ok: false, error: cErr?.message ?? "Split failed." }
        const { error: tErr } = await supabase
          .from("athlete_calendar_events")
          .update({ recurrence_until: previousLocalDay(occurrenceDate), updated_at: new Date().toISOString() })
          .eq("id", eventId)
        if (tErr) return { ok: false, error: tErr.message }
        // Re-point future overrides to the new series; historical ones stay.
        await supabase
          .from("athlete_calendar_event_overrides")
          .update({ event_id: created.id })
          .eq("event_id", eventId)
          .gte("occurrence_date", occurrenceDate)
        revalidate(clientId)
        return { ok: true }
      }
      // else fall through to a full-series update
    }

    // scope === "series" (or first-occurrence "future")
    const { error } = await supabase
      .from("athlete_calendar_events")
      .update({
        category: d.category, title: d.title, description: d.description,
        starts_at: startsAt.toISOString(), ends_at: endsAt?.toISOString() ?? null,
        all_day: d.all_day,
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

/**
 * Delete a calendar event with an explicit scope (recurring events):
 *   series — delete the base row (overrides cascade).
 *   this   — soft-cancel one occurrence (override is_cancelled = true; EXDATE).
 *   future — truncate the series (recurrence_until = occurrence − 1 day) and
 *            drop overrides on/after the cut.
 * Non-recurring (no scope) → deletes the row.
 */
export async function deleteCalendarEventAction(
  clientId: string,
  eventId: string,
  scope: EditScope = "series",
  occurrenceDate?: string
): Promise<ActionState> {
  if (DEV_AUTH_BYPASS) return BYPASS_NOTICE
  if ((scope === "this" || scope === "future") && !DATE_RE.test(occurrenceDate ?? "")) {
    return { ok: false, error: "Missing occurrence date for scoped delete." }
  }
  try {
    const supabase = await createServerSupabase()

    if (scope === "this") {
      const { error } = await supabase
        .from("athlete_calendar_event_overrides")
        .upsert(
          { event_id: eventId, occurrence_date: occurrenceDate!, is_cancelled: true, updated_at: new Date().toISOString() },
          { onConflict: "event_id,occurrence_date" }
        )
      if (error) return { ok: false, error: error.message }
      revalidate(clientId)
      return { ok: true }
    }

    if (scope === "future") {
      const tz = await getOperatingTimeZone()
      const { data: base } = await supabase
        .from("athlete_calendar_events").select("starts_at").eq("id", eventId).single()
      // Cancelling from the first occurrence == deleting the whole series.
      if (base && occurrenceDate! > dayKeyInZone(new Date(base.starts_at), tz)) {
        const { error } = await supabase
          .from("athlete_calendar_events")
          .update({ recurrence_until: previousLocalDay(occurrenceDate!), updated_at: new Date().toISOString() })
          .eq("id", eventId)
        if (error) return { ok: false, error: error.message }
        await supabase
          .from("athlete_calendar_event_overrides")
          .delete().eq("event_id", eventId).gte("occurrence_date", occurrenceDate!)
        revalidate(clientId)
        return { ok: true }
      }
      // else fall through to full-series delete
    }

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
