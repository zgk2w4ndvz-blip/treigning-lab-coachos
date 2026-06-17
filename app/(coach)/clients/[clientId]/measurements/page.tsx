import { Ruler } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getMeasurements } from "@/lib/data/measurements"
import { logMeasurementAction } from "@/lib/actions/measurements"
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
import { MeasurementRowActions } from "@/components/forms/measurement-row-actions"
import { RangeSelector } from "@/components/shared/range-selector"
import { parseRange } from "@/lib/utils/range"
import { cn } from "@/lib/utils"
import { formatDate, timeAgo } from "@/lib/utils/format"
import type {
  MeasurementMetricKey,
  MeasurementMetricSummary,
} from "@/types/models"

const COLORS: Partial<Record<MeasurementMetricKey, string>> = {
  waist_in: "#6366f1",
  hips_in: "#f59e0b",
  chest_in: "#ef4444",
  shoulder_in: "#10b981",
  thigh_in: "#06b6d4",
  calves_in: "#8b5cf6",
  wrist_in: "#ec4899",
  ankle_in: "#14b8a6",
  neck_in: "#f97316",
  bicep_in: "#84cc16",
  hip_waist_ratio: "#6366f1",
  waist_height_ratio: "#f59e0b",
}

const DEFAULT_COLOR = "#6366f1"

function fmt(value: number | null, unit: string): string {
  if (value == null) return "—"
  return unit ? `${value} ${unit}` : String(value)
}

/** Lower waist / lower ratios read as improvement → green when decreasing. */
function MetricCard({ m }: { m: MeasurementMetricSummary }) {
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
            </span>
          ) : (
            <span>—</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function TrendChart({ m }: { m: MeasurementMetricSummary }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium">
        {m.label} {m.unit ? `(${m.unit})` : ""}
      </p>
      {m.series.length < 2 ? (
        <EmptyState title="Not enough data" className="py-6" />
      ) : (
        <MetricLineChart
          data={m.series.map((p) => ({ date: p.date, value: p.value }))}
          series={[{ key: "value", label: m.label, color: COLORS[m.key] ?? DEFAULT_COLOR }]}
          unit={m.unit}
          height={160}
        />
      )}
    </div>
  )
}

export default async function MeasurementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireCoach()
  const { clientId } = await params
  const range = parseRange(await searchParams)
  const data = await getMeasurements(clientId, range)

  const { sites, ratios, logs } = data
  const recent = [...logs].reverse().slice(0, 10)
  const cards = [...ratios, ...sites]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Measurements</h2>
        <RangeSelector value={range} />
      </div>

      {/* Derived ratios + current/previous/change for every site */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((m) => (
          <MetricCard key={m.key} m={m} />
        ))}
      </div>

      {/* Ratio trends */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ratio trends</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          {ratios.map((m) => (
            <TrendChart key={m.key} m={m} />
          ))}
        </CardContent>
      </Card>

      {/* Site trends */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Circumference trends</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          {sites.map((m) => (
            <TrendChart key={m.key} m={m} />
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
              <EmptyState
                icon={Ruler}
                title="No measurements yet"
                className="mx-6 py-8"
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Waist</TableHead>
                      <TableHead className="text-right">Hips</TableHead>
                      <TableHead className="text-right">Chest</TableHead>
                      <TableHead className="text-right">Neck</TableHead>
                      <TableHead className="text-right">Bicep</TableHead>
                      <TableHead className="w-[72px] text-right">Edit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(l.measured_at)}
                          <span className="text-muted-foreground block text-[11px]">
                            {timeAgo(l.measured_at)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.waist_in ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.hips_in ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.chest_in ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.neck_in ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.bicep_in ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <MeasurementRowActions clientId={clientId} measurement={l} />
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
          title="Log measurements"
          action={logMeasurementAction.bind(null, clientId)}
          submitLabel="Save measurement"
          fields={[
            { name: "waist_in", label: "Waist (in)", type: "number", step: "0.1" },
            { name: "hips_in", label: "Hips (in)", type: "number", step: "0.1" },
            { name: "chest_in", label: "Chest (in)", type: "number", step: "0.1" },
            { name: "shoulder_in", label: "Shoulder (in)", type: "number", step: "0.1" },
            { name: "thigh_in", label: "Thigh (in)", type: "number", step: "0.1" },
            { name: "calves_in", label: "Calves (in)", type: "number", step: "0.1" },
            { name: "wrist_in", label: "Wrist (in)", type: "number", step: "0.1" },
            { name: "ankle_in", label: "Ankle (in)", type: "number", step: "0.1" },
            { name: "neck_in", label: "Neck (in)", type: "number", step: "0.1" },
            { name: "bicep_in", label: "Bicep (in)", type: "number", step: "0.1" },
            { name: "height_in", label: "Height (in)", type: "number", step: "0.1" },
            { name: "measured_at", label: "Date & time", type: "datetime-local" },
            { name: "notes", label: "Notes", type: "text", full: true },
          ]}
        />
      </div>
    </div>
  )
}
