// Pure recurrence expansion — turns base events into per-day occurrences within
// a range. Client-safe (no I/O). Supports none / daily / weekly.
//
// All day-grouping and stepping resolve against an explicit operating timezone
// (never the ambient runtime zone), so the server (UTC) and the browser produce
// identical occurrence dates, and weekly events keep their local wall-clock time
// across DST transitions.

import {
  DEFAULT_OPERATING_TZ,
  addZonedDays,
  dayKeyInZone,
  zonedEndOfDay,
} from "@/lib/calendar/timezone"
import type {
  AthleteCalendarEvent,
  AthleteCalendarEventOverride,
  CalendarOccurrence,
} from "@/types/models"

const DAY = 86_400_000
const MAX_OCCURRENCES = 1000 // safety cap per event

/** Lookup key for a per-occurrence override: event id + local day. */
export function overrideKey(eventId: string, date: string): string {
  return `${eventId}@${date}`
}

/**
 * Merge an override's non-null FIELD values over the base event (the effective
 * event for one occurrence). Null = inherit from base. Status/notes are NOT
 * field overrides — they're resolved separately. Pure; exported for tests.
 */
export function applyOverride(
  ev: AthleteCalendarEvent,
  ov: AthleteCalendarEventOverride
): AthleteCalendarEvent {
  return {
    ...ev,
    title: ov.title ?? ev.title,
    description: ov.description ?? ev.description,
    category: ov.category ?? ev.category,
    all_day: ov.all_day ?? ev.all_day,
    starts_at: ov.starts_at ?? ev.starts_at,
    ends_at: ov.ends_at ?? ev.ends_at,
  }
}

/** Build one occurrence, applying any override. Returns null if cancelled. */
function makeOccurrence(
  ev: AthleteCalendarEvent,
  slotStart: Date,
  durationMs: number | null,
  recurring: boolean,
  overrides: Map<string, AthleteCalendarEventOverride>,
  tz: string
): CalendarOccurrence | null {
  // Override is keyed by the ORIGINAL slot day (stable RECURRENCE-ID), even if
  // the occurrence is rescheduled to another time/day.
  const slotDate = dayKeyInZone(slotStart, tz)
  const override = overrides.get(overrideKey(ev.id, slotDate)) ?? null
  if (override?.is_cancelled) return null // EXDATE — drop this occurrence

  const event = override ? applyOverride(ev, override) : ev
  // A rescheduled occurrence uses the override's instant; otherwise the slot.
  const start = override?.starts_at ? new Date(override.starts_at) : slotStart
  let end: string | null = null
  if (override?.ends_at) end = new Date(override.ends_at).toISOString()
  else if (durationMs != null) end = new Date(start.getTime() + durationMs).toISOString()

  return {
    key: recurring ? `${ev.id}@${slotDate}` : ev.id,
    event,
    date: dayKeyInZone(start, tz), // grouping day follows any reschedule
    start: start.toISOString(),
    end,
    status: override?.status ?? ev.status,
    override,
  }
}

/** Expand events into occurrences overlapping [rangeStart, rangeEnd], resolved
 *  against the operating `timeZone`. Pass per-occurrence overrides to resolve
 *  each occurrence's effective status. */
export function expandOccurrences(
  events: AthleteCalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date,
  overrideRows: AthleteCalendarEventOverride[] = [],
  timeZone: string = DEFAULT_OPERATING_TZ
): CalendarOccurrence[] {
  const out: CalendarOccurrence[] = []
  const rs = rangeStart.getTime()
  const re = rangeEnd.getTime()
  const overrides = new Map<string, AthleteCalendarEventOverride>()
  for (const o of overrideRows) {
    overrides.set(overrideKey(o.event_id, o.occurrence_date.slice(0, 10)), o)
  }

  for (const ev of events) {
    const base = new Date(ev.starts_at)
    if (Number.isNaN(base.getTime())) continue
    const durationMs = ev.ends_at ? new Date(ev.ends_at).getTime() - base.getTime() : null

    if (ev.recurrence === "none") {
      const t = base.getTime()
      if (t >= rs - DAY && t <= re) {
        const occ = makeOccurrence(ev, base, durationMs, false, overrides, timeZone)
        if (occ) out.push(occ)
      }
      continue
    }

    const stepDays = ev.recurrence === "weekly" ? 7 : 1
    const untilTs = ev.recurrence_until
      ? (zonedEndOfDay(ev.recurrence_until, timeZone)?.getTime() ?? re)
      : re
    const hardEnd = Math.min(untilTs, re)

    // Fast-forward close to the range start (civil stepping is done below).
    let n = 0
    if (base.getTime() < rs) {
      n = Math.max(0, Math.floor((rs - base.getTime()) / (stepDays * DAY)) - 1)
    }
    let guard = 0
    while (guard < MAX_OCCURRENCES) {
      // Each occurrence preserves the base wall-clock time in the zone.
      const occ = addZonedDays(base, n * stepDays, timeZone)
      const t = occ.getTime()
      if (t > hardEnd) break
      if (t >= rs - DAY) {
        const made = makeOccurrence(ev, occ, durationMs, true, overrides, timeZone)
        if (made) out.push(made)
      }
      n++
      guard++
    }
  }

  return out.sort((a, b) => a.start.localeCompare(b.start))
}
