import { AlertTriangle, CalendarClock, Scale, Timer, Trophy } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ComplianceBar } from "@/components/shared/compliance-bar"
import { CUT_STATUS_LABELS, DISCIPLINE_LABELS } from "@/lib/combat/protocols"
import {
  formatWeight,
  formatDate,
  relativeDays,
} from "@/lib/utils/format"
import type { ReadinessScore, WeightCut } from "@/types/models"

export function CutSummaryCard({
  cut,
  readiness,
  latestWeightLbs,
}: {
  cut: WeightCut
  readiness: ReadinessScore
  latestWeightLbs: number | null
}) {
  const cutFromWalkAround =
    cut.walk_around_lbs != null
      ? cut.walk_around_lbs - cut.target_weigh_in_lbs
      : null

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">
            {DISCIPLINE_LABELS[cut.discipline]}
            {cut.class_name ? ` · ${cut.class_name}` : ""}
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Class limit {formatWeight(cut.class_limit_lbs)} · target{" "}
            {formatWeight(cut.target_weigh_in_lbs)}
          </p>
        </div>
        <Badge variant="outline">{CUT_STATUS_LABELS[cut.status]}</Badge>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric
            icon={Scale}
            label="Current"
            value={formatWeight(latestWeightLbs)}
          />
          <Metric
            icon={Scale}
            label="To go"
            value={
              readiness.weightToGoLbs != null
                ? `${formatWeight(readiness.weightToGoLbs)}${
                    readiness.pctBodyweightToGo != null
                      ? ` · ${readiness.pctBodyweightToGo}%`
                      : ""
                  }`
                : "—"
            }
          />
          <Metric
            icon={CalendarClock}
            label="Weigh-in"
            value={cut.weigh_in_at ? formatDate(cut.weigh_in_at) : "—"}
            sub={cut.weigh_in_at ? relativeDays(cut.weigh_in_at) : undefined}
          />
          <Metric
            icon={Timer}
            label="Rehydration window"
            value={
              cut.rehydration_window_hours != null
                ? `${cut.rehydration_window_hours} h`
                : "—"
            }
          />
        </div>

        {cutFromWalkAround != null ? (
          <div className="space-y-1">
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>Total descent from walk-around</span>
              <span className="tabular-nums">
                {formatWeight(cut.walk_around_lbs)} →{" "}
                {formatWeight(cut.target_weigh_in_lbs)}
              </span>
            </div>
            <ComplianceBar
              score={
                cutFromWalkAround > 0 && readiness.weightToGoLbs != null
                  ? ((cutFromWalkAround - readiness.weightToGoLbs) /
                      cutFromWalkAround) *
                    100
                  : 100
              }
            />
          </div>
        ) : null}

        {cut.competition_at ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Trophy className="size-4" />
            Competition {formatDate(cut.competition_at)} ·{" "}
            {relativeDays(cut.competition_at)}
          </p>
        ) : null}

        {readiness.flags.length > 0 ? (
          <ul className="space-y-1.5">
            {readiness.flags.map((flag) => (
              <li
                key={flag}
                className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {flag}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Scale
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground flex items-center gap-1 text-xs">
        <Icon className="size-3.5" />
        {label}
      </p>
      <p className="font-semibold tabular-nums">{value}</p>
      {sub ? <p className="text-muted-foreground text-xs">{sub}</p> : null}
    </div>
  )
}
