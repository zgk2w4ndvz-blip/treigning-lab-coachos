import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import type { AthleteCalendarEvent, CalendarCategory, CalendarRecurrence } from "@/types/models"

const COACH = "00000000-0000-0000-0000-0000000000c0"

function at(daysFromToday: number, hour = 7): string {
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  d.setDate(d.getDate() + daysFromToday)
  return d.toISOString()
}

/** In-memory demo calendar for dev bypass (NOT persisted — Supabase backs prod). */
export function mockAthleteCalendar(clientId: string): AthleteCalendarEvent[] {
  const base = (
    n: number,
    category: CalendarCategory,
    title: string,
    daysFromToday: number,
    hour: number,
    recurrence: CalendarRecurrence,
    durationMin: number | null,
    description: string | null = null
  ): AthleteCalendarEvent => {
    const starts = at(daysFromToday, hour)
    return {
      id: `cal-${clientId}-${n}`,
      coach_id: COACH,
      client_id: clientId,
      category,
      title,
      description,
      starts_at: starts,
      ends_at: durationMin
        ? new Date(new Date(starts).getTime() + durationMin * 60_000).toISOString()
        : null,
      all_day: durationMin == null,
      status: daysFromToday < 0 ? "completed" : "planned",
      recurrence,
      recurrence_until: recurrence === "none" ? null : at(120, hour).slice(0, 10),
      prescription_id: null,
      details: null,
      created_at: at(-30, 0),
      updated_at: at(-30, 0),
    }
  }
  return [
    base(1, "strength", "Lower body strength", -7, 7, "weekly", 75, "Squat focus, 5x5"),
    base(2, "conditioning", "Engine intervals", -5, 17, "weekly", 45),
    base(3, "low_base", "Zone 2 aerobic", -7, 6, "weekly", 60, "Keep HR < 145"),
    base(4, "supplementation", "Creatine + D3", -10, 8, "daily", null),
    base(5, "altolab", "AltoLab altitude session", -3, 20, "weekly", 30),
    base(6, "recovery", "Mobility + sauna", -2, 18, "weekly", 40),
    base(7, "nutrition", "Carb load — pre-comp", 12, 7, "none", null, "High-carb day"),
    base(8, "hydration", "Electrolyte loading", 13, 7, "none", null),
    base(9, "weigh_in", "Official weigh-in", 14, 6, "none", null),
    base(10, "competition", "Regional Qualifier", 15, 9, "none", null, "Bring singlet + ID"),
    base(11, "testing", "Blood panel + InBody", 5, 8, "none", null),
    base(12, "check_in", "Weekly check-in call", 3, 12, "weekly", 20),
  ]
}

/** All base calendar events for one athlete (recurrence expanded by the caller). */
export async function getAthleteCalendarEvents(
  clientId: string
): Promise<AthleteCalendarEvent[]> {
  if (DEV_AUTH_BYPASS) return mockAthleteCalendar(clientId)

  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from("athlete_calendar_events")
    .select("*")
    .eq("client_id", clientId)
    .order("starts_at", { ascending: true })
  return data ?? []
}
