import { Gauge, TrendingDown, AlertTriangle, Scale, Trophy } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getWrestlingCommandCenter } from "@/lib/data/wrestling"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { EmptyState } from "@/components/shared/empty-state"
import { WrestlingBoard } from "@/components/wrestling/wrestling-board"

export default async function WrestlingPage() {
  await requireCoach()
  const cc = await getWrestlingCommandCenter()

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <PageHeader
        title="Wrestling Command Center"
        description="Projected weigh-in weight, loss-pace tracking, and cut-risk monitoring across your wrestling room."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="On pace"
          value={cc.onPace.length}
          icon={Gauge}
          accent={cc.onPace.length > 0 ? "success" : "default"}
        />
        <StatCard
          label="Off pace"
          value={cc.offPace.length}
          icon={TrendingDown}
          accent={cc.offPace.length > 0 ? "warning" : "default"}
        />
        <StatCard
          label="High-risk cuts"
          value={cc.highRisk.length}
          icon={AlertTriangle}
          accent={cc.highRisk.length > 0 ? "critical" : "success"}
        />
        <StatCard
          label="Weigh-ins ≤14d"
          value={cc.weighInsWithin14.length}
          icon={Scale}
          accent={cc.weighInsWithin14.length > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Comps ≤30d"
          value={cc.competitionsWithin30.length}
          icon={Trophy}
        />
      </div>

      {cc.rows.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="No active wrestling cuts"
          description="Plan a cut from a wrestling athlete's Combat tab to populate the command center."
        />
      ) : (
        <WrestlingBoard rows={cc.rows} />
      )}
    </main>
  )
}
