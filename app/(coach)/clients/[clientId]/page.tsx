import { notFound } from "next/navigation"
import {
  Scale,
  Droplets,
  HeartPulse,
  Trophy,
  Utensils,
  Dumbbell,
  Pill,
  Activity,
} from "lucide-react"

import { getClientSnapshot } from "@/lib/data/clients"
import { getClientComputedAlerts } from "@/lib/data/alerts"
import { CardContent } from "@/components/ui/card"
import { OverviewCard } from "@/components/client/overview-card"
import { ComplianceBar } from "@/components/shared/compliance-bar"
import { SeverityBadge } from "@/components/shared/badges"
import { EmptyState } from "@/components/shared/empty-state"
import {
  formatWeight,
  formatDate,
  relativeDays,
  timeAgo,
} from "@/lib/utils/format"

/** One body-composition stat in the overview card; shows "—" when blank. */
function CompStat({
  label,
  value,
  unit,
}: {
  label: string
  value: number | null
  unit: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">
        {value != null ? `${value}${unit}` : "—"}
      </dd>
    </div>
  )
}

export default async function ClientOverviewPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const [snap, openAlerts] = await Promise.all([
    getClientSnapshot(clientId),
    getClientComputedAlerts(clientId),
  ])
  if (!snap) notFound()

  const {
    latestWeight,
    weightGoal,
    activeNutritionPlan,
    hydrationToday,
    latestRecovery,
    activeProgram,
    nextCompetition,
    complianceScore,
  } = snap

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Body composition → Body Comp (weight) tab */}
      <OverviewCard
        href={`/clients/${clientId}/weight`}
        icon={Scale}
        title="Body Composition"
      >
        <CardContent className="space-y-2">
          <p className="text-3xl font-bold tabular-nums">
            {formatWeight(latestWeight?.weight_lbs ?? null)}
          </p>
          {latestWeight ? (
            <p className="text-muted-foreground text-xs">
              logged {timeAgo(latestWeight.logged_at)}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">No measurements yet</p>
          )}
          {weightGoal?.target_weight ? (
            <p className="text-muted-foreground text-sm">
              Goal: {formatWeight(weightGoal.target_weight)}{" "}
              <span className="capitalize">({weightGoal.direction})</span>
            </p>
          ) : null}
          {latestWeight ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 text-sm">
              <CompStat label="Body fat" value={latestWeight.body_fat_pct} unit="%" />
              <CompStat label="Muscle (SMM)" value={latestWeight.skeletal_muscle_mass_lbs} unit=" lb" />
              <CompStat label="Fat mass" value={latestWeight.body_fat_mass_lbs} unit=" lb" />
              <CompStat label="Body water" value={latestWeight.total_body_water_lbs} unit=" lb" />
              <CompStat label="BMR" value={latestWeight.bmr} unit=" kcal" />
            </dl>
          ) : null}
        </CardContent>
      </OverviewCard>

      {/* Hydration today → Hydration tab */}
      <OverviewCard
        href={`/clients/${clientId}/hydration`}
        icon={Droplets}
        title="Hydration (today)"
      >
        <CardContent className="space-y-2">
          {hydrationToday ? (
            <>
              <p className="text-2xl font-bold tabular-nums">
                {hydrationToday.oz_consumed} oz
                {hydrationToday.oz_target ? (
                  <span className="text-muted-foreground text-base font-normal">
                    {" "}
                    / {hydrationToday.oz_target} oz
                  </span>
                ) : null}
              </p>
              {hydrationToday.oz_target ? (
                <ComplianceBar
                  score={
                    (hydrationToday.oz_consumed / hydrationToday.oz_target) * 100
                  }
                />
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground text-sm">Nothing logged today</p>
          )}
        </CardContent>
      </OverviewCard>

      {/* Recovery → Recovery tab */}
      <OverviewCard
        href={`/clients/${clientId}/recovery`}
        icon={HeartPulse}
        title="Recovery"
      >
        <CardContent className="space-y-1 text-sm">
          {latestRecovery ? (
            <dl className="space-y-1">
              <Row label="Sleep" value={latestRecovery.sleep_hours != null ? `${latestRecovery.sleep_hours} h` : "—"} />
              <Row label="Energy" value={ratio(latestRecovery.energy)} />
              <Row label="Soreness" value={ratio(latestRecovery.soreness)} />
              <Row label="Stress" value={ratio(latestRecovery.stress)} />
            </dl>
          ) : (
            <p className="text-muted-foreground">No recovery logs yet</p>
          )}
        </CardContent>
      </OverviewCard>

      {/* 7-day compliance → Nutrition tab (no dedicated compliance page) */}
      <OverviewCard
        href={`/clients/${clientId}/nutrition`}
        icon={Activity}
        title="7-day compliance"
      >
        <CardContent className="space-y-2">
          <p className="text-3xl font-bold tabular-nums">{complianceScore}%</p>
          <ComplianceBar score={complianceScore} showValue={false} />
          <p className="text-muted-foreground text-xs">
            Across weight, nutrition, hydration &amp; recovery logging.
          </p>
        </CardContent>
      </OverviewCard>

      {/* Next competition → Competitions tab */}
      <OverviewCard
        href={`/clients/${clientId}/competitions`}
        icon={Trophy}
        title="Next competition"
      >
        <CardContent className="space-y-1">
          {nextCompetition ? (
            <>
              <p className="font-medium">{nextCompetition.name}</p>
              <p className="text-muted-foreground text-sm">
                {formatDate(nextCompetition.competition_date)} ·{" "}
                {relativeDays(nextCompetition.competition_date)}
              </p>
              {nextCompetition.weight_class ? (
                <p className="text-muted-foreground text-sm">
                  Class: {nextCompetition.weight_class}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground text-sm">None scheduled</p>
          )}
        </CardContent>
      </OverviewCard>

      {/* Active plans → Nutrition tab (primary plan; single destination) */}
      <OverviewCard
        href={`/clients/${clientId}/nutrition`}
        icon={Utensils}
        title="Active plans"
      >
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Utensils className="text-muted-foreground size-3.5" />
            <span>
              {activeNutritionPlan
                ? activeNutritionPlan.name
                : "No nutrition plan"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Dumbbell className="text-muted-foreground size-3.5" />
            <span>
              {activeProgram ? activeProgram.name : "No training program"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Pill className="text-muted-foreground size-3.5" />
            <span>See supplements tab</span>
          </div>
        </CardContent>
      </OverviewCard>

      {/* Open alerts (full width) → Inbox (no per-client alerts view exists) */}
      <OverviewCard
        href="/inbox"
        title="Open alerts"
        ariaLabel="View open alerts in the inbox"
        className="lg:col-span-3"
      >
        <CardContent>
          {openAlerts.length === 0 ? (
            <EmptyState
              title="No active alerts"
              description="This athlete is on track."
              className="py-8"
            />
          ) : (
            <ul className="divide-border divide-y">
              {openAlerts.map((alert) => (
                <li key={alert.id} className="flex items-start gap-3 py-3">
                  <SeverityBadge severity={alert.severity} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{alert.title}</p>
                    {alert.detail ? (
                      <p className="text-muted-foreground text-xs">
                        {alert.detail}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {timeAgo(alert.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </OverviewCard>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}

function ratio(v: number | null): string {
  return v != null ? `${v}/10` : "—"
}
