import Link from "next/link"
import { Swords, Plus } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import {
  getClientCombatDetail,
  getClientWeightSeries,
} from "@/lib/data/combat"
import { recordWeighInAction } from "@/lib/actions/combat"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import { ReadinessGauge } from "@/components/combat/readiness-gauge"
import { CutSummaryCard } from "@/components/combat/cut-summary-card"
import { CutDescentChart } from "@/components/combat/cut-descent-chart"
import { WeighInTimeline } from "@/components/combat/weigh-in-timeline"
import { RecordWeighInForm } from "@/components/combat/record-weigh-in-form"
import {
  WaterLoadCard,
  RehydrationCard,
  RefuelCard,
} from "@/components/combat/protocol-cards"
import { CutActions } from "@/components/combat/cut-actions"

export default async function ClientCombatPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  await requireCoach()
  const { clientId } = await params

  const detail = await getClientCombatDetail(clientId)

  if (!detail) {
    return (
      <EmptyState
        icon={Swords}
        title="No active weight cut"
        description="Plan a cut to manage weight class targets, weigh-ins, and rehydration and refueling protocols."
        action={
          <Button asChild>
            <Link href={`/clients/${clientId}/combat/new`}>
              <Plus className="size-4" />
              Plan a cut
            </Link>
          </Button>
        }
      />
    )
  }

  const { cut, weighIns, latestWeightLbs, readiness } = detail
  const series = await getClientWeightSeries(clientId)
  const boundRecord = recordWeighInAction.bind(null, cut.id, clientId)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Weight cut</h2>
        <CutActions cutId={cut.id} clientId={clientId} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Competition readiness</CardTitle>
          </CardHeader>
          <CardContent>
            <ReadinessGauge readiness={readiness} />
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          <CutSummaryCard
            cut={cut}
            readiness={readiness}
            latestWeightLbs={latestWeightLbs}
          />
        </div>
      </div>

      <CutDescentChart
        series={series}
        targetLbs={cut.target_weigh_in_lbs}
        classLimitLbs={cut.class_limit_lbs}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <WeighInTimeline weighIns={weighIns} />
        <RecordWeighInForm
          action={boundRecord}
          defaultTargetLbs={cut.target_weigh_in_lbs}
        />
      </div>

      <div className="grid gap-4">
        <WaterLoadCard plan={cut.water_load_plan} />
        <div className="grid gap-4 lg:grid-cols-2">
          <RehydrationCard steps={cut.hydration_restoration} />
          <RefuelCard steps={cut.refuel_protocol} />
        </div>
      </div>
    </div>
  )
}
