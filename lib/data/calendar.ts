import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { getBypassCalendar, getBypassClients } from "@/lib/dev-roster-store"
import { mockAthleteCalendar } from "@/lib/data/athlete-calendar"
import { athleteEventsToCalendar } from "@/lib/calendar/rollup"
import { getOperatingTimeZone } from "@/lib/data/settings"
import { DEFAULT_OPERATING_TZ } from "@/lib/calendar/timezone"
import { fullName } from "@/lib/utils/format"
import type { CalendarEvent } from "@/types/models"

const WINDOW_FROM = () => new Date(Date.now() - 31 * 86_400_000)
const WINDOW_TO = () => new Date(Date.now() + 62 * 86_400_000)

/** Calendar events across the roster for the current window. */
export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  if (DEV_AUTH_BYPASS) {
    const clients = getBypassClients()
    const nameById = new Map(clients.map((c) => [c.id, fullName(c.first_name, c.last_name)]))
    const athlete = clients
      .filter((c) => c.status === "active")
      .flatMap((c) => mockAthleteCalendar(c.id))
    const rolled = athleteEventsToCalendar(athlete, nameById, WINDOW_FROM(), WINDOW_TO(), [], DEFAULT_OPERATING_TZ)
    return [...getBypassCalendar(), ...rolled].sort((a, b) => a.date.localeCompare(b.date))
  }

  const tz = await getOperatingTimeZone()
  const supabase = await createServerSupabase()
  const from = WINDOW_FROM().toISOString()
  const to = WINDOW_TO().toISOString()
  const toDate = to.slice(0, 10)

  const [{ data: clients }, sessions, weighIns, comps, { data: athleteCal }, { data: overrides }] = await Promise.all([
    supabase.from("clients").select("id, first_name, last_name"),
    supabase
      .from("training_sessions")
      .select("id, client_id, scheduled_at, session_type, duration_min")
      .gte("scheduled_at", from)
      .lte("scheduled_at", to),
    supabase
      .from("weigh_ins")
      .select("id, client_id, scheduled_at, target_lbs")
      .gte("scheduled_at", from)
      .lte("scheduled_at", to),
    supabase
      .from("competitions")
      .select("id, client_id, name, competition_date, weight_class")
      .gte("competition_date", from.slice(0, 10))
      .lte("competition_date", toDate),
    // All planning events (recurring ones may originate before the window).
    supabase.from("athlete_calendar_events").select("*"),
    // Per-occurrence overrides (RLS scopes to this coach's events).
    supabase.from("athlete_calendar_event_overrides").select("*"),
  ])

  const nameById = new Map(
    (clients ?? []).map((c) => [c.id, fullName(c.first_name, c.last_name)])
  )
  const events: CalendarEvent[] = []
  events.push(...athleteEventsToCalendar(athleteCal ?? [], nameById, WINDOW_FROM(), WINDOW_TO(), overrides ?? [], tz))

  for (const s of sessions.data ?? []) {
    if (!s.scheduled_at) continue
    events.push({
      id: `tr-${s.id}`,
      type: "training",
      title: `${nameById.get(s.client_id) ?? "Athlete"} — training`,
      date: s.scheduled_at,
      clientId: s.client_id,
      clientName: nameById.get(s.client_id) ?? null,
      detail: s.session_type ?? "Session",
      durationMin: s.duration_min,
    })
  }
  for (const w of weighIns.data ?? []) {
    events.push({
      id: `wi-${w.id}`,
      type: "weigh_in",
      title: `${nameById.get(w.client_id) ?? "Athlete"} — weigh-in`,
      date: w.scheduled_at,
      clientId: w.client_id,
      clientName: nameById.get(w.client_id) ?? null,
      detail: w.target_lbs ? `Target ${w.target_lbs} lb` : null,
      durationMin: 30,
    })
  }
  for (const c of comps.data ?? []) {
    events.push({
      id: `comp-${c.id}`,
      type: "competition",
      title: `${c.name}`,
      date: `${c.competition_date}T09:00:00`,
      clientId: c.client_id,
      clientName: nameById.get(c.client_id) ?? null,
      detail: c.weight_class,
      durationMin: 240,
    })
  }

  return events.sort((a, b) => a.date.localeCompare(b.date))
}
