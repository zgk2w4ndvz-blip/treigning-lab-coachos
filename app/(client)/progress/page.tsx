import { Flame, Target, TrendingDown, UserX } from "lucide-react"

import { getCurrentAthleteClientId } from "@/lib/auth"
import { getAthleteProgress } from "@/lib/data/athlete"
import { complianceAccent } from "@/lib/metrics/compliance"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/shared/stat-card"
import { ComplianceBar } from "@/components/shared/compliance-bar"
import { EmptyState } from "@/components/shared/empty-state"
import { MetricLineChart } from "@/components/charts/metric-line-chart"

const DOMAIN_LABELS: { key: keyof Compliance; label: string }[] = [
  { key: "weight", label: "Weight" },
  { key: "hydration", label: "Hydration" },
  { key: "nutrition", label: "Nutrition" },
  { key: "supplements", label: "Supplements" },
  { key: "recovery", label: "Recovery" },
]

type Compliance = {
  weight: number
  hydration: number
  nutrition: number
  supplements: number
  recovery: number
  overall: number
}

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "narrow",
  })
}

export default async function ProgressPage() {
  const clientId = await getCurrentAthleteClientId()
  const progress = clientId ? await getAthleteProgress(clientId) : null

  if (!progress) {
    return (
      <EmptyState
        icon={UserX}
        title="No athlete profile linked"
        description="Your login isn't connected to an athlete record yet. Ask your coach to add you."
      />
    )
  }

  const goal = progress.weightGoal?.target_weight ?? null

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Progress</h1>
        <p className="text-muted-foreground text-sm">
          Your trends and compliance over the last few weeks.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Overall compliance"
          value={`${progress.compliance.overall}%`}
          icon={Target}
          accent={complianceAccent(progress.compliance.overall)}
        />
        <StatCard
          label="Logging streak"
          value={progress.streakDays}
          hint={progress.streakDays === 1 ? "day" : "days"}
          icon={Flame}
          accent={progress.streakDays > 0 ? "success" : "default"}
        />
      </div>

      {progress.weightSeries.length > 1 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="size-4" /> Weight trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MetricLineChart
              data={progress.weightSeries}
              series={[{ key: "weight", label: "Weight", color: "#4f46e5" }]}
              unit="lb"
              height={200}
              refLines={goal != null ? [{ y: goal, label: "Goal" }] : []}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Compliance by area</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {DOMAIN_LABELS.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{label}</span>
              </div>
              <ComplianceBar score={progress.compliance[key]} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Last 7 days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-2">
            {progress.last7Completion.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <div className="bg-muted flex h-24 w-full items-end overflow-hidden rounded">
                  <div
                    className={cn(
                      "w-full rounded-t transition-all",
                      d.score >= 80
                        ? "bg-emerald-500"
                        : d.score >= 50
                          ? "bg-amber-500"
                          : d.score > 0
                            ? "bg-red-500"
                            : "bg-transparent"
                    )}
                    style={{ height: `${d.score}%` }}
                  />
                </div>
                <span className="text-muted-foreground text-[10px] tabular-nums">
                  {dayLabel(d.date)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
