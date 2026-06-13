import { Check, X, Circle } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/shared/empty-state"
import { WEIGH_IN_KIND_LABELS } from "@/lib/combat/protocols"
import { formatWeight } from "@/lib/utils/format"
import { format, parseISO } from "date-fns"
import type { WeighIn } from "@/types/models"

export function WeighInTimeline({ weighIns }: { weighIns: WeighIn[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Weigh-in timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {weighIns.length === 0 ? (
          <EmptyState
            title="No weigh-ins scheduled"
            description="Add check-ins and the official weigh-in to track the descent."
            className="py-8"
          />
        ) : (
          <ol className="space-y-3">
            {weighIns.map((w) => {
              const recorded = w.weight_lbs != null
              const Icon = !recorded
                ? Circle
                : w.made_weight
                  ? Check
                  : X
              const tone = !recorded
                ? "text-muted-foreground"
                : w.made_weight
                  ? "text-emerald-600 dark:text-emerald-500"
                  : "text-red-600 dark:text-red-500"
              return (
                <li key={w.id} className="flex items-start gap-3">
                  <Icon className={`mt-0.5 size-4 shrink-0 ${tone}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">
                        {format(parseISO(w.scheduled_at), "EEE, MMM d · h:mm a")}
                      </span>
                      <Badge variant="outline" className="text-[11px]">
                        {WEIGH_IN_KIND_LABELS[w.kind]}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {recorded
                        ? `Recorded ${formatWeight(w.weight_lbs)}`
                        : "Pending"}
                      {w.target_lbs != null
                        ? ` · target ${formatWeight(w.target_lbs)}`
                        : ""}
                      {recorded && w.made_weight != null
                        ? w.made_weight
                          ? " · made weight"
                          : " · over"
                        : ""}
                    </p>
                    {w.notes ? (
                      <p className="text-muted-foreground text-xs italic">
                        {w.notes}
                      </p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
