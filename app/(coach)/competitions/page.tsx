import { Trophy, CalendarClock, Scale, AlertTriangle } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getCompetitionBoard } from "@/lib/data/competitions"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { EmptyState } from "@/components/shared/empty-state"
import { CompetitionEventCard } from "@/components/competitions/competition-event-card"

export default async function CompetitionsPage() {
  await requireCoach()
  const board = await getCompetitionBoard()

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <PageHeader
        title="Competitions"
        description="Upcoming competitions and weigh-ins across your roster, with cut metrics, hydration, and fueling reminders."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Competitions ≤7d"
          value={board.within7}
          icon={CalendarClock}
          accent={board.within7 > 0 ? "warning" : "default"}
        />
        <StatCard label="Competitions ≤30d" value={board.within30} icon={Trophy} />
        <StatCard
          label="Weigh-ins ≤14d"
          value={board.weighInsWithin14}
          icon={Scale}
          accent={board.weighInsWithin14 > 0 ? "warning" : "default"}
        />
        <StatCard
          label="High-risk cuts"
          value={board.highRisk}
          icon={AlertTriangle}
          accent={board.highRisk > 0 ? "critical" : "success"}
        />
      </div>

      {board.events.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No upcoming competitions"
          description="Plan a cut or add a competition from an athlete's profile."
        />
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {board.events.map((event) => (
            <CompetitionEventCard key={`${event.source}-${event.id}`} event={event} />
          ))}
        </div>
      )}
    </main>
  )
}
