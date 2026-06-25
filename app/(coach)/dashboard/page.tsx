import Link from "next/link"
import { Users, Trophy, Bell, Activity, Swords, AlertTriangle } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getDashboardSummary } from "@/lib/data/dashboard"
import { getAgendaAttention } from "@/lib/data/agenda"
import { getInbox } from "@/lib/data/inbox"
import { listClientsForRoster } from "@/lib/data/clients"
import { listActiveCutsForBoard } from "@/lib/data/combat"
import { getCalendarEvents } from "@/lib/data/calendar"
import { cn } from "@/lib/utils"
import { PageHeader, SectionHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { AlertFeed } from "@/components/coach/alert-feed"
import { RecentMessages } from "@/components/coach/recent-messages"
import { PendingApprovals } from "@/components/coach/pending-approvals"
import { DashboardTasks } from "@/components/coach/dashboard-tasks"
import { UpcomingCompetitions } from "@/components/coach/upcoming-competitions"
import { CombatWatch } from "@/components/coach/combat-watch"
import { RosterWeek } from "@/components/coach/roster-week"

export default async function DashboardPage() {
  const profile = await requireCoach()
  const [summary, roster, cuts, calendar, attention, inbox] = await Promise.all([
    getDashboardSummary(),
    listClientsForRoster(),
    listActiveCutsForBoard(),
    getCalendarEvents(),
    getAgendaAttention(),
    getInbox(),
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

      <SectionHeader title="Today" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Active clients"
          value={summary.activeClients}
          icon={Users}
          href="/clients"
        />
        <StatCard
          label="Active cuts"
          value={summary.activeCuts}
          icon={Swords}
          href="/combat"
        />
        <StatCard
          label="Competitions ≤30d"
          value={summary.upcomingCompetitions}
          icon={Trophy}
          href="/competitions"
        />
        <StatCard
          label="Open alerts"
          value={summary.openAlerts}
          icon={Bell}
          accent={summary.openAlerts > 0 ? "critical" : "default"}
          href="/alerts"
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
          href="/clients"
        />
      </div>

      {/* Attention required — links into the Daily Agenda command center */}
      <SectionHeader title="Attention required" />
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

      {/* Actionable feeds lead the command center; the long week roster sits
          below so it never buries messages, approvals, and alerts. */}
      <SectionHeader title="Inbox & approvals" />
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentMessages items={inbox.items} />
        <PendingApprovals items={inbox.items} />
      </div>

      <SectionHeader title="Tasks & athlete alerts" />
      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardTasks tasks={summary.todaysTasks} />
        <AlertFeed alerts={summary.recentAlerts} />
      </div>

      <SectionHeader title="Upcoming 7 days" />
      <RosterWeek events={calendar} />

      <SectionHeader title="Sport" />
      <div className="grid gap-4 lg:grid-cols-2">
        <CombatWatch items={cuts} />
        <UpcomingCompetitions roster={roster} />
      </div>
    </main>
  )
}
