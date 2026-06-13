import { requireCoach } from "@/lib/auth"
import { listActiveCutsForBoard } from "@/lib/data/combat"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { CombatBoard } from "@/components/combat/combat-board"
import { Swords, AlertTriangle, CalendarClock } from "lucide-react"

export default async function CombatPage() {
  await requireCoach()
  const items = await listActiveCutsForBoard()

  const atRisk = items.filter((i) => i.readiness.level === "at_risk").length
  const within7 = items.filter(
    (i) =>
      i.readiness.daysToWeighIn != null && i.readiness.daysToWeighIn <= 7
  ).length

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <PageHeader
        title="Combat Sports"
        description="Active weight cuts, weigh-in timelines, and competition readiness across your roster."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active cuts" value={items.length} icon={Swords} />
        <StatCard
          label="Weigh-in ≤7 days"
          value={within7}
          icon={CalendarClock}
          accent={within7 > 0 ? "warning" : "default"}
        />
        <StatCard
          label="At risk"
          value={atRisk}
          icon={AlertTriangle}
          accent={atRisk > 0 ? "critical" : "success"}
        />
      </div>

      <CombatBoard items={items} />
    </main>
  )
}
