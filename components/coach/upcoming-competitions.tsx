import Link from "next/link"
import { Trophy } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CompStatusBadge } from "@/components/shared/badges"
import { EmptyState } from "@/components/shared/empty-state"
import { formatDate, relativeDays, fullName } from "@/lib/utils/format"
import type { ClientListItem } from "@/types/models"

export function UpcomingCompetitions({ roster }: { roster: ClientListItem[] }) {
  const items = roster
    .filter((r) => r.nextCompetition)
    .sort(
      (a, b) =>
        a.nextCompetition!.competition_date.localeCompare(
          b.nextCompetition!.competition_date
        )
    )
    .slice(0, 6)

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Upcoming competitions</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No competitions scheduled"
            className="py-8"
          />
        ) : (
          <ul className="divide-border divide-y">
            {items.map(({ client, nextCompetition: comp }) => (
              <li key={comp!.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/clients/${client.id}/competitions`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {comp!.name}
                  </Link>
                  <p className="text-muted-foreground truncate text-xs">
                    {fullName(client.first_name, client.last_name)}
                    {comp!.weight_class ? ` · ${comp!.weight_class}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium">
                    {formatDate(comp!.competition_date)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {relativeDays(comp!.competition_date)}
                  </p>
                </div>
                <CompStatusBadge status={comp!.status} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
