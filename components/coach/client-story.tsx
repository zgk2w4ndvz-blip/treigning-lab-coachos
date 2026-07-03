import {
  Scale,
  HeartPulse,
  MessageSquare,
  AlertTriangle,
  Trophy,
  Utensils,
  Dumbbell,
  StickyNote,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { timeAgo, relativeDays } from "@/lib/utils/format"
import { Card, SectionHeader, EmptyState } from "@/components/ds"
import type { TimelineEvent, TimelineKind, TrendStat } from "@/lib/timeline/build"

const KIND_META: Record<TimelineKind, { icon: LucideIcon; cls: string }> = {
  weight: { icon: Scale, cls: "bg-ds-primary-bg text-ds-primary-on" },
  recovery: { icon: HeartPulse, cls: "bg-ds-primary-bg text-ds-primary-on" },
  nutrition: { icon: Utensils, cls: "bg-ds-attention-bg text-ds-attention-on" },
  training: { icon: Dumbbell, cls: "bg-ds-attention-bg text-ds-attention-on" },
  competition: { icon: Trophy, cls: "bg-ds-warning-bg text-ds-warning-on" },
  alert: { icon: AlertTriangle, cls: "bg-ds-danger-bg text-ds-danger-on" },
  note: { icon: StickyNote, cls: "bg-ds-surface-2 text-ds-text-secondary" },
  message: { icon: MessageSquare, cls: "bg-ds-surface-2 text-ds-text-secondary" },
}

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus } as const

// Story (U3 → performance timeline). The athlete's recent record as a trend
// header + a context-rich, merged timeline assembled from EXISTING per-domain
// readers (weight, body-comp, recovery, nutrition, training, competitions,
// messages, alerts, notes). Read-only; does NOT read the Observation Store.
export function ClientStory({
  subtitle,
  nextCompetition,
  trends = [],
  events,
}: {
  subtitle: string
  nextCompetition?: { name: string; competition_date: string } | null
  trends?: TrendStat[]
  events: TimelineEvent[]
}) {
  return (
    <Card>
      <SectionHeader title="Story" description={subtitle} />

      {trends.length ? (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {trends.map((t) => {
            const TIcon = t.direction ? TREND_ICON[t.direction] : null
            return (
              <div key={t.label} className="rounded-control border border-ds-border bg-ds-surface-2 px-3 py-2">
                <div className="text-[11px] text-ds-text-muted">{t.label}</div>
                <div className="text-[0.9375rem] font-medium tabular-nums text-ds-text-primary">{t.value}</div>
                {t.delta ? (
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ds-text-secondary">
                    {TIcon ? <TIcon className="size-3" /> : null}
                    <span className="tabular-nums">{t.delta}</span>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}

      {nextCompetition ? (
        <div className="mb-3 flex items-center gap-3 rounded-control border border-ds-border bg-ds-surface-2 px-3 py-2.5">
          <span className="flex size-7 items-center justify-center rounded-control bg-ds-warning-bg text-ds-warning-on">
            <Trophy className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[0.8125rem] font-medium text-ds-text-primary">
              Upcoming: {nextCompetition.name}
            </div>
            <div className="text-xs text-ds-text-muted">
              {relativeDays(nextCompetition.competition_date)}
            </div>
          </div>
        </div>
      ) : null}

      {events.length === 0 ? (
        <EmptyState
          title="No story yet"
          description="Logged weight, body comp, recovery, nutrition, training, messages, and competitions will appear here over time."
        />
      ) : (
        <div className="relative">
          {events.map((e, i) => {
            const meta = KIND_META[e.kind]
            const Icon = meta.icon
            return (
              <div key={e.id} className="flex gap-3 pb-3 last:pb-0">
                <div className="flex flex-col items-center">
                  <span className={`flex size-7 items-center justify-center rounded-control ${meta.cls}`}>
                    <Icon className="size-4" />
                  </span>
                  {i < events.length - 1 ? (
                    <span className="mt-1 w-px flex-1 bg-ds-border" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[0.8125rem] font-medium text-ds-text-primary">
                      {e.title}
                    </span>
                    <span className="shrink-0 text-xs text-ds-text-muted">{timeAgo(e.at)}</span>
                  </div>
                  {e.detail ? (
                    <div className="mt-0.5 truncate text-xs text-ds-text-muted">{e.detail}</div>
                  ) : null}
                  {e.context ? (
                    <div className="mt-0.5 text-[11px] font-medium tabular-nums text-ds-text-secondary">{e.context}</div>
                  ) : null}
                  {e.source ? (
                    <div className="mt-1 text-[11px] text-ds-text-secondary">{e.source}</div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
