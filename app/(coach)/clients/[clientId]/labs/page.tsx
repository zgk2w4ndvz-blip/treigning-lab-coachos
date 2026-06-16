import { notFound } from "next/navigation"
import { FlaskConical } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getBiomarkers } from "@/lib/data/biomarkers"
import {
  logBiomarkerAction,
  updateBiomarkerAction,
  deleteBiomarkerAction,
} from "@/lib/actions/biomarkers"
import { BIOMARKER_CATEGORIES } from "@/lib/validations/biomarkers"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import { MetricLineChart } from "@/components/charts/metric-line-chart"
import { QuickLogForm } from "@/components/forms/quick-log-form"
import { LogRowActions } from "@/components/forms/log-row-actions"
import type { BiomarkerSummary } from "@/types/models"

const CHART_COLOR: Record<string, string> = {
  recovery: "#10b981",
  performance: "#6366f1",
  blood: "#ef4444",
  other: "#8b5cf6",
}

function value(m: BiomarkerSummary): string {
  if (m.latest != null) return `${m.latest}${m.unit ? ` ${m.unit}` : ""}`
  return m.latestText ?? "—"
}

function MarkerCard({ m }: { m: BiomarkerSummary }) {
  const up = m.change != null && m.change > 0
  const down = m.change != null && m.change < 0
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">{m.label}</p>
          {m.change != null ? (
            <span
              className={cn(
                "text-xs font-medium tabular-nums",
                up && "text-amber-600 dark:text-amber-400",
                down && "text-emerald-600 dark:text-emerald-400"
              )}
            >
              {m.change > 0 ? "+" : ""}
              {m.change}
            </span>
          ) : null}
        </div>
        <p className="text-2xl font-bold tabular-nums">{value(m)}</p>
        <p className="text-muted-foreground text-[11px]">
          {m.measuredAt ? `latest ${formatDate(m.measuredAt)}` : ""}
          {m.previous != null ? ` · prev ${m.previous}` : ""}
        </p>
        {m.series.length >= 2 ? (
          <MetricLineChart
            data={m.series.map((p) => ({ date: p.date, value: p.value }))}
            series={[{ key: "value", label: m.label, color: CHART_COLOR[m.category] ?? CHART_COLOR.other }]}
            unit={m.unit ?? ""}
            height={120}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

export default async function LabsPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  await requireCoach()
  const { clientId } = await params
  const data = await getBiomarkers(clientId)
  if (!data) notFound()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Labs &amp; Biomarkers</h2>
        <span className="text-muted-foreground text-sm">
          {data.totalReadings} reading{data.totalReadings === 1 ? "" : "s"}
        </span>
      </div>

      {data.groups.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No biomarker readings yet"
          description="Add a reading below, or import them from Treigning Lab."
          className="py-10"
        />
      ) : (
        data.groups.map((group) => (
          <section key={group.category} className="space-y-2">
            <h3 className="text-muted-foreground px-1 text-sm font-semibold tracking-wide uppercase">
              {group.label}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.markers.map((m) => (
                <MarkerCard key={m.marker} m={m} />
              ))}
            </div>
          </section>
        ))
      )}

      {data.recent.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent readings</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-border divide-y text-sm">
              {data.recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="truncate font-medium">{r.label}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {r.value_num ?? r.value_text ?? "—"}
                      {r.unit ? ` ${r.unit}` : ""} · {formatDate(r.measured_at)}
                    </span>
                  </div>
                  <LogRowActions
                    title="Edit lab reading"
                    updateAction={updateBiomarkerAction.bind(null, clientId, r.id)}
                    deleteAction={deleteBiomarkerAction.bind(null, clientId, r.id)}
                    fields={[
                      { name: "label", label: "Marker", type: "text", defaultValue: r.label },
                      { name: "value_num", label: "Value (number)", type: "number", step: "0.01", defaultValue: r.value_num },
                      { name: "unit", label: "Unit", type: "text", defaultValue: r.unit },
                      {
                        name: "category", label: "Category", type: "select",
                        defaultValue: r.category,
                        options: BIOMARKER_CATEGORIES.map((c) => ({ value: c, label: c })),
                      },
                      { name: "value_text", label: "Text value (optional)", type: "text", defaultValue: r.value_text },
                      { name: "measured_at", label: "Measured at", type: "datetime-local", defaultValue: r.measured_at },
                    ]}
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <QuickLogForm
        title="Add lab reading"
        action={logBiomarkerAction.bind(null, clientId)}
        submitLabel="Save reading"
        fields={[
          { name: "label", label: "Marker", type: "text", required: true, placeholder: "e.g. Ferritin" },
          { name: "value_num", label: "Value (number)", type: "number", step: "0.01" },
          { name: "unit", label: "Unit", type: "text", placeholder: "e.g. ng/mL" },
          {
            name: "category",
            label: "Category",
            type: "select",
            options: BIOMARKER_CATEGORIES.map((c) => ({ value: c, label: c })),
          },
          { name: "value_text", label: "Text value (optional)", type: "text" },
          { name: "measured_at", label: "Measured at", type: "datetime-local" },
        ]}
      />
    </div>
  )
}
