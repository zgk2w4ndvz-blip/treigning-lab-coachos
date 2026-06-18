// Roll athlete planning-calendar events up into the coach-wide CalendarEvent
// shape (used by /calendar). Maps the 14 categories onto the coach calendar's
// coarser event types. Pure.

import { expandOccurrences } from "@/lib/calendar/recurrence"
import { CATEGORY_META } from "@/lib/calendar/categories"
import type {
  AthleteCalendarEvent,
  AthleteCalendarEventOverride,
  CalendarCategory,
  CalendarEvent,
  CalendarEventType,
} from "@/types/models"

const CAT_TO_TYPE: Record<CalendarCategory, CalendarEventType> = {
  competition: "competition",
  weigh_in: "weigh_in",
  check_in: "check_in",
  testing: "check_in",
  labs: "check_in",
  note: "follow_up",
  nutrition: "consultation",
  hydration: "consultation",
  supplementation: "consultation",
  strength: "training",
  conditioning: "training",
  sport: "training",
  low_base: "training",
  recovery: "training",
  altolab: "training",
}

/** Expand + map athlete calendar events into coach CalendarEvent[] for a window.
 *  Pass per-occurrence overrides so the roll-up reflects each occurrence's
 *  effective (completed / skipped / missed) status. */
export function athleteEventsToCalendar(
  events: AthleteCalendarEvent[],
  nameById: Map<string, string>,
  from: Date,
  to: Date,
  overrides: AthleteCalendarEventOverride[] = [],
  timeZone?: string
): CalendarEvent[] {
  return expandOccurrences(events, from, to, overrides, timeZone).map((o) => {
    const ev = o.event
    const name = nameById.get(ev.client_id) ?? "Athlete"
    return {
      id: `acal-${o.key}`,
      type: CAT_TO_TYPE[ev.category],
      title: `${name} — ${ev.title}`,
      date: o.start,
      clientId: ev.client_id,
      clientName: name,
      detail: CATEGORY_META[ev.category].label,
      durationMin: o.end
        ? Math.round((new Date(o.end).getTime() - new Date(o.start).getTime()) / 60_000)
        : null,
      status: o.status,
    }
  })
}
