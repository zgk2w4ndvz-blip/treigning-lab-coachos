// ============================================================================
// Low Base → calendar reconciler (PURE planner). The Low Base prescription is
// the source of truth; this plans the create/update/truncate/delete operations
// that keep the athlete's linked weekly calendar events in sync.
//
// Determinism: every desired session is keyed by `slotKey` = "{day}|{time}", and
// every managed event carries that key (details.slot_key) + the prescription id.
// Re-running with an unchanged schedule yields ZERO operations — so saving twice
// never creates duplicate events.
//
// History safety: a value change (MEP / minutes) on an event that already has
// past occurrences is applied as a FORWARD SPLIT — truncate the old series at
// yesterday and create a fresh series from today — mirroring the calendar's
// existing "this and future" edit scope. Completed/past occurrences are never
// rewritten. A removed slot truncates future occurrences (or deletes the event
// outright only when it has no past occurrences). No I/O — unit-testable.
// ============================================================================

import { previousLocalDay } from "@/lib/calendar/timezone"

export interface DesiredSlot {
  dayOfWeek: number // 0=Sun..6=Sat
  time: string // "HH:MM" local
}

export interface LowBaseScheduleInput {
  prescriptionId: string
  mepBpm: number | null
  minutesPerSession: number
  startDate: string // yyyy-MM-dd (required when there are slots)
  endDate: string | null // yyyy-MM-dd or null = indefinite
  slots: DesiredSlot[]
}

/** A managed Low Base event already in the calendar (details.source = low_base_schedule). */
export interface ExistingManagedEvent {
  id: string
  slotKey: string
  /** Local civil day of the event's first occurrence (yyyy-MM-dd). */
  firstOccurrenceDay: string
  mepBpm: number | null
  minutesPerSession: number
  recurrenceUntil: string | null
  /** Latest past/completed occurrence day to protect from truncation, or null. */
  lastHistoryDay?: string | null
}

export type SyncOp =
  | {
      type: "create"
      slotKey: string
      dayOfWeek: number
      time: string
      anchorDate: string // yyyy-MM-dd of first occurrence
      minutesPerSession: number
      mepBpm: number | null
      recurrenceUntil: string | null
    }
  | {
      type: "update" // in-place (event has no past occurrences) — safe to edit the series
      eventId: string
      minutesPerSession: number
      mepBpm: number | null
      recurrenceUntil: string | null
    }
  | { type: "truncate"; eventId: string; recurrenceUntil: string } // stop future, keep past
  | { type: "setRecurrenceUntil"; eventId: string; recurrenceUntil: string | null }
  | { type: "delete"; eventId: string } // only when the event has no past occurrences

/** Stable key for a weekly slot. */
export function slotKeyOf(dayOfWeek: number, time: string): string {
  return `${dayOfWeek}|${time}`
}

/** Parse a stored schedule (jsonb) into validated slots; ignores malformed
 *  entries. Pure and client-safe. */
export function parseSchedule(raw: unknown): DesiredSlot[] {
  const arr = Array.isArray(raw) ? raw : []
  const out: DesiredSlot[] = []
  for (const v of arr) {
    if (v && typeof v === "object") {
      const dow = (v as Record<string, unknown>).day_of_week
      const time = (v as Record<string, unknown>).time
      if (typeof dow === "number" && dow >= 0 && dow <= 6 && typeof time === "string" && /^\d{2}:\d{2}$/.test(time)) {
        out.push({ dayOfWeek: dow, time })
      }
    }
  }
  return out
}

/** First civil date on or after `date` (yyyy-MM-dd) that falls on `dayOfWeek`.
 *  Day-of-week of a civil date is timezone-independent, so this is pure. */
export function firstOnOrAfter(date: string, dayOfWeek: number): string {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number)
  const base = new Date(Date.UTC(y, m - 1, d))
  const delta = (((dayOfWeek - base.getUTCDay()) % 7) + 7) % 7
  base.setUTCDate(base.getUTCDate() + delta)
  return base.toISOString().slice(0, 10)
}

