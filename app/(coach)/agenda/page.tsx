import { format } from "date-fns"
import { Users, Scale, Dumbbell, AlertTriangle, Flag } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getDailyAgenda, getAgendaDashboard } from "@/lib/data/agenda"
import { PageHeader, SectionHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { EmptyState } from "@/components/shared/empty-state"
import { AgendaBoard } from "@/components/coach/agenda-board"
import { AgendaDashboardView } from "@/components/agenda/agenda-dashboard"

export default async function AgendaPage() {
  await requireCoach()
  const [agendas, dashboard] = await Promise.all([getDailyAgenda(), getAgendaDashboard()])

  const urgent = agendas.filter((a) => a.priority === "urgent").length
  const attention = agendas.filter((a) => a.priority === "attention").length
  const weighIns = agendas.filter((a) => a.weighInToday).length
  const sessions = agendas.reduce((n, a) => n + a.training.length, 0)

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <PageHeader
        title="Daily Agenda"
        description={`${format(new Date(), "EEEE, MMMM d, yyyy")} · ${agendas.length} athletes, ranked by today's priority`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Athletes today" value={agendas.length} icon={Users} />
        <StatCard
          label="Urgent"
          value={urgent}
          icon={AlertTriangle}
          accent={urgent > 0 ? "critical" : "default"}
        />
        <StatCard
          label="Needs attention"
          value={attention}
          icon={Flag}
          accent={attention > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Weigh-ins"
          value={weighIns}
          icon={Scale}
          accent={weighIns > 0 ? "critical" : "default"}
        />
        <StatCard label="Sessions" value={sessions} icon={Dumbbell} />
      </div>

      {/* Phase 2C — normalized command center (Today / Attention / Upcoming) */}
      <AgendaDashboardView dashboard={dashboard} />

      <SectionHeader title="By athlete" count={agendas.length} />
      {agendas.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No active athletes"
          description="Add athletes to your roster to see their daily agendas."
        />
      ) : (
        <AgendaBoard agendas={agendas} />
      )}
    </main>
  )
}
