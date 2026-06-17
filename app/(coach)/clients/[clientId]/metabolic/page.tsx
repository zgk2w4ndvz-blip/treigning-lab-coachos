import { Activity, HeartPulse, Wind } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getMetabolic, METABOLIC_METRICS } from "@/lib/data/metabolic"
import { lowBaseRange } from "@/lib/data/low-base"
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
import type { MetabolicAssessment } from "@/types/models"

function fmtMetric(
  a: MetabolicAssessment,
  key: (typeof METABOLIC_METRICS)[number]["key"]
): string {
  const v = a[key]
  return v == null ? "—" : String(v)
}

export default async function MetabolicPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  await requireCoach()
  const { clientId } = await params
  const { assessments, latest, zones, lowBase } = await getMetabolic(clientId)

  const hrCurve =
    latest?.points
      .filter((p) => p.intensity != null && p.heart_rate_bpm != null)
      .map((p) => ({ intensity: p.intensity, hr: p.heart_rate_bpm })) ?? []
  const veCurve =
    latest?.points
      .filter((p) => p.intensity != null && p.ventilation_l_min != null)
      .map((p) => ({ intensity: p.intensity, ve: p.ventilation_l_min })) ?? []

  const hrRefLines = latest
    ? [
        ...(latest.mep_bpm != null
          ? [{ y: latest.mep_bpm, label: "MEP", color: "#6366f1" }]
          : []),
        ...(latest.aerobic_threshold_bpm != null
          ? [{ y: latest.aerobic_threshold_bpm, label: "AeT", color: "#f59e0b" }]
          : []),
      ]
    : []

  const range = lowBase?.mep_bpm != null ? lowBaseRange(lowBase.mep_bpm) : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Metabolic Assessments</h2>
        {latest && (
          <PushMepButton
            clientId={clientId}
            assessmentId={latest.id}
            mep={latest.mep_bpm}
          />
        )}
      </div>

      {!latest ? (
        <EmptyState
          icon={Activity}
          title="No assessments yet"
          description="Log a metabolic assessment below to track VO₂, MEP, thresholds, and curves."
          className="py-10"
        />
      ) : (
        <>
          {/* Latest scalar results */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {METABOLIC_METRICS.map((m) => (
              <Card key={m.key}>
                <CardContent className="space-y-1 p-4">
                  <p className="text-muted-foreground text-xs font-medium">{m.label}</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {fmtMetric(latest, m.key)}
                  </p>
                  <p className="text-muted-foreground text-xs">{m.unit}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Low Base linkage */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Low Base linkage</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="space-y-0.5">
                <p className="text-muted-foreground text-xs">Current Low Base MEP</p>
                <p className="text-lg font-semibold tabular-nums">
                  {lowBase?.mep_bpm != null ? `${lowBase.mep_bpm} bpm` : "Not set"}
                  {range && (
                    <span className="text-muted-foreground ml-2 text-sm font-normal">
                      (range {range.low}–{range.high} bpm)
                    </span>
                  )}
                </p>
              </div>
              <p className="text-muted-foreground max-w-sm text-xs">
                Use “Push MEP to Low Base” above to set the Low Base prescription from
                this assessment’s MEP ({latest.mep_bpm ?? "—"} bpm). Dose (frequency &
                minutes) is preserved or seeded with defaults.
              </p>
            </CardContent>
          </Card>

          {/* Curves */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <HeartPulse className="size-4" /> Heart-rate curve
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hrCurve.length < 2 ? (
                  <EmptyState title="Not enough curve data" className="py-8" />
                ) : (
                  <MetricLineChart
                    data={hrCurve}
                    xKey="intensity"
                    series={[{ key: "hr", label: "Heart rate", color: "#ef4444" }]}
                    unit="bpm"
                    refLines={hrRefLines}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wind className="size-4" /> Ventilation curve
                </CardTitle>
              </CardHeader>
              <CardContent>
                {veCurve.length < 2 ? (
                  <EmptyState title="Not enough curve data" className="py-8" />
                ) : (
                  <MetricLineChart
                    data={veCurve}
                    xKey="intensity"
                    series={[{ key: "ve", label: "Ventilation", color: "#06b6d4" }]}
                    unit="L/min"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Heart-rate zones */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Heart-rate zones</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {zones.length === 0 ? (
                <EmptyState
                  title="Set a Max HR to compute zones"
                  className="mx-6 py-8"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zone</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">% Max HR</TableHead>
                      <TableHead className="text-right">Range (bpm)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {zones.map((z) => (
                      <TableRow key={z.zone}>
                        <TableCell className="font-medium">Z{z.zone}</TableCell>
                        <TableCell>{z.label}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {z.pctLow}–{z.pctHigh}%
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {z.minBpm}–{z.maxBpm}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* History */}
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
                      <TableHead className="text-right">VO₂ Max</TableHead>
                      <TableHead className="text-right">MEP</TableHead>
                      <TableHead className="text-right">AeT</TableHead>
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
                        <TableCell className="text-right tabular-nums">
                          {a.vo2_max ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {a.mep_bpm ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {a.aerobic_threshold_bpm ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {a.max_hr_bpm ?? "—"}
                        </TableCell>
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
        </>
      )}

      <MetabolicAssessmentForm clientId={clientId} />
    </div>
  )
}
