import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { getBypassScheduleSessions } from "@/lib/dev-roster-store"
import {
  getCreatedSessions,
  getSessionOverrides,
} from "@/lib/dev-schedule-store"
import { fullName } from "@/lib/utils/format"
import type { ScheduledSessionView, ScheduleSummary } from "@/types/models"

function getBypassSessions(): ScheduledSessionView[] {
  const overrides = getSessionOverrides()
  const created = getCreatedSessions()
  const base = getBypassScheduleSessions()

  // Merge: hand-created sessions + base mock, with status overrides applied
  const all = [...created, ...base].map((s) => {
    const o = overrides[s.id]
    return o ? { ...s, status: o.status } : s
  })

  // Deduplicate by id (created takes precedence)
  const seen = new Set<string>()
  const result: ScheduledSessionView[] = []
  for (const s of all) {
    if (!seen.has(s.id)) {
      seen.add(s.id)
      result.push(s)
    }
  }
  return result.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
}

/** All schedule sessions for the coach's schedule board. */
export async function getScheduleSessions(): Promise<ScheduledSessionView[]> {
  if (DEV_AUTH_BYPASS) return getBypassSessions()

  const supabase = await createServerSupabase()
  const from = new Date(Date.now() - 14 * 86_400_000).toISOString()
  const to   = new Date(Date.now() + 60 * 86_400_000).toISOString()

  const [{ data: sessions }, { data: clients }] = await Promise.all([
    supabase
      .from("schedule_sessions")
      .select("*")
      .gte("scheduled_at", from)
      .lte("scheduled_at", to)
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("clients")
      .select("id, first_name, last_name, avatar_url"),
  ])

  const nameById = new Map(
    (clients ?? []).map((c) => [c.id, fullName(c.first_name, c.last_name)])
  )
  const avatarById = new Map(
    (clients ?? []).map((c) => [c.id, c.avatar_url])
  )

  return (sessions ?? []).map((s) => ({
    id: s.id,
    clientId: s.client_id,
    clientName: s.client_id ? nameById.get(s.client_id) ?? null : null,
    avatarUrl: s.client_id ? avatarById.get(s.client_id) ?? null : null,
    title: s.title,
    sessionType: s.session_type,
    scheduledAt: s.scheduled_at,
    durationMin: s.duration_min,
    location: s.location,
    modality: s.modality,
    notes: s.notes,
    status: s.status,
  }))
}

/** Aggregate KPIs for the schedule page header. */
export async function getScheduleSummary(): Promise<ScheduleSummary> {
  const sessions = await getScheduleSessions()

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const weekEnd = new Date(now)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().slice(0, 10)

  const today = sessions.filter(
    (s) => s.scheduledAt.slice(0, 10) === todayStr && s.status !== "cancelled"
  ).length

  const thisWeek = sessions.filter((s) => {
    const d = s.scheduledAt.slice(0, 10)
    return d >= todayStr && d <= weekEndStr && s.status !== "cancelled"
  }).length

  const recent = sessions.filter((s) => {
    const d = s.scheduledAt.slice(0, 10)
    const twoWeeksAgo = new Date(now)
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    return d >= twoWeeksAgo.toISOString().slice(0, 10) && d <= todayStr
  })

  const completionRate =
    recent.length > 0
      ? Math.round(
          (recent.filter((s) => s.status === "completed").length / recent.length) * 100
        )
      : 0

  const upcoming = sessions.filter(
    (s) => s.scheduledAt > now.toISOString() && s.status === "scheduled"
  ).length

  return { today, thisWeek, completionRate, upcoming }
}
