import { Activity, CalendarClock, Scale, TrendingDown, Utensils } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getWeightPlan } from "@/lib/data/weight-plan"
import { getClientById } from "@/lib/data/clients"
import { lowBaseRange } from "@/lib/data/low-base"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import { MetricLineChart } from "@/components/charts/metric-line-chart"
import { WeightPlanForm } from "@/components/weight-plan/weight-plan-form"
import { formatDate } from "@/lib/utils/format"

function fmt(v: number | null | undefined, unit = ""): string {
  if (v == null) return "—"
  return unit ? `${v} ${unit}` : String(v)
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {sub ? <p className="text-muted-foreground text-xs">{sub}</p> : null}
      </CardContent>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  )
}

export default async function WeightPlanPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  await requireCoach()
  const { clientId } = await params
  const [data, client] = await Promise.all([getWeightPlan(clientId), getClientById(clientId)])
  const { plan, targets, summary, nutrition, latestWeight, recentWeights, lowBase, nutritionPlan, competition } = data

  // Projection chart: weekly target weights + actual weigh-ins overlaid by date.
  const byDate = new Map<string, { date: string; target?: number; actual?: number }>()
  for (const t of targets) {
    byDate.set(t.week_start, { date: t.week_start, target: t.target_weight })
  }
  for (const w of recentWeights) {
    const d = w.logged_at.slice(0, 10)
    const row = byDate.get(d) ?? { date: d }
    row.actual = w.weight_lbs
    byDate.set(d, row)
  }
  const chartData = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  const range = lowBase?.mep_bpm != null ? lowBaseRange(lowBase.mep_bpm) : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Weight Plan</h2>
        {competition ? (
          <p className="text-muted-foreground text-xs">
            Next competition: {competition.name} · {formatDate(competition.competition_date ?? "")}
          </p>
        ) : null}
      </div>

      {!plan || !summary ? (
        <EmptyState
          icon={Scale}
          title="No weight plan yet"
          description="Create a plan below to project the weekly cut and nutrition targets."
          className="py-10"
        />
      ) : (
        <>
          {summary.aggressive ? (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300">
              Planned rate is {summary.poundsPerWeek} lb/week — above the {">"} 2 lb/week guideline. Consider a longer runway.
            </p>
          ) : null}

          {/* 1. Weight Plan Summary */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Pounds Remaining" value={fmt(summary.poundsRemaining, "lb")}
              sub={`${summary.direction === "cut" ? "to lose" : summary.direction === "gain" ? "to gain" : "maintain"}`} />
            <Stat label="Weeks Remaining" value={fmt(summary.weeksRemaining)}
              sub={summary.totalWeeks ? `of ${summary.totalWeeks} planned` : undefined} />
            <Stat label="Pounds Per Week" value={fmt(summary.poundsPerWeek, "lb")} />
            <Stat label="Daily Calorie Deficit" value={fmt(summary.dailyCalorieDeficit, "kcal")} />
          </div>

          {/* 2. Current vs Target Weight */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><Scale className="size-4" /> Current vs Target</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Row label="Latest weigh-in" value={fmt(latestWeight?.weight_lbs ?? null, "lb")} />
              <Row label="Plan start" value={fmt(plan.current_weight, "lb")} />
              <Row label="Goal" value={fmt(plan.goal_weight, "lb")} />
              <Row label="Competition" value={fmt(plan.competition_weight, "lb")} />
            </CardContent>
          </Card>

          {/* 3. Weekly Projection Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><TrendingDown className="size-4" /> Weekly projection</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length < 2 ? (
                <EmptyState title="Not enough data to chart" className="py-8" />
              ) : (
                <MetricLineChart
                  data={chartData}
                  series={[
                    { key: "target", label: "Projected", color: "#6366f1" },
                    { key: "actual", label: "Actual", color: "#10b981" },
                  ]}
                  unit="lb"
                  refLines={[{ y: plan.goal_weight, label: "Goal", color: "#10b981" }]}
                />
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* 4. Low Base Prescription */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4" /> Low Base prescription</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {lowBase ? (
                  <>
                    <Row label="MEP (Set Point)" value={fmt(lowBase.mep_bpm, "bpm")} />
                    <Row label="Zone (±10)" value={range ? `${range.low}–${range.high} bpm` : "—"} />
                    <Row label="Minutes / session" value={fmt(lowBase.minutes_per_session)} />
                    <Row label="Sessions / week" value={fmt(lowBase.frequency_per_week)} />
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">No Low Base prescription set.</p>
                )}
              </CardContent>
            </Card>

            {/* 5. Nutrition Targets */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base"><Utensils className="size-4" /> Nutrition targets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <Row label="Maintenance" value={fmt(nutrition?.maintenanceCalories ?? null, "kcal")} />
                <Row label="Daily calorie target" value={fmt(nutrition?.dailyCalorieTarget ?? null, "kcal")} />
                <Row label="Protein target" value={fmt(nutrition?.proteinTargetG ?? null, "g")} />
                <Row label="Potassium target" value={fmt(nutrition?.potassiumTargetMg ?? null, "mg")} />
                <p className="text-muted-foreground pt-1 text-[11px]">
                  {nutrition?.basis === "nutrition_plan"
                    ? "Maintenance from the active nutrition plan."
                    : nutrition?.basis === "bmr_estimate"
                      ? "Maintenance estimated from BMR × 1.5 (no nutrition plan set)."
                      : "Set a nutrition plan or log BMR to compute calorie targets."}
                  {" "}Potassium has no agreed formula and is left unset.
                </p>
              </CardContent>
            </Card>
          </div>

          {nutritionPlan ? (
            <p className="text-muted-foreground flex items-center gap-1 text-xs">
              <CalendarClock className="size-3.5" /> Active nutrition plan: {nutritionPlan.name}
              {nutritionPlan.calories != null ? ` · ${nutritionPlan.calories} kcal` : ""}
            </p>
          ) : null}
        </>
      )}

      <WeightPlanForm
        clientId={clientId}
        plan={plan}
        defaults={{
          current_weight: plan?.current_weight ?? client?.current_weight ?? latestWeight?.weight_lbs ?? null,
          goal_weight: plan?.goal_weight ?? client?.goal_weight ?? null,
        }}
      />
    </div>
  )
}
