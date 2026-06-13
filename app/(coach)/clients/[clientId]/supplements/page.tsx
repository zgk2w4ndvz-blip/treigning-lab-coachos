import { Pill } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getSupplementData } from "@/lib/data/logs"
import { createSupplement } from "@/lib/actions/logs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/shared/empty-state"
import { ComplianceBar } from "@/components/shared/compliance-bar"
import { MetricBarChart } from "@/components/charts/metric-bar-chart"
import { QuickLogForm } from "@/components/forms/quick-log-form"
import { StatCard } from "@/components/shared/stat-card"
import { RangeSelector } from "@/components/shared/range-selector"
import { parseRange, rangeLabel } from "@/lib/utils/range"
import { supplementCompliance, complianceAccent } from "@/lib/metrics/compliance"
import type { SupplementLog } from "@/types/models"

export default async function SupplementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireCoach()
  const { clientId } = await params
  const range = parseRange(await searchParams)
  const { supplements, logs } = await getSupplementData(clientId, range)

  const active = supplements.filter((s) => s.is_active)
  const compliance = supplementCompliance(supplements, logs, range)

  // Adherence per supplement over the window.
  const adherenceById = new Map<string, number>()
  for (const s of supplements) {
    const taken = logs.filter((l) => l.supplement_id === s.id && l.taken).length
    adherenceById.set(s.id, Math.min(100, Math.round((taken / range) * 100)))
  }

  // Daily adherence % across all active supplements.
  const byDate = groupByDate(logs)
  const chartData = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, { taken }]) => {
      const pct = active.length
        ? Math.min(100, Math.round((taken / active.length) * 100))
        : 0
      return { date, pct, fill: pct < 50 ? "#ef4444" : "#8b5cf6" }
    })

  const overall =
    active.length === 0
      ? 0
      : Math.round(
          [...adherenceById.entries()]
            .filter(([id]) => active.some((s) => s.id === id))
            .reduce((s, [, v]) => s + v, 0) / active.length
        )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Supplementation</h2>
        <RangeSelector value={range} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active supplements" value={active.length} icon={Pill} />
        <StatCard
          label={`${rangeLabel(range)} adherence`}
          value={`${overall}%`}
          accent={overall >= 80 ? "success" : overall >= 50 ? "warning" : "critical"}
        />
        <StatCard label="Compliance" value={`${compliance}%`} accent={complianceAccent(compliance)} />
        <StatCard label="Logged doses" value={logs.filter((l) => l.taken).length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily adherence</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <EmptyState icon={Pill} title="No adherence logs" className="py-8" />
          ) : (
            <MetricBarChart
              data={chartData}
              bars={[{ key: "pct", label: "Adherence", color: "#8b5cf6" }]}
              unit="%"
              refLine={{ y: 100, label: "Target" }}
              colorKey="fill"
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Protocol</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {active.length === 0 ? (
              <EmptyState title="No supplements" className="py-8" />
            ) : (
              active.map((s) => (
                <div key={s.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.name}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {[s.dosage, s.timing, s.frequency].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <Badge variant="secondary">{adherenceById.get(s.id) ?? 0}%</Badge>
                  </div>
                  <ComplianceBar score={adherenceById.get(s.id) ?? 0} showValue={false} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <QuickLogForm
          title="Add supplement"
          action={createSupplement.bind(null, clientId)}
          submitLabel="Add"
          fields={[
            { name: "name", label: "Name", type: "text", required: true, full: true },
            { name: "brand", label: "Brand", type: "text" },
            { name: "dosage", label: "Dosage", type: "text", placeholder: "5 g" },
            { name: "timing", label: "Timing", type: "text", placeholder: "Morning" },
            { name: "frequency", label: "Frequency", type: "text", placeholder: "Daily" },
            { name: "purpose", label: "Purpose", type: "text", full: true },
          ]}
        />
      </div>
    </div>
  )
}

function groupByDate(logs: SupplementLog[]): Map<string, { taken: number }> {
  const m = new Map<string, { taken: number }>()
  for (const l of logs) {
    const date = l.logged_at.slice(0, 10)
    const cur = m.get(date) ?? { taken: 0 }
    if (l.taken) cur.taken++
    m.set(date, cur)
  }
  return m
}
