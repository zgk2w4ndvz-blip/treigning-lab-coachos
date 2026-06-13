"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import { AgendaCard } from "@/components/coach/agenda-card"
import { EmptyState } from "@/components/shared/empty-state"
import { Users } from "lucide-react"
import type { AthleteAgenda } from "@/types/models"

type FilterKey =
  | "all"
  | "red"
  | "yellow"
  | "competition"
  | "missed"
  | "cut"

const PREDICATES: Record<FilterKey, (a: AthleteAgenda) => boolean> = {
  all: () => true,
  red: (a) => a.priority === "urgent",
  yellow: (a) => a.priority === "attention",
  competition: (a) => a.isCompetition,
  missed: (a) => a.missedCheckIn,
  cut: (a) => a.isWeightCut,
}

const FILTERS: { key: FilterKey; label: string; dot?: string }[] = [
  { key: "all", label: "All athletes" },
  { key: "red", label: "Red priority", dot: "bg-red-500" },
  { key: "yellow", label: "Yellow priority", dot: "bg-amber-500" },
  { key: "competition", label: "Competition" },
  { key: "missed", label: "Missed check-ins" },
  { key: "cut", label: "Weight cut" },
]

export function AgendaBoard({ agendas }: { agendas: AthleteAgenda[] }) {
  const [filter, setFilter] = useState<FilterKey>("all")

  const counts = useMemo(() => {
    const c = {} as Record<FilterKey, number>
    for (const f of FILTERS) c[f.key] = agendas.filter(PREDICATES[f.key]).length
    return c
  }, [agendas])

  const filtered = useMemo(
    () => agendas.filter(PREDICATES[filter]),
    [agendas, filter]
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.key
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted text-muted-foreground"
              )}
            >
              {f.dot ? (
                <span className={cn("size-2 rounded-full", f.dot)} />
              ) : null}
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  active ? "bg-primary-foreground/20" : "bg-muted"
                )}
              >
                {counts[f.key]}
              </span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No athletes match this filter"
          description="Try a different filter to see today's agendas."
        />
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((agenda) => (
            <AgendaCard key={agenda.client.id} agenda={agenda} />
          ))}
        </div>
      )}
    </div>
  )
}
