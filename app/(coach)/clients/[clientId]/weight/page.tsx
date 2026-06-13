import { Scale } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getBodyComposition } from "@/lib/data/body-composition"
import { getClientComputedAlerts } from "@/lib/data/alerts"
import { logBodyCompositionAction } from "@/lib/actions/body-composition"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/shared/empty-state"
import { MetricLineChart } from "@/components/charts/metric-line-chart"
import { QuickLogForm } from "@/components/forms/quick-log-form"
import { ModuleAlerts } from "@/components/shared/module-alerts"
import { RangeSelector } from "@/components/shared/range-selector"
import { parseRange } from "@/lib/utils/range"
import { cn } from "@/lib/utils"
import { formatDate, timeAgo } from "@/lib/utils/format"
import type { BodyCompMetricKey, BodyCompMetricSummary } from "@/types/models"

const COLORS: Record<BodyCompMetricKey, string> = {
  weight_lbs: "#6366f1",
  body_fat_pct: "#f59e0b",
  body_fat_mass_lbs: "#ef4444",
  skeletal_muscle_mass_lbs: "#10b981",
  total_body_water_lbs: "#06b6d4",
  bmr: "#8b5cf6",
}

function fmt(value: number | null, unit: string): string {
  if (value == null) return "—"
  return unit === "%" ? `${value}%` : `${value} ${unit}`
}

function MetricCard({ m }: { m: BodyCompMetricSummary }) {
  const up = m.change != null && m.change > 0
  const down = m.change != null && m.change < 0
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="text-muted-foreground text-xs font-medium">{m.label}</p>
        <p className="text-2xl font-bold tabular-nums">{fmt(m.current, m.unit)}</p>
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>Prev: {fmt(m.previous, m.unit)}</span>
          {m.change != null ? (
            <span
              className={cn(
                "font-medium tabular-nums",
                down && "text-emerald-600 dark:text-emerald-400",
                up && "text-amber-600 dark:text-amber-400"
              )}
            >
              {m.change > 0 ? "+" : ""}
              {m.change}
              {m.unit === "%" ? "%" : ""}
            </span>
          ) : (
            <span>—</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default async function BodyCompositionPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireCoach()
  const { clientId } = await params
  const range = parseRange(await searchParams)
  const [data, alerts] = await Promise.all([
    getBodyComposition(clientId, range),
    getClientComputedAlerts(clientId),
  ])

  const { metrics, goal, logs } = data
  const byKey = (k: BodyCompMetricKey) => metrics.find((m) => m.key === k)!
  const weightMetric = byKey("weight_lbs")
  const otherMetrics = metrics.filter((m) => m.key !== "weight_lbs")
  const recent = [...logs].reverse().slice(0, 10)

  return (
    <div className="space-y-4">
      <ModuleAlerts
        alerts={alerts}
        keys={["missed_weigh_in", "weight_off_track", "aggressive_weight_cut", "cut_off_pace"]}
      />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Body Composition</h2>
        <RangeSelector value={range} />
      </div>

      {/* Current / previous / change for every metric */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {metrics.map((m) => (
          <MetricCard key={m.key} m={m} />
        ))}
      </div>

      {/* Weight trend (with goal line) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weight trend</CardTitle>
        </CardHeader>
        <CardContent>
          {weightMetric.series.length < 2 ? (
            <EmptyState icon={Scale} title="Not enough data" className="py-8" />
          ) : (
            <MetricLineChart
              data={weightMetric.series.map((p) => ({ date: p.date, weight: p.value }))}
              series={[{ key: "weight", label: "Weight", color: COLORS.weight_lbs }]}
              unit="lb"
              refLines={
                goal?.target_weight != null
                  ? [{ y: goal.target_weight, label: "Goal", color: "#10b981" }]
                  : []
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Composition trends */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Composition trends</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          {otherMetrics.map((m) => (
            <div key={m.key} className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium">
                {m.label} {m.unit === "%" ? "(%)" : `(${m.unit})`}
              </p>
              {m.series.length < 2 ? (
                <EmptyState title="Not enough data" className="py-6" />
              ) : (
                <MetricLineChart
                  data={m.series.map((p) => ({ date: p.date, value: p.value }))}
                  series={[{ key: "value", label: m.label, color: COLORS[m.key] }]}
                  unit={m.unit}
                  height={160}
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent measurements</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {recent.length === 0 ? (
              <EmptyState title="No measurements yet" className="mx-6 py-8" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Wt</TableHead>
                      <TableHead className="text-right">BF%</TableHead>
                      <TableHead className="text-right">Fat</TableHead>
                      <TableHead className="text-right">SMM</TableHead>
                      <TableHead className="text-right">TBW</TableHead>
                      <TableHead className="text-right">BMR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(l.logged_at)}
                          <span className="text-muted-foreground block text-[11px]">
                            {timeAgo(l.logged_at)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.weight_lbs ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.body_fat_pct != null ? `${l.body_fat_pct}%` : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.body_fat_mass_lbs ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.skeletal_muscle_mass_lbs ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.total_body_water_lbs ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.bmr ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <QuickLogForm
          title="Log body composition"
          action={logBodyCompositionAction.bind(null, clientId)}
          submitLabel="Save measurement"
          fields={[
            { name: "weight_lbs", label: "Weight (lb)", type: "number", step: "0.1", required: true },
            { name: "body_fat_pct", label: "Body fat %", type: "number", step: "0.1" },
            { name: "body_fat_mass_lbs", label: "Body fat mass (lb)", type: "number", step: "0.1" },
            { name: "skeletal_muscle_mass_lbs", label: "Skeletal muscle (lb)", type: "number", step: "0.1" },
            { name: "total_body_water_lbs", label: "Total body water (lb)", type: "number", step: "0.1" },
            { name: "bmr", label: "BMR (kcal)", type: "number", step: "1" },
            { name: "logged_at", label: "Date & time", type: "datetime-local" },
            { name: "notes", label: "Notes", type: "text", full: true },
          ]}
        />
      </div>
    </div>
  )
}
