import Link from "next/link"
import { Bell } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SeverityBadge } from "@/components/shared/badges"
import { EmptyState } from "@/components/shared/empty-state"
import { timeAgo } from "@/lib/utils/format"
import type { Alert } from "@/types/models"

export function AlertFeed({ alerts }: { alerts: Alert[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Alert feed</CardTitle>
        <Link href="/alerts" className="text-primary text-sm hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No active alerts"
            description="You're all caught up."
            className="py-8"
          />
        ) : (
          <ul className="divide-border divide-y">
            {alerts.map((alert) => (
              <li key={alert.id} className="flex items-start gap-3 py-3">
                <SeverityBadge severity={alert.severity} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/clients/${alert.client_id}`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {alert.title}
                  </Link>
                  {alert.detail ? (
                    <p className="text-muted-foreground truncate text-xs">
                      {alert.detail}
                    </p>
                  ) : null}
                </div>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {timeAgo(alert.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
