import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { getBypassCalendar } from "@/lib/dev-roster-store"
import { fullName } from "@/lib/utils/format"
import type { CalendarEvent } from "@/types/models"

/** Calendar events across the roster for the current window. */
export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  if (DEV_AUTH_BYPASS) return getBypassCalendar()

  const supabase = await createServerSupabase()
  const from = new Date(Date.now() - 31 * 86_400_000).toISOString()
  const to = new Date(Date.now() + 62 * 86_400_000).toISOString()
  const toDate = to.slice(0, 10)

  const [{ data: clients }, sessions, weighIns, comps] = await Promise.all([
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
  ])

  const nameById = new Map(
    (clients ?? []).map((c) => [c.id, fullName(c.first_name, c.last_name)])
  )
  const events: CalendarEvent[] = []

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
