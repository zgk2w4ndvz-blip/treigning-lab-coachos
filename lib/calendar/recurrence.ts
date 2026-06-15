// Pure recurrence expansion — turns base events into per-day occurrences within
// a range. Client-safe (no I/O). Supports none / daily / weekly.

import type { AthleteCalendarEvent, CalendarOccurrence } from "@/types/models"

const DAY = 86_400_000
const MAX_OCCURRENCES = 1000 // safety cap per event

/** Local yyyy-MM-dd (so evening events group on the intended day). */
function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function makeOccurrence(
  ev: AthleteCalendarEvent,
  start: Date,
  durationMs: number | null,
  recurring: boolean
): CalendarOccurrence {
  const date = isoDate(start)
  return {
    key: recurring ? `${ev.id}@${date}` : ev.id,
    event: ev,
    date,
    start: start.toISOString(),
    end: durationMs != null ? new Date(start.getTime() + durationMs).toISOString() : null,
  }
}

/** Expand events into occurrences overlapping [rangeStart, rangeEnd]. */
export function expandOccurrences(
  events: AthleteCalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date
): CalendarOccurrence[] {
  const out: CalendarOccurrence[] = []
  const rs = rangeStart.getTime()
  const re = rangeEnd.getTime()

  for (const ev of events) {
    const base = new Date(ev.starts_at)
    if (Number.isNaN(base.getTime())) continue
    const durationMs = ev.ends_at ? new Date(ev.ends_at).getTime() - base.getTime() : null

    if (ev.recurrence === "none") {
      const t = base.getTime()
      if (t >= rs - DAY && t <= re) out.push(makeOccurrence(ev, base, durationMs, false))
      continue
    }

    const step = ev.recurrence === "weekly" ? 7 * DAY : DAY
    const untilTs = ev.recurrence_until
      ? new Date(`${ev.recurrence_until}T23:59:59`).getTime()
      : re
    const hardEnd = Math.min(untilTs, re)

    // Fast-forward to the first occurrence at or after the range start.
    let t = base.getTime()
    if (t < rs) {
      const steps = Math.ceil((rs - t) / step)
      t += steps * step
    }
    let count = 0
    while (t <= hardEnd && count < MAX_OCCURRENCES) {
      out.push(makeOccurrence(ev, new Date(t), durationMs, true))
      t += step
      count++
    }
  }

  return out.sort((a, b) => a.start.localeCompare(b.start))
}
