import { Dumbbell, CheckCircle2, Circle } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getTrainingData } from "@/lib/data/logs"
import { getClientComputedAlerts } from "@/lib/data/alerts"
import { createTrainingSession, updateTrainingSession, deleteTrainingSession } from "@/lib/actions/logs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/shared/empty-state"
import { MetricBarChart } from "@/components/charts/metric-bar-chart"
import { QuickLogForm } from "@/components/forms/quick-log-form"
import { LogRowActions } from "@/components/forms/log-row-actions"
import { ModuleAlerts } from "@/components/shared/module-alerts"
import { StatCard } from "@/components/shared/stat-card"
import { RangeSelector } from "@/components/shared/range-selector"
import { parseRange } from "@/lib/utils/range"
import { trainingCompliance, complianceAccent } from "@/lib/metrics/compliance"
import { formatDate } from "@/lib/utils/format"

export default async function TrainingPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireCoach()
  const { clientId } = await params
  const range = parseRange(await searchParams)
  const [{ program, sessions }, alerts] = await Promise.all([
    getTrainingData(clientId, range),
    getClientComputedAlerts(clientId),
  ])

  const completed = sessions.filter((s) => s.completed_at != null)
  const compliance = trainingCompliance(sessions)
  const completionRate =
    sessions.length > 0 ? Math.round((completed.length / sessions.length) * 100) : 0
  const rpes = completed.map((s) => s.rpe).filter((n): n is number => n != null)
  const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null
  const last7 = completed.filter(
    (s) => s.completed_at && new Date(s.completed_at).getTime() >= Date.now() - 7 * 86_400_000
  ).length

  const chartData = sessions
    .filter((s) => s.scheduled_at)
    .map((s) => ({
      date: (s.scheduled_at as string).slice(0, 10),
      minutes: s.duration_min ?? 0,
      fill: s.completed_at != null ? "#6366f1" : "#cbd5e1",
    }))

  const recent = [...sessions].reverse().slice(0, 10)

  return (
    <div className="space-y-4">
      <ModuleAlerts alerts={alerts} keys={["missed_training"]} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Training</h2>
        <RangeSelector value={range} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Sessions (7d)" value={last7} icon={Dumbbell} />
        <StatCard
          label="Completion"
          value={`${completionRate}%`}
          accent={completionRate >= 80 ? "success" : completionRate >= 50 ? "warning" : "critical"}
        />
        <StatCard label="Avg RPE" value={avgRpe != null ? avgRpe.toFixed(1) : "—"} />
        <StatCard label="Phase" value={program?.phase ?? "—"} hint={program?.name ?? undefined} />
        <StatCard label="Compliance" value={`${compliance}%`} accent={complianceAccent(compliance)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session volume (minutes)</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <EmptyState icon={Dumbbell} title="No sessions logged" className="py-8" />
          ) : (
            <MetricBarChart
              data={chartData}
              bars={[{ key: "minutes", label: "Duration", color: "#6366f1" }]}
              unit="min"
              colorKey="fill"
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <EmptyState title="No sessions" className="py-8" />
            ) : (
              <ul className="divide-border divide-y">
                {recent.map((s) => {
                  const done = s.completed_at != null
                  const Icon = done ? CheckCircle2 : Circle
                  return (
                    <li key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <Icon
                        className={`size-4 shrink-0 ${
                          done ? "text-emerald-600 dark:text-emerald-500" : "text-muted-foreground"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium capitalize">
                          {s.session_type ?? "Session"}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {s.scheduled_at ? formatDate(s.scheduled_at) : "—"}
                          {s.duration_min ? ` · ${s.duration_min} min` : ""}
                        </p>
                      </div>
                      {s.rpe != null ? <Badge variant="outline">RPE {s.rpe}</Badge> : null}
                      <LogRowActions
                        title="Edit training session"
                        updateAction={updateTrainingSession.bind(null, clientId, s.id)}
                        deleteAction={deleteTrainingSession.bind(null, clientId, s.id)}
                        fields={[
                          { name: "scheduled_at", label: "Date & time", type: "datetime-local", defaultValue: s.scheduled_at },
                          {
                            name: "session_type", label: "Type", type: "select",
                            defaultValue: s.session_type ?? "strength",
                            options: [
                              { value: "strength", label: "Strength" },
                              { value: "conditioning", label: "Conditioning" },
                              { value: "technique", label: "Technique" },
                              { value: "cardio", label: "Cardio" },
                            ],
                          },
                          { name: "duration_min", label: "Duration (min)", type: "number", step: "1", defaultValue: s.duration_min },
                          { name: "rpe", label: "RPE (1–10)", type: "number", step: "1", defaultValue: s.rpe },
                          { name: "completed", label: "Completed", type: "checkbox", defaultValue: done ? "on" : "" },
                          { name: "notes", label: "Notes", type: "text", full: true, defaultValue: s.notes },
                        ]}
                      />
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <QuickLogForm
          title="Log a session"
          action={createTrainingSession.bind(null, clientId)}
          submitLabel="Save session"
          fields={[
            { name: "scheduled_at", label: "Date & time", type: "datetime-local", required: true },
            {
              name: "session_type",
              label: "Type",
              type: "select",
              defaultValue: "strength",
              options: [
                { value: "strength", label: "Strength" },
                { value: "conditioning", label: "Conditioning" },
                { value: "technique", label: "Technique" },
                { value: "cardio", label: "Cardio" },
              ],
            },
            { name: "duration_min", label: "Duration (min)", type: "number", step: "1" },
            { name: "rpe", label: "RPE (1–10)", type: "number", step: "1" },
            { name: "completed", label: "Completed", type: "checkbox", defaultValue: "on" },
            { name: "notes", label: "Notes", type: "text", full: true },
          ]}
        />
      </div>
    </div>
  )
}
