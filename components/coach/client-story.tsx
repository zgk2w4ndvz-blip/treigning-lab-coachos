import {
  Scale,
  HeartPulse,
  MessageSquare,
  AlertTriangle,
  Trophy,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { timeAgo, relativeDays } from "@/lib/utils/format"
import { Card, SectionHeader, EmptyState } from "@/components/ds"

export type StoryEventKind = "weight" | "recovery" | "alert" | "message"

export interface StoryEvent {
  id: string
  kind: StoryEventKind
  title: string
  detail?: string | null
  source?: string | null
  at: string
}

const KIND_META: Record<StoryEventKind, { icon: LucideIcon; cls: string }> = {
  weight: { icon: Scale, cls: "bg-ds-primary-bg text-ds-primary-on" },
  recovery: { icon: HeartPulse, cls: "bg-ds-primary-bg text-ds-primary-on" },
  alert: { icon: AlertTriangle, cls: "bg-ds-danger-bg text-ds-danger-on" },
  message: { icon: MessageSquare, cls: "bg-ds-surface-2 text-ds-text-secondary" },
}

// Story (U3) — the athlete's recent record as a narrative timeline, assembled from
// EXISTING per-domain readers (weight, recovery, alerts, messages). Read-only; it
// does NOT read the observations table (that goes live in L2 P4, which will deepen
// this view). Built on U0 tokens + U1 primitives.
export function ClientStory({
  subtitle,
  nextCompetition,
  events,
}: {
  subtitle: string
  nextCompetition?: { name: string; competition_date: string } | null
  events: StoryEvent[]
}) {
  return (
    <Card>
      <SectionHeader title="Story" description={subtitle} />

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
          description="Logged weight, recovery, alerts, and messages will appear here over time."
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
