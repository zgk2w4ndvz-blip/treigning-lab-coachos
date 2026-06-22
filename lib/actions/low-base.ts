"use server"

import { revalidatePath } from "next/cache"

import { requireCoach } from "@/lib/auth"
import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { setStoredLowBase } from "@/lib/dev-low-base-store"
import { lowBaseSchema } from "@/lib/validations/low-base"
import { getOperatingTimeZone } from "@/lib/data/settings"
import { wallClockToUtc, dayKeyInZone } from "@/lib/calendar/timezone"
import {
  planLowBaseSync,
  lowBaseEventLabel,
  lowBaseEventDescription,
  type ExistingManagedEvent,
  type LowBaseScheduleInput,
} from "@/lib/calendar/low-base-sync"
import type { ActionState } from "@/lib/actions/types"
import type { LowBaseSlot } from "@/types/models"
import type { Json } from "@/types/database"

const MANAGED_SOURCE = "low_base_schedule"

/**
 * Create or update the athlete's Low Base prescription (one per client) AND
 * reconcile the recurring Low Base calendar events it owns. The prescription is
 * the source of truth: a deterministic plan creates/updates/truncates/deletes
 * only events linked by prescription_id with details.source = low_base_schedule.
 * Manual (unlinked) Low Base events are never touched, and completed history is
 * preserved (value changes split forward). Calendar sync is real-mode only.
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
  const slots = d.schedule as LowBaseSlot[]
  const frequency = slots.length > 0 ? slots.length : d.frequency_per_week

  try {
    if (DEV_AUTH_BYPASS) {
      // Dev bypass mirrors the prescription locally; calendar writes require the
      // live DB (the calendar reconciler is a no-op here, like other cal actions).
      setStoredLowBase(clientId, {
        mep_bpm: d.mep_bpm,
        frequency_per_week: frequency,
        minutes_per_session: d.minutes_per_session,
        notes: d.notes,
        start_date: d.start_date,
        end_date: d.end_date,
        schedule: slots,
      })
      revalidatePath(`/clients/${clientId}/low-base`)
      revalidatePath(`/clients/${clientId}`)
      return { ok: true }
    }

    const coach = await requireCoach()
    const supabase = await createServerSupabase()

    const { data: rx, error: upErr } = await supabase
      .from("low_base_prescriptions")
      .upsert(
        {
          coach_id: coach.id,
          client_id: clientId,
          mep_bpm: d.mep_bpm,
          frequency_per_week: frequency,
          minutes_per_session: d.minutes_per_session,
          notes: d.notes,
          start_date: d.start_date,
          end_date: d.end_date,
          schedule: slots as unknown as Json,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id" }
      )
      .select("id")
      .single()
    if (upErr || !rx) return { ok: false, error: upErr?.message ?? "Save failed." }

    const sync = await reconcileCalendar(supabase, coach.id, clientId, {
      prescriptionId: rx.id,
      mepBpm: d.mep_bpm,
      minutesPerSession: d.minutes_per_session,
      startDate: d.start_date ?? "",
      endDate: d.end_date,
      slots: slots.map((s) => ({ dayOfWeek: s.day_of_week, time: s.time })),
    })
    if (!sync.ok) return sync
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." }
  }

  revalidatePath(`/clients/${clientId}/low-base`)
  revalidatePath(`/clients/${clientId}`)
  revalidatePath(`/clients/${clientId}/calendar`)
  revalidatePath("/calendar")
  return { ok: true }
}

type Supa = Awaited<ReturnType<typeof createServerSupabase>>

/** Apply the deterministic reconciler plan to athlete_calendar_events. */
async function reconcileCalendar(
  supabase: Supa,
  coachId: string,
  clientId: string,
  input: LowBaseScheduleInput
): Promise<ActionState> {
  const tz = await getOperatingTimeZone()
  const today = dayKeyInZone(new Date(), tz)

  // Load the events this prescription manages (linked + tagged).
  const { data: events, error: gErr } = await supabase
    .from("athlete_calendar_events")
    .select("*")
    .eq("client_id", clientId)
    .eq("prescription_id", input.prescriptionId)
  if (gErr) return { ok: false, error: gErr.message }

  const managed = (events ?? []).filter(
    (e) => (e.details as Record<string, unknown> | null)?.source === MANAGED_SOURCE
  )
  const rowById = new Map(managed.map((e) => [e.id, e]))

  // Protected history per event: latest completed occurrence day.
  const eventIds = managed.map((e) => e.id)
  const lastHistoryByEvent = new Map<string, string>()
  if (eventIds.length) {
    const { data: ovs } = await supabase
      .from("athlete_calendar_event_overrides")
      .select("event_id, occurrence_date, status")
      .in("event_id", eventIds)
      .eq("status", "completed")
    for (const o of ovs ?? []) {
      const prev = lastHistoryByEvent.get(o.event_id)
      if (!prev || o.occurrence_date > prev) lastHistoryByEvent.set(o.event_id, o.occurrence_date)
    }
  }

  const existing: ExistingManagedEvent[] = managed.map((e) => {
    const det = (e.details as Record<string, unknown> | null) ?? {}
    return {
      id: e.id,
      slotKey: String(det.slot_key ?? ""),
      firstOccurrenceDay: dayKeyInZone(new Date(e.starts_at), tz),
      mepBpm: typeof det.mep_bpm === "number" ? det.mep_bpm : null,
      minutesPerSession: typeof det.minutes === "number" ? det.minutes : 0,
      recurrenceUntil: e.recurrence_until,
      lastHistoryDay: lastHistoryByEvent.get(e.id) ?? null,
    }
  })

  // Nothing to do if there are no slots and nothing managed yet.
  if (input.slots.length === 0 && existing.length === 0) return { ok: true }

  const ops = planLowBaseSync(input, existing, today)

  for (const op of ops) {
    if (op.type === "create") {
      const startsAt = wallClockToUtc(`${op.anchorDate}T${op.time}:00`, tz)
      if (!startsAt) return { ok: false, error: `Invalid slot time ${op.time}.` }
      const endsAt = new Date(startsAt.getTime() + op.minutesPerSession * 60_000)
      const { error } = await supabase.from("athlete_calendar_events").insert({
        coach_id: coachId,
        client_id: clientId,
        category: "low_base",
        title: lowBaseEventLabel(op.minutesPerSession, op.mepBpm),
        description: lowBaseEventDescription(op.mepBpm, op.minutesPerSession, input.prescriptionId),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        all_day: false,
        status: "planned",
        recurrence: "weekly",
        recurrence_until: op.recurrenceUntil,
        prescription_id: input.prescriptionId,
        details: {
          source: MANAGED_SOURCE,
          slot_key: op.slotKey,
          day_of_week: op.dayOfWeek,
          time: op.time,
          mep_bpm: op.mepBpm,
          minutes: op.minutesPerSession,
        },
      })
      if (error) return { ok: false, error: error.message }
    } else if (op.type === "update") {
      const row = rowById.get(op.eventId)
      if (!row) continue
      const startsAt = new Date(row.starts_at)
      const endsAt = new Date(startsAt.getTime() + op.minutesPerSession * 60_000)
      const det = ((row.details as Record<string, unknown> | null) ?? {}) as Record<string, unknown>
      const { error } = await supabase
        .from("athlete_calendar_events")
        .update({
          title: lowBaseEventLabel(op.minutesPerSession, op.mepBpm),
          description: lowBaseEventDescription(op.mepBpm, op.minutesPerSession, input.prescriptionId),
          ends_at: endsAt.toISOString(),
          recurrence_until: op.recurrenceUntil,
          details: { ...det, mep_bpm: op.mepBpm, minutes: op.minutesPerSession },
          updated_at: new Date().toISOString(),
        })
        .eq("id", op.eventId)
      if (error) return { ok: false, error: error.message }
    } else if (op.type === "truncate" || op.type === "setRecurrenceUntil") {
      const { error } = await supabase
        .from("athlete_calendar_events")
        .update({ recurrence_until: op.recurrenceUntil, updated_at: new Date().toISOString() })
        .eq("id", op.eventId)
      if (error) return { ok: false, error: error.message }
    } else if (op.type === "delete") {
      const { error } = await supabase.from("athlete_calendar_events").delete().eq("id", op.eventId)
      if (error) return { ok: false, error: error.message }
    }
  }

  return { ok: true }
}
