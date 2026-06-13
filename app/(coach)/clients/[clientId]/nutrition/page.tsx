import { Utensils } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getNutritionData } from "@/lib/data/logs"
import { getClientComputedAlerts } from "@/lib/data/alerts"
import { createNutritionLog } from "@/lib/actions/logs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/shared/empty-state"
import { ComplianceBar } from "@/components/shared/compliance-bar"
import { MetricBarChart } from "@/components/charts/metric-bar-chart"
import { QuickLogForm } from "@/components/forms/quick-log-form"
import { ModuleAlerts } from "@/components/shared/module-alerts"
import { StatCard } from "@/components/shared/stat-card"
import { RangeSelector } from "@/components/shared/range-selector"
import { parseRange, rangeLabel } from "@/lib/utils/range"
import { nutritionCompliance, complianceAccent } from "@/lib/metrics/compliance"
import { todayStr } from "@/lib/utils/format"

function avg(nums: (number | null)[]): number | null {
  const xs = nums.filter((n): n is number => n != null)
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

export default async function NutritionPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireCoach()
  const { clientId } = await params
  const range = parseRange(await searchParams)
  const [{ plan, logs }, alerts] = await Promise.all([
    getNutritionData(clientId, range),
    getClientComputedAlerts(clientId),
  ])

  const win = logs.slice(-range)
  const avgCals = avg(win.map((l) => l.calories))
  const avgProtein = avg(win.map((l) => l.protein_g))
  const avgCarbs = avg(win.map((l) => l.carbs_g))
  const avgFat = avg(win.map((l) => l.fat_g))
  const compliance = nutritionCompliance(plan, logs)

  const chartData = logs.map((l) => ({ date: l.logged_date, calories: l.calories ?? 0 }))
  const recent = [...logs].reverse().slice(0, 8)

  const macroRow = (label: string, value: number | null, target: number | null, unit = "g") => ({
    label,
    value,
    target,
    unit,
    pct: value != null && target ? (value / target) * 100 : null,
  })
  const macros = [
    macroRow("Protein", avgProtein, plan?.protein_g ?? null),
    macroRow("Carbs", avgCarbs, plan?.carbs_g ?? null),
    macroRow("Fat", avgFat, plan?.fat_g ?? null),
  ]

  return (
    <div className="space-y-4">
      <ModuleAlerts alerts={alerts} keys={["low_protein", "low_calories"]} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Nutrition</h2>
        <RangeSelector value={range} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Active plan</CardTitle>
            {plan ? <Badge variant="secondary">Active</Badge> : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {plan ? (
              <>
                <p className="font-medium">{plan.name}</p>
                <dl className="space-y-1 text-sm">
                  <Row label="Calories" value={plan.calories != null ? `${plan.calories} kcal` : "—"} />
                  <Row label="Protein" value={plan.protein_g != null ? `${plan.protein_g} g` : "—"} />
                  <Row label="Carbs" value={plan.carbs_g != null ? `${plan.carbs_g} g` : "—"} />
                  <Row label="Fat" value={plan.fat_g != null ? `${plan.fat_g} g` : "—"} />
                </dl>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">No active nutrition plan.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          <StatCard
            label={`Avg calories (${rangeLabel(range)})`}
            value={avgCals != null ? `${Math.round(avgCals)}` : "—"}
            hint={plan?.calories ? `target ${plan.calories}` : undefined}
            icon={Utensils}
          />
          <StatCard
            label="Compliance"
            value={`${compliance}%`}
            accent={complianceAccent(compliance)}
          />
          {macros.map((m) => (
            <Card key={m.label}>
              <CardContent className="space-y-2 p-5">
                <div className="flex items-baseline justify-between">
                  <p className="text-muted-foreground text-sm font-medium">{m.label}</p>
                  <p className="text-lg font-bold tabular-nums">
                    {m.value != null ? Math.round(m.value) : "—"}
                    {m.target ? <span className="text-muted-foreground text-sm font-normal"> / {m.target} g</span> : null}
                  </p>
                </div>
                {m.pct != null ? <ComplianceBar score={m.pct} showValue={false} /> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calorie intake vs target</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <EmptyState icon={Utensils} title="No nutrition logs" className="py-8" />
          ) : (
            <MetricBarChart
              data={chartData}
              bars={[{ key: "calories", label: "Calories", color: "#6366f1" }]}
              unit="kcal"
              refLine={plan?.calories ? { y: plan.calories, label: "Target" } : undefined}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent logs</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <EmptyState title="No logs yet" className="py-8" />
            ) : (
              <ul className="divide-border divide-y text-sm">
                {recent.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2 py-2.5">
                    <span>{l.logged_date}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {l.calories ?? "—"} kcal · P{l.protein_g != null ? Math.round(l.protein_g) : "—"} C
                      {l.carbs_g != null ? Math.round(l.carbs_g) : "—"} F
                      {l.fat_g != null ? Math.round(l.fat_g) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <QuickLogForm
          title="Log a meal / day"
          action={createNutritionLog.bind(null, clientId)}
          submitLabel="Save"
          fields={[
            { name: "logged_date", label: "Date", type: "date", defaultValue: todayStr(), required: true },
            { name: "meal_label", label: "Label", type: "text", placeholder: "Daily total" },
            { name: "calories", label: "Calories", type: "number", step: "1" },
            { name: "protein_g", label: "Protein (g)", type: "number", step: "1" },
            { name: "carbs_g", label: "Carbs (g)", type: "number", step: "1" },
            { name: "fat_g", label: "Fat (g)", type: "number", step: "1" },
            { name: "notes", label: "Notes", type: "text", full: true },
          ]}
        />
      </div>
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
