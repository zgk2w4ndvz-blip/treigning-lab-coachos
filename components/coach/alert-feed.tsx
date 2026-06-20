import { Bell } from "lucide-react"

import { AlertCard } from "@/components/shared/alert-card"
import { ActionRow } from "@/components/shared/action-row"
import { SeverityBadge } from "@/components/shared/badges"
import { timeAgo } from "@/lib/utils/format"
import type { Alert } from "@/types/models"

export function AlertFeed({ alerts }: { alerts: Alert[] }) {
  const hasCritical = alerts.some((a) => a.severity === "critical")

  return (
    <AlertCard
      title="Athlete alerts"
      icon={Bell}
      viewAllHref="/alerts"
      accent={hasCritical ? "critical" : "default"}
      isEmpty={alerts.length === 0}
      emptyTitle="No active alerts"
      emptyDescription="You're all caught up."
    >
      {alerts.map((alert) => (
        <ActionRow
          key={alert.id}
          leading={<SeverityBadge severity={alert.severity} />}
          title={alert.title}
          titleHref={`/clients/${alert.client_id}`}
          subtitle={alert.detail ?? undefined}
          meta={timeAgo(alert.created_at)}
        />
      ))}
    </AlertCard>
  )
}
