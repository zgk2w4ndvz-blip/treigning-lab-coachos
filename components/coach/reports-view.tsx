import Link from "next/link"
import { Activity, HeartPulse, Scale, Trophy, Gauge, Bell } from "lucide-react"

import { Card, KpiCard, SectionHeader, Badge, StatusDot, EmptyState } from "@/components/ds"
import type { ClientListItem, Alert } from "@/types/models"

function readinessStatus(score: number): "positive" | "warning" | "critical" {
  return score >= 80 ? "positive" : score >= 60 ? "warning" : "critical"
}

// Reports (U3/U4) — roster-wide analytics from existing readers (roster + alert
// engine). No new backend, no Observation Store reads. Performance Intelligence is
// an honest placeholder (the AI tier isn't built; shown with existing data only).
export function ReportsView({
  roster,
  alerts,
}: {
  roster: ClientListItem[]
  alerts: Alert[]
}) {
  const n = roster.length
  const avgCompliance =
    n === 0 ? 0 : Math.round(roster.reduce((s, c) => s + c.complianceScore, 0) / n)
  const belowTarget = roster.filter((c) => c.complianceScore < 60).length
  const withAlerts = roster.filter((c) => c.openAlertCount > 0).length
  const upcoming = roster.filter((c) => c.nextCompetition).length
  const bodyFatVals = roster
    .map((c) => c.latestBodyFatPct)
    .filter((v): v is number => typeof v === "number")
  const avgBodyFat =
    bodyFatVals.length === 0
      ? null
      : Math.round((bodyFatVals.reduce((s, v) => s + v, 0) / bodyFatVals.length) * 10) / 10

  return (
    <div className="flex flex-1 flex-col gap-5 p-6 md:p-8">
      <div>
        <h1 className="font-sans text-[22px] font-medium tracking-normal text-ds-text-primary">
          Reports
        </h1>
        <p className="mt-1 text-sm text-ds-text-secondary">
          Roster-wide analytics across {n} athlete{n === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Avg compliance" value={`${avgCompliance}%`} icon={<Activity />} />
        <KpiCard label="Below target" value={belowTarget} icon={<HeartPulse />} />
        <KpiCard label="With open alerts" value={withAlerts} icon={<Bell />} />
        <KpiCard label="Upcoming competitions" value={upcoming} icon={<Trophy />} />
      </div>

      <Card>
        <SectionHeader
          title="Compliance · roster"
          icon={<Activity />}
          action={<span className="text-xs text-ds-text-muted">{n} athletes</span>}
        />
        {n === 0 ? (
          <EmptyState title="No athletes yet" description="Add athletes to see roster analytics." />
        ) : (
          <div role="table" aria-label="Roster compliance">
            <div
              role="row"
              className="grid grid-cols-[1fr_72px_72px_64px] gap-2 border-b border-ds-border pb-2 text-[11px] text-ds-text-muted"
            >
              <span role="columnheader">Athlete</span>
              <span role="columnheader">Compliance</span>
              <span role="columnheader">Body fat</span>
              <span role="columnheader">Alerts</span>
            </div>
            {roster.map((c) => (
              <Link
                key={c.client.id}
                href={`/clients/${c.client.id}`}
                role="row"
                className="grid grid-cols-[1fr_72px_72px_64px] items-center gap-2 rounded-control px-1 py-2 text-sm transition-colors hover:bg-ds-surface-2"
              >
                <span className="flex items-center gap-2 truncate text-ds-text-primary">
                  <StatusDot status={readinessStatus(c.complianceScore)} />
                  {c.client.first_name} {c.client.last_name}
                </span>
                <span className="tabular-nums text-ds-text-primary">{c.complianceScore}%</span>
                <span className="tabular-nums text-ds-text-secondary">
                  {c.latestBodyFatPct != null ? `${c.latestBodyFatPct}%` : "—"}
                </span>
                <span>
                  {c.openAlertCount > 0 ? (
                    <Badge tone="danger">{c.openAlertCount}</Badge>
                  ) : (
                    <span className="text-ds-text-muted">—</span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionHeader title="Body composition" icon={<Scale />} />
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-medium text-ds-text-primary">
              {avgBodyFat != null ? `${avgBodyFat}%` : "—"}
            </span>
            <span className="text-xs text-ds-text-muted">avg body fat ({bodyFatVals.length} measured)</span>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Open alerts" icon={<HeartPulse />} action={<Link href="/alerts" className="text-xs text-ds-primary-on">View all</Link>} />
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-medium text-ds-text-primary">{alerts.length}</span>
            <span className="text-xs text-ds-text-muted">across the roster</span>
          </div>
        </Card>
      </div>

      <Card>
        <SectionHeader
          title="Performance Intelligence"
          icon={<Gauge />}
          action={<Badge tone="attention">Soon</Badge>}
        />
        <EmptyState
          icon={<Gauge />}
          title="AI insights are on the roadmap"
          description="Overtraining risk, weight-cut predictions, and competition readiness will read the Observation Store once the AI tier ships. Today CoachOS shows the underlying data above."
        />
      </Card>
    </div>
  )
}
