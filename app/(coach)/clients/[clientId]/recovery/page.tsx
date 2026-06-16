import { HeartPulse } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getRecoveryData } from "@/lib/data/logs"
import { getClientComputedAlerts } from "@/lib/data/alerts"
import { createRecoveryLog, updateRecoveryLog, deleteRecoveryLog } from "@/lib/actions/logs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import { MetricLineChart } from "@/components/charts/metric-line-chart"
import { QuickLogForm } from "@/components/forms/quick-log-form"
import { LogRowActions } from "@/components/forms/log-row-actions"
import { ModuleAlerts } from "@/components/shared/module-alerts"
import { StatCard } from "@/components/shared/stat-card"
import { RangeSelector } from "@/components/shared/range-selector"
import { parseRange, rangeLabel } from "@/lib/utils/range"
import { recoveryCompliance, complianceAccent } from "@/lib/metrics/compliance"
import { todayStr } from "@/lib/utils/format"

function avg(nums: (number | null)[]): number | null {
  const xs = nums.filter((n): n is number => n != null)
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

export default async function RecoveryPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireCoach()
  const { clientId } = await params
  const range = parseRange(await searchParams)
  const [logs, alerts] = await Promise.all([
    getRecoveryData(clientId, range),
    getClientComputedAlerts(clientId),
  ])

  const win = logs.slice(-range)
  const avgSleep = avg(win.map((l) => l.sleep_hours))
  const avgEnergy = avg(win.map((l) => l.energy))
  const avgSoreness = avg(win.map((l) => l.soreness))
  const latest = logs.at(-1) ?? null
  const compliance = recoveryCompliance(logs, range)
  const rl = rangeLabel(range)

  const chartData = logs.map((l) => ({
    date: l.logged_date,
    sleep: l.sleep_hours,
    energy: l.energy,
    soreness: l.soreness,
    stress: l.stress,
  }))
  const recent = [...logs].reverse().slice(0, 10)

  return (
    <div className="space-y-4">
      <ModuleAlerts alerts={alerts} keys={["poor_sleep", "high_soreness"]} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recovery</h2>
        <RangeSelector value={range} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label={`Avg sleep (${rl})`}
          value={avgSleep != null ? `${avgSleep.toFixed(1)} h` : "—"}
          icon={HeartPulse}
          accent={avgSleep != null && avgSleep < 6.5 ? "warning" : "success"}
        />
        <StatCard label={`Avg energy (${rl})`} value={avgEnergy != null ? `${avgEnergy.toFixed(1)}/10` : "—"} />
        <StatCard
          label={`Avg soreness (${rl})`}
          value={avgSoreness != null ? `${avgSoreness.toFixed(1)}/10` : "—"}
          accent={avgSoreness != null && avgSoreness >= 6 ? "warning" : "default"}
        />
        <StatCard label="Latest HRV" value={latest?.hrv != null ? `${latest.hrv}` : "—"} />
        <StatCard label="Compliance" value={`${compliance}%`} accent={complianceAccent(compliance)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recovery markers</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length < 2 ? (
            <EmptyState icon={HeartPulse} title="Not enough data" className="py-8" />
          ) : (
            <MetricLineChart
              data={chartData}
              yDomain={[0, 10]}
              series={[
                { key: "sleep", label: "Sleep (h)", color: "#6366f1" },
                { key: "energy", label: "Energy", color: "#10b981" },
                { key: "soreness", label: "Soreness", color: "#f59e0b" },
                { key: "stress", label: "Stress", color: "#ef4444" },
              ]}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent days</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <EmptyState title="No recovery logs" className="py-8" />
            ) : (
              <ul className="divide-border divide-y text-sm">
                {recent.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span>{l.logged_date}</span>
                      <span className="text-muted-foreground flex gap-3 tabular-nums">
                        <span>{l.sleep_hours != null ? `${l.sleep_hours}h` : "—"}</span>
                        <span>E{l.energy ?? "—"}</span>
                        <span>S{l.soreness ?? "—"}</span>
                      </span>
                    </div>
                    <LogRowActions
                      title="Edit recovery log"
                      updateAction={updateRecoveryLog.bind(null, clientId, l.id)}
                      deleteAction={deleteRecoveryLog.bind(null, clientId, l.id)}
                      fields={[
                        { name: "logged_date", label: "Date", type: "date", defaultValue: l.logged_date },
                        { name: "sleep_hours", label: "Sleep (hours)", type: "number", step: "0.1", defaultValue: l.sleep_hours },
                        { name: "sleep_quality", label: "Sleep quality (1–10)", type: "number", step: "1", defaultValue: l.sleep_quality },
                        { name: "soreness", label: "Soreness (1–10)", type: "number", step: "1", defaultValue: l.soreness },
                        { name: "energy", label: "Energy (1–10)", type: "number", step: "1", defaultValue: l.energy },
                        { name: "stress", label: "Stress (1–10)", type: "number", step: "1", defaultValue: l.stress },
                        { name: "notes", label: "Notes", type: "text", full: true, defaultValue: l.notes },
                      ]}
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <QuickLogForm
          title="Log recovery"
          action={createRecoveryLog.bind(null, clientId)}
          submitLabel="Save"
          fields={[
            { name: "logged_date", label: "Date", type: "date", defaultValue: todayStr(), required: true },
            { name: "sleep_hours", label: "Sleep (hours)", type: "number", step: "0.1" },
            { name: "sleep_quality", label: "Sleep quality (1–10)", type: "number", step: "1" },
            { name: "soreness", label: "Soreness (1–10)", type: "number", step: "1" },
            { name: "energy", label: "Energy (1–10)", type: "number", step: "1" },
            { name: "stress", label: "Stress (1–10)", type: "number", step: "1" },
            { name: "notes", label: "Notes", type: "text", full: true },
          ]}
        />
      </div>
    </div>
  )
}
