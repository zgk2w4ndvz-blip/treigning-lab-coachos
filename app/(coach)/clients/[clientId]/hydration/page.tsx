import { Droplets } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getHydrationData } from "@/lib/data/logs"
import { getClientComputedAlerts } from "@/lib/data/alerts"
import { createHydrationLog } from "@/lib/actions/logs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import { MetricBarChart } from "@/components/charts/metric-bar-chart"
import { QuickLogForm } from "@/components/forms/quick-log-form"
import { ModuleAlerts } from "@/components/shared/module-alerts"
import { StatCard } from "@/components/shared/stat-card"
import { RangeSelector } from "@/components/shared/range-selector"
import { parseRange, rangeLabel } from "@/lib/utils/range"
import { hydrationCompliance, complianceAccent } from "@/lib/metrics/compliance"
import { formatDate, todayStr } from "@/lib/utils/format"

export default async function HydrationPage({
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
    getHydrationData(clientId, range),
    getClientComputedAlerts(clientId),
  ])

  const latest = logs.at(-1) ?? null
  const withTarget = logs.filter((l) => l.oz_target)
  const avgPct =
    withTarget.length > 0
      ? Math.round(
          (withTarget.reduce(
            (s, l) => s + l.oz_consumed / (l.oz_target as number),
            0
          ) /
            withTarget.length) *
            100
        )
      : 0
  const compliance = hydrationCompliance(logs)
  const streak = countStreak(logs)

  const chartData = logs.map((l) => ({
    date: l.logged_date,
    oz: l.oz_consumed,
    target: l.oz_target ?? 0,
    fill:
      l.oz_target && l.oz_consumed / l.oz_target < 0.5 ? "#ef4444" : "#0ea5e9",
  }))
  const target = latest?.oz_target ?? null
  const recent = [...logs].reverse().slice(0, 10)

  return (
    <div className="space-y-4">
      <ModuleAlerts alerts={alerts} keys={["low_hydration"]} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Hydration</h2>
        <RangeSelector value={range} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Today"
          value={latest ? `${latest.oz_consumed} oz` : "—"}
          hint={target ? `of ${target} oz` : undefined}
          icon={Droplets}
        />
        <StatCard
          label={`${rangeLabel(range)} avg`}
          value={`${avgPct}%`}
          accent={avgPct >= 80 ? "success" : avgPct >= 50 ? "warning" : "critical"}
        />
        <StatCard label="Target" value={target ? `${target} oz` : "—"} />
        <StatCard label="On-target streak" value={`${streak}d`} accent={streak >= 3 ? "success" : "default"} />
        <StatCard label="Compliance" value={`${compliance}%`} accent={complianceAccent(compliance)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily hydration vs target</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <EmptyState icon={Droplets} title="No hydration logs" className="py-8" />
          ) : (
            <MetricBarChart
              data={chartData}
              bars={[{ key: "oz", label: "Consumed", color: "#0ea5e9" }]}
              unit="oz"
              refLine={target ? { y: target, label: "Target" } : undefined}
              colorKey="fill"
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
              <EmptyState title="No logs yet" className="py-8" />
            ) : (
              <ul className="divide-border divide-y">
                {recent.map((l) => {
                  const pct = l.oz_target ? Math.round((l.oz_consumed / l.oz_target) * 100) : null
                  return (
                    <li key={l.id} className="flex items-center justify-between py-2.5 text-sm">
                      <span>{formatDate(l.logged_date)}</span>
                      <span className="tabular-nums">
                        {l.oz_consumed}
                        {l.oz_target ? ` / ${l.oz_target}` : ""} oz
                        {pct != null ? (
                          <span
                            className={
                              pct >= 80
                                ? "text-emerald-600 dark:text-emerald-500"
                                : pct >= 50
                                  ? "text-amber-600 dark:text-amber-500"
                                  : "text-red-600 dark:text-red-500"
                            }
                          >
                            {" "}
                            · {pct}%
                          </span>
                        ) : null}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <QuickLogForm
          title="Log hydration"
          action={createHydrationLog.bind(null, clientId)}
          submitLabel="Save"
          fields={[
            { name: "logged_date", label: "Date", type: "date", defaultValue: todayStr(), required: true },
            { name: "oz_consumed", label: "Consumed (oz)", type: "number", step: "1", required: true },
            { name: "oz_target", label: "Target (oz)", type: "number", step: "1", defaultValue: target ? String(target) : undefined },
            { name: "notes", label: "Notes", type: "text", full: true },
          ]}
        />
      </div>
    </div>
  )
}

function countStreak(
  logs: { oz_consumed: number; oz_target: number | null }[]
): number {
  let streak = 0
  for (let i = logs.length - 1; i >= 0; i--) {
    const l = logs[i]
    if (l.oz_target && l.oz_consumed / l.oz_target >= 0.8) streak++
    else break
  }
  return streak
}
