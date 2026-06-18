import { Activity, Gauge, Ruler, Scale as ScaleIcon } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getMetabolic } from "@/lib/data/metabolic"
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
import { MetabolicAssessmentForm } from "@/components/metabolic/metabolic-assessment-form"
import { PushMepButton } from "@/components/metabolic/push-mep-button"
import { AssessmentRowActions } from "@/components/metabolic/assessment-row-actions"
import { formatDate, timeAgo } from "@/lib/utils/format"
import type {
  MetabolicAssessment,
  MetabolicAssessmentWithPoints,
  MetabolicCurvePhase,
} from "@/types/models"

function fmt(v: number | null, unit = ""): string {
  if (v == null) return "—"
  return unit ? `${v} ${unit}` : String(v)
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  )
}

const SOURCE_LABEL: Record<string, string> = { cart: "Cart", manual_cart: "Manual Cart" }

/** Build [{t, value}] from one phase of the curve for a measured key. */
function curve(
  latest: MetabolicAssessmentWithPoints | null,
  phase: MetabolicCurvePhase,
  key: "ventilation_l_min" | "heart_rate_bpm"
): { t: number; value: number }[] {
  if (!latest) return []
  return latest.points
    .filter((p) => p.phase === phase && p.elapsed_sec != null && p[key] != null)
    .map((p) => ({ t: p.elapsed_sec as number, value: p[key] as number }))
}

function CurveCard({
  title,
  icon: Icon,
  data,
  color,
  unit,
}: {
  title: string
  icon: typeof Activity
  data: { t: number; value: number }[]
  color: string
  unit: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length < 2 ? (
          <EmptyState title="Not enough curve data" className="py-8" />
        ) : (
          <MetricLineChart
            data={data}
            xKey="t"
            series={[{ key: "value", label: title, color }]}
            unit={unit}
            height={180}
          />
        )}
      </CardContent>
    </Card>
  )
}

export default async function StatTrackerPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  await requireCoach()
  const { clientId } = await params
  const { assessments, latest, latestCart, latestManual, zone, lowBase, tape, scale } =
    await getMetabolic(clientId)

  // VO2 Max trend across assessments (oldest → newest).
  const vo2Trend = [...assessments]
    .reverse()
    .filter((a) => a.vo2_max != null)
    .map((a) => ({ date: a.assessed_at.slice(0, 10), vo2: a.vo2_max as number }))

  const cart = (a: MetabolicAssessment | null, k: keyof MetabolicAssessment, unit = "") =>
    fmt((a?.[k] as number | null) ?? null, unit)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Stat Tracker</h2>
        {latest && (
          <PushMepButton clientId={clientId} assessmentId={latest.id} mep={latest.mep_bpm} />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: charts */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">VO₂ Max</CardTitle>
            </CardHeader>
            <CardContent>
              {vo2Trend.length < 2 ? (
                <EmptyState
                  icon={Gauge}
                  title="Not enough VO₂ data"
                  description="Log at least two assessments to see the trend."
                  className="py-8"
                />
              ) : (
                <MetricLineChart
                  data={vo2Trend}
                  series={[{ key: "vo2", label: "VO₂ Max", color: "#8b5cf6" }]}
                  unit="ml/kg/min"
                  height={200}
                />
              )}
            </CardContent>
          </Card>

          <CurveCard
            title="Ventilation & Rate of Increase"
            icon={Activity}
            data={curve(latest, "increase", "ventilation_l_min")}
            color="#06b6d4"
            unit="L/min"
          />
          <CurveCard
            title="Ventilation & Rate of Decrease"
            icon={Activity}
            data={curve(latest, "decrease", "ventilation_l_min")}
            color="#0891b2"
            unit="L/min"
          />
          <CurveCard
            title="HR Rate of Increase"
            icon={Activity}
            data={curve(latest, "increase", "heart_rate_bpm")}
            color="#ef4444"
            unit="bpm"
          />
        </div>

        {/* Right: cards */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Ruler className="size-4" /> Tape
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <StatRow label="Bicep" value={fmt(tape.bicep_in, "in")} />
              <StatRow label="Neck" value={fmt(tape.neck_in, "in")} />
              <StatRow
                label="Hip/Waist %"
                value={tape.hipWaistPct == null ? "—" : `${tape.hipWaistPct}%`}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ScaleIcon className="size-4" /> Scale
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <StatRow
                label="Body Fat"
                value={scale.bodyFatPct == null ? "—" : `${scale.bodyFatPct}%`}
              />
              <StatRow label="Body Water" value={fmt(scale.bodyWaterLbs, "lb")} />
              <StatRow label="Lean Body Mass" value={fmt(scale.leanBodyMassLbs, "lb")} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cart</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <StatRow label="VO₂ Max" value={cart(latestCart, "vo2_max")} />
              <StatRow label="Set Point" value={cart(latestCart, "mep_bpm", "bpm")} />
              <StatRow label="Max HR" value={cart(latestCart, "max_hr_bpm", "bpm")} />
              <StatRow label="Aerobic" value={cart(latestCart, "aerobic_threshold_bpm", "bpm")} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Manual Cart</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <StatRow label="VO₂ Max" value={cart(latestManual, "vo2_max")} />
              <StatRow label="Set Point" value={cart(latestManual, "mep_bpm", "bpm")} />
              <StatRow label="Max HR" value={cart(latestManual, "max_hr_bpm", "bpm")} />
              <StatRow
                label="Calories Burned/min"
                value={cart(latestManual, "calories_burned_per_min")}
              />
            </CardContent>
          </Card>

          {/* Zone / Low Base linkage (Set Point ± 10). */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Zone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <StatRow
                label="Set Point"
                value={fmt(latest?.mep_bpm ?? null, "bpm")}
              />
              <StatRow
                label="Zone (±10)"
                value={zone ? `${zone.low}–${zone.high} bpm` : "—"}
              />
              <StatRow
                label="Low Base MEP"
                value={fmt(lowBase?.mep_bpm ?? null, "bpm")}
              />
              <p className="text-muted-foreground pt-1 text-[11px]">
                Low Base dose (minutes / sessions) is set on Weight Planning.
              </p>
              {/* TODO: Baseline Ratios card — fields unknown, deferred to a later version. */}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* History */}
      {assessments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assessment history</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">VO₂ Max</TableHead>
                    <TableHead className="text-right">Set Point</TableHead>
                    <TableHead className="text-right">Aerobic</TableHead>
                    <TableHead className="text-right">Max HR</TableHead>
                    <TableHead className="w-[56px] text-right">Del</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(a.assessed_at)}
                        <span className="text-muted-foreground block text-[11px]">
                          {timeAgo(a.assessed_at)}
                        </span>
                      </TableCell>
                      <TableCell>{SOURCE_LABEL[a.source] ?? a.source}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.vo2_max ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.mep_bpm ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.aerobic_threshold_bpm ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{a.max_hr_bpm ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <AssessmentRowActions clientId={clientId} assessmentId={a.id} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <MetabolicAssessmentForm clientId={clientId} />
    </div>
  )
}
