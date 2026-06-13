import Link from "next/link"
import { Scale, Trophy, CheckCircle2, Circle } from "lucide-react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { RiskBadge } from "@/components/wrestling/pace-risk-badges"
import {
  FuelingReminders,
  HydrationReminders,
} from "@/components/competitions/fueling-reminders"
import {
  initials,
  formatDate,
  formatWeight,
  relativeDays,
} from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import type { CompetitionEvent } from "@/types/models"

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
      {sub ? <p className="text-muted-foreground text-xs">{sub}</p> : null}
    </div>
  )
}

export function CompetitionEventCard({ event }: { event: CompetitionEvent }) {
  const isCut = event.source === "cut"
  const prepDone = event.prepTasks.filter((t) => t.completed).length

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <Link
          href={`/clients/${event.clientId}${isCut ? "/combat" : "/competitions"}`}
          className="flex min-w-0 items-center gap-2.5 hover:underline"
        >
          <Avatar className="size-9">
            <AvatarImage src={event.avatarUrl ?? undefined} />
            <AvatarFallback className="text-xs">{initials(event.clientName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">{event.name}</p>
            <p className="text-muted-foreground truncate text-xs">
              {event.clientName}
              {event.weightClass ? ` · ${event.weightClass}` : ""}
            </p>
          </div>
        </Link>
        <Badge variant="outline" className="shrink-0 capitalize">
          {event.status.replace("_", " ")}
        </Badge>
      </CardHeader>

      <CardContent className="flex-1 space-y-3.5 border-t pt-3.5">
        {/* dates */}
        <div className="grid grid-cols-2 gap-3">
          <Metric
            label="Competition"
            value={event.competitionAt ? formatDate(event.competitionAt) : "—"}
            sub={event.competitionAt ? relativeDays(event.competitionAt) : undefined}
          />
          <Metric
            label="Weigh-in"
            value={event.weighInAt ? formatDate(event.weighInAt) : "—"}
            sub={event.weighInAt ? relativeDays(event.weighInAt) : undefined}
          />
        </div>

        {/* cut metrics */}
        {isCut ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Current" value={formatWeight(event.currentLbs)} />
              <Metric label="Target" value={formatWeight(event.targetLbs)} />
              <Metric
                label="Projected"
                value={formatWeight(event.projectedLbs)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="bg-muted inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs">
                <Scale className="size-3" />
                {event.weeklyLossTargetLbs != null ? `${event.weeklyLossTargetLbs} lb/wk` : "—"}
              </span>
              <span className="bg-muted inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs">
                {event.dailyLossTargetLbs != null ? `${event.dailyLossTargetLbs} lb/day` : "—"}
              </span>
              {event.cutRisk ? <RiskBadge risk={event.cutRisk} /> : null}
              {event.readiness != null ? (
                <span className="text-muted-foreground text-xs">
                  readiness {event.readiness}
                </span>
              ) : null}
            </div>
          </>
        ) : null}

        {/* prep checklist */}
        {event.prepTasks.length > 0 ? (
          <div className="space-y-1">
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
              <Trophy className="size-3.5" />
              Prep ({prepDone}/{event.prepTasks.length})
            </p>
            <ul className="space-y-0.5 text-sm">
              {event.prepTasks.map((t) => {
                const Icon = t.completed ? CheckCircle2 : Circle
                return (
                  <li key={t.id} className="flex items-center gap-2">
                    <Icon
                      className={cn(
                        "size-3.5 shrink-0",
                        t.completed
                          ? "text-emerald-600 dark:text-emerald-500"
                          : "text-muted-foreground"
                      )}
                    />
                    <span className={cn("min-w-0 flex-1 truncate", t.completed && "text-muted-foreground line-through")}>
                      {t.task}
                    </span>
                    {t.dueDate && !t.completed ? (
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {relativeDays(t.dueDate)}
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}

        <HydrationReminders steps={event.hydrationPlan} />
        <FuelingReminders steps={event.fuelingReminders} />
      </CardContent>
    </Card>
  )
}
