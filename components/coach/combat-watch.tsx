import Link from "next/link"
import { Swords } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import { ReadinessBadge } from "@/components/combat/readiness-badge"
import { DISCIPLINE_LABELS } from "@/lib/combat/protocols"
import { fullName, formatWeight, relativeDays } from "@/lib/utils/format"
import type { CombatCutListItem } from "@/types/models"

/** Dashboard widget: cuts ranked by readiness risk + weigh-in proximity. */
export function CombatWatch({ items }: { items: CombatCutListItem[] }) {
  const ranked = [...items]
    .sort((a, b) => {
      const order = { at_risk: 0, watch: 1, on_track: 2 }
      const lv = order[a.readiness.level] - order[b.readiness.level]
      if (lv !== 0) return lv
      const ad = a.readiness.daysToWeighIn ?? Infinity
      const bd = b.readiness.daysToWeighIn ?? Infinity
      return ad - bd
    })
    .slice(0, 5)

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Weight cut watch</CardTitle>
        <Link href="/combat" className="text-primary text-sm hover:underline">
          View board
        </Link>
      </CardHeader>
      <CardContent>
        {ranked.length === 0 ? (
          <EmptyState
            icon={Swords}
            title="No active weight cuts"
            className="py-8"
          />
        ) : (
          <ul className="divide-border divide-y">
            {ranked.map((it) => (
              <li key={it.cut.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/clients/${it.client.id}/combat`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {fullName(it.client.first_name, it.client.last_name)}
                  </Link>
                  <p className="text-muted-foreground truncate text-xs">
                    {DISCIPLINE_LABELS[it.cut.discipline]}
                    {it.readiness.weightToGoLbs != null
                      ? ` · ${formatWeight(it.readiness.weightToGoLbs)} to go`
                      : ""}
                    {it.cut.weigh_in_at
                      ? ` · ${relativeDays(it.cut.weigh_in_at)}`
                      : ""}
                  </p>
                </div>
                <ReadinessBadge
                  level={it.readiness.level}
                  score={it.readiness.overall}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