/** Display label, e.g. "Low Base – 45 min @ 145 bpm" (or "… – 45 min" if no MEP). */
export function lowBaseEventLabel(minutesPerSession: number, mepBpm: number | null): string {
  const base = `Low Base – ${minutesPerSession} min`
  return mepBpm != null ? `${base} @ ${Math.round(mepBpm)} bpm` : base
}

/** Event description body per spec. */
export function lowBaseEventDescription(
  mepBpm: number | null,
  minutesPerSession: number,
  prescriptionId: string
): string {
  return [
    `MEP: ${mepBpm ?? "—"}`,
    `Duration: ${minutesPerSession}`,
    `Prescription ID: ${prescriptionId}`,
  ].join("\n")
}

/** Remove a managed event: delete if wholly in the future, else truncate at
 *  yesterday so future occurrences stop while past/completed ones remain. */
function removeOp(e: ExistingManagedEvent, today: string): SyncOp {
  if (e.firstOccurrenceDay > today) return { type: "delete", eventId: e.id }
  return { type: "truncate", eventId: e.id, recurrenceUntil: previousLocalDay(today) }
}

/** Never shorten recurrence below a protected past/completed day. */
function clampUntil(until: string | null, lastHistoryDay: string | null | undefined): string | null {
  if (until && lastHistoryDay && until < lastHistoryDay) return lastHistoryDay
  return until
}

/**
 * Plan the operations to reconcile managed calendar events with the desired Low
 * Base schedule. `today` is the operating-timezone civil day (yyyy-MM-dd).
 */
export function planLowBaseSync(
  input: LowBaseScheduleInput,
  existing: ExistingManagedEvent[],
  today: string
): SyncOp[] {
  const ops: SyncOp[] = []

  const desired = new Map<string, DesiredSlot>()
  for (const s of input.slots) desired.set(slotKeyOf(s.dayOfWeek, s.time), s)

  // Index existing by slot key; any duplicate event for the same slot is removed
  // (keeps the reconciler deterministic / dedup-safe).
  const existingByKey = new Map<string, ExistingManagedEvent>()
  for (const e of existing) {
    const prev = existingByKey.get(e.slotKey)
    if (!prev) existingByKey.set(e.slotKey, e)
    else ops.push(removeOp(e, today))
  }

  // Removed slots → stop future occurrences.
  for (const [key, e] of existingByKey) {
    if (!desired.has(key)) ops.push(removeOp(e, today))
  }

  // New + changed slots.
  for (const [key, slot] of desired) {
    const e = existingByKey.get(key)
    if (!e) {
      ops.push({
        type: "create",
        slotKey: key,
        dayOfWeek: slot.dayOfWeek,
        time: slot.time,
        anchorDate: firstOnOrAfter(input.startDate, slot.dayOfWeek),
        minutesPerSession: input.minutesPerSession,
        mepBpm: input.mepBpm,
        recurrenceUntil: input.endDate,
      })
      continue
    }

    const valueChanged =
      e.mepBpm !== input.mepBpm || e.minutesPerSession !== input.minutesPerSession
    const endChanged = (e.recurrenceUntil ?? null) !== (input.endDate ?? null)

    if (valueChanged) {
      if (e.firstOccurrenceDay >= today) {
        // No past occurrences yet → editing the series is safe.
        ops.push({
          type: "update",
          eventId: e.id,
          minutesPerSession: input.minutesPerSession,
          mepBpm: input.mepBpm,
          recurrenceUntil: input.endDate,
        })
      } else {
        // Forward split — freeze the past series, start a new one today.
        ops.push({ type: "truncate", eventId: e.id, recurrenceUntil: previousLocalDay(today) })
        ops.push({
          type: "create",
          slotKey: key,
          dayOfWeek: slot.dayOfWeek,
          time: slot.time,
          anchorDate: firstOnOrAfter(today, slot.dayOfWeek),
          minutesPerSession: input.minutesPerSession,
          mepBpm: input.mepBpm,
          recurrenceUntil: input.endDate,
        })
      }
    } else if (endChanged) {
      ops.push({
        type: "setRecurrenceUntil",
        eventId: e.id,
        recurrenceUntil: clampUntil(input.endDate, e.lastHistoryDay),
      })
    }
    // else: identical → no op (idempotent).
  }

  return ops
}
