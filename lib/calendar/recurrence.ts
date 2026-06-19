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

function makeOccurrence(
  ev: AthleteCalendarEvent,
  start: Date,
  durationMs: number | null,
  recurring: boolean,
  overrides: Map<string, AthleteCalendarEventOverride>,
  tz: string
): CalendarOccurrence {
  const date = dayKeyInZone(start, tz)
  const override = overrides.get(overrideKey(ev.id, date)) ?? null
  return {
    key: recurring ? `${ev.id}@${date}` : ev.id,
    event: ev,
    date,
    start: start.toISOString(),
    end: durationMs != null ? new Date(start.getTime() + durationMs).toISOString() : null,
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
        out.push(makeOccurrence(ev, base, durationMs, false, overrides, timeZone))
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
        out.push(makeOccurrence(ev, occ, durationMs, true, overrides, timeZone))
      }
      n++
      guard++
    }
  }

  return out.sort((a, b) => a.start.localeCompare(b.start))
}
