import { Users, Trophy, Bell, Activity, Swords } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getDashboardSummary } from "@/lib/data/dashboard"
import { listClientsForRoster } from "@/lib/data/clients"
import { listActiveCutsForBoard } from "@/lib/data/combat"
import { getCalendarEvents } from "@/lib/data/calendar"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { AlertFeed } from "@/components/coach/alert-feed"
import { DashboardTasks } from "@/components/coach/dashboard-tasks"
import { UpcomingCompetitions } from "@/components/coach/upcoming-competitions"
import { CombatWatch } from "@/components/coach/combat-watch"
import { RosterWeek } from "@/components/coach/roster-week"

export default async function DashboardPage() {
  const profile = await requireCoach()
  const [summary, roster, cuts, calendar] = await Promise.all([
    getDashboardSummary(),
    listClientsForRoster(),
    listActiveCutsForBoard(),
    getCalendarEvents(),
  ])

  const firstName = profile.full_name?.split(" ")[0]

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <PageHeader
        title="Dashboard"
        description={`Welcome back${firstName ? `, ${firstName}` : ""}. Here's your roster at a glance.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Active clients"
          value={summary.activeClients}
          icon={Users}
        />
        <StatCard
          label="Active cuts"
          value={summary.activeCuts}
          icon={Swords}
        />
        <StatCard
          label="Competitions ≤30d"
          value={summary.upcomingCompetitions}
          icon={Trophy}
        />
        <StatCard
          label="Open alerts"
          value={summary.openAlerts}
          icon={Bell}
          accent={summary.openAlerts > 0 ? "critical" : "default"}
        />
        <StatCard
          label="Avg compliance"
          value={`${summary.avgCompliance}%`}
          icon={Activity}
          accent={
            summary.avgCompliance >= 80
              ? "success"
              : summary.avgCompliance >= 50
                ? "warning"
                : "critical"
          }
        />
      </div>

      <RosterWeek events={calendar} />

      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardTasks tasks={summary.todaysTasks} />
        <AlertFeed alerts={summary.recentAlerts} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CombatWatch items={cuts} />
        <UpcomingCompetitions roster={roster} />
      </div>
    </main>
  )
}
