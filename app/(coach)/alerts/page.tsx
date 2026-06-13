import Link from "next/link"
import { Bell } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getAllComputedAlerts } from "@/lib/data/alerts"
import { RULE_META, type RuleKey } from "@/lib/alerts/rules-config"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SeverityBadge } from "@/components/shared/badges"
import { EmptyState } from "@/components/shared/empty-state"
import { timeAgo } from "@/lib/utils/format"

export default async function AlertsPage() {
  await requireCoach()
  const alerts = await getAllComputedAlerts()

  const counts = {
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length,
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <PageHeader
        title="Alerts"
        description="Live signals computed from every athlete module by the alert engine."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Critical" value={counts.critical} icon={Bell} accent={counts.critical > 0 ? "critical" : "default"} />
        <StatCard label="Warning" value={counts.warning} accent={counts.warning > 0 ? "warning" : "default"} />
        <StatCard label="Info" value={counts.info} />
      </div>

      <Card>
        <CardContent className="p-0">
          {alerts.length === 0 ? (
            <EmptyState icon={Bell} title="No active alerts" description="Every athlete is on track." className="m-6" />
          ) : (
            <ul className="divide-border divide-y">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-start gap-3 p-4">
                  <SeverityBadge severity={a.severity} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/clients/${a.client_id}`}
                      className="block font-medium hover:underline"
                    >
                      {a.title}
                    </Link>
                    {a.detail ? (
                      <p className="text-muted-foreground text-sm">{a.detail}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant="outline" className="text-[11px]">
                      {RULE_META[a.rule_key as RuleKey]?.label ?? a.rule_key}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {timeAgo(a.created_at)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
