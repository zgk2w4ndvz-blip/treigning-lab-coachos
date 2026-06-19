import Link from "next/link"
import { Users, Trophy, Bell, Activity, Swords, AlertTriangle } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getDashboardSummary } from "@/lib/data/dashboard"
import { getAgendaAttention } from "@/lib/data/agenda"
import { listClientsForRoster } from "@/lib/data/clients"
import { listActiveCutsForBoard } from "@/lib/data/combat"
import { getCalendarEvents } from "@/lib/data/calendar"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { AlertFeed } from "@/components/coach/alert-feed"
import { DashboardTasks } from "@/components/coach/dashboard-tasks"
import { UpcomingCompetitions } from "@/components/coach/upcoming-competitions"
import { CombatWatch } from "@/components/coach/combat-watch"
import { RosterWeek } from "@/components/coach/roster-week"

export default async function DashboardPage() {
  const profile = await requireCoach()
  const [summary, roster, cuts, calendar, attention] = await Promise.all([
    getDashboardSummary(),
    listClientsForRoster(),
    listActiveCutsForBoard(),
    getCalendarEvents(),
    getAgendaAttention(),
  ])

  const attentionStats = [
    { label: "Unapproved Rx", count: attention.unapprovedPrescriptions, href: "/inbox" },
    { label: "Unreviewed msgs", count: attention.unreviewedMessages, href: "/inbox" },
    { label: "Overdue tasks", count: attention.overdueTasks, href: "/tasks" },
    { label: "Plans behind", count: attention.weightPlansBehind, href: "/agenda" },
  ]
  const attentionTotal = attentionStats.reduce((n, s) => n + s.count, 0)

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

      {/* Phase 2C — attention strip linking into the Daily Agenda command center */}
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/agenda" className="text-muted-foreground inline-flex items-center gap-1.5 text-sm font-medium">
          <AlertTriangle className="size-4" /> Attention
          {attentionTotal === 0 ? <span className="text-muted-foreground/70">· all clear</span> : null}
        </Link>
        {attentionStats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors hover:border-primary/50",
              s.count > 0
                ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/20 dark:text-amber-300"
                : "text-muted-foreground"
            )}
          >
            {s.label}
            <span className="font-bold tabular-nums">{s.count}</span>
          </Link>
        ))}
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
