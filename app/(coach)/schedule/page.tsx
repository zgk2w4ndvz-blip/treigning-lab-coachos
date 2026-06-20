import {
  CalendarClock,
  CheckCircle2,
  CalendarRange,
  TrendingUp,
} from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getScheduleSessions, getScheduleSummary } from "@/lib/data/schedule"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { ScheduleBoard } from "@/components/schedule/schedule-board"
import { getBypassClients } from "@/lib/dev-roster-store"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { createServerSupabase } from "@/lib/supabase/server"
import { rosterName, compareByLastFirst } from "@/lib/utils/format"

async function getAthletes(): Promise<{ id: string; name: string }[]> {
  // Athlete picker / filter dropdowns — "Last, First", ordered by last name.
  if (DEV_AUTH_BYPASS) {
    return [...getBypassClients()]
      .sort(compareByLastFirst)
      .map((c) => ({ id: c.id, name: rosterName(c.first_name, c.last_name) }))
  }
  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from("clients")
    .select("id, first_name, last_name")
    .eq("status", "active")
    .order("last_name")
    .order("first_name")
  return (data ?? []).map((c) => ({
    id: c.id,
    name: rosterName(c.first_name, c.last_name),
  }))
}

export default async function SchedulePage() {
  await requireCoach()

  const [sessions, summary, athletes] = await Promise.all([
    getScheduleSessions(),
    getScheduleSummary(),
    getAthletes(),
  ])

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <PageHeader
        title="Schedule"
        description="Manage coaching sessions, consultations, check-ins, and competition prep across your roster."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today"
          value={summary.today}
          icon={CalendarClock}
          accent={summary.today > 0 ? "warning" : "default"}
        />
        <StatCard
          label="This week"
          value={summary.thisWeek}
          icon={CalendarRange}
        />
        <StatCard
          label="Upcoming"
          value={summary.upcoming}
          icon={TrendingUp}
        />
        <StatCard
          label="Completion (14d)"
          value={`${summary.completionRate}%`}
          icon={CheckCircle2}
          accent={
            summary.completionRate >= 80
              ? "success"
              : summary.completionRate >= 60
              ? "warning"
              : summary.completionRate > 0
              ? "critical"
              : "default"
          }
        />
      </div>

      <ScheduleBoard sessions={sessions} athletes={athletes} />
    </main>
  )
}
