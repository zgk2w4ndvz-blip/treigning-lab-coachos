"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search, Swords, CalendarClock, Scale } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { ReadinessBadge } from "@/components/combat/readiness-badge"
import {
  CUT_STATUS_LABELS,
  DISCIPLINE_LABELS,
} from "@/lib/combat/protocols"
import {
  fullName,
  initials,
  formatWeight,
  formatDate,
  relativeDays,
} from "@/lib/utils/format"
import type {
  CombatCutListItem,
  CombatDiscipline,
  ReadinessLevel,
} from "@/types/models"

type DiscFilter = CombatDiscipline | "all"
type LevelFilter = ReadinessLevel | "all"

export function CombatBoard({ items }: { items: CombatCutListItem[] }) {
  const [query, setQuery] = useState("")
  const [disc, setDisc] = useState<DiscFilter>("all")
  const [level, setLevel] = useState<LevelFilter>("all")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((it) => {
      if (disc !== "all" && it.cut.discipline !== disc) return false
      if (level !== "all" && it.readiness.level !== level) return false
      if (!q) return true
      const name = fullName(it.client.first_name, it.client.last_name)
      return (
        name.toLowerCase().includes(q) ||
        (it.cut.class_name ?? "").toLowerCase().includes(q)
      )
    })
  }, [items, query, disc, level])

  const disciplines = useMemo(
    () => [...new Set(items.map((i) => i.cut.discipline))],
    [items]
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search fighters or classes…"
            className="pl-9"
          />
        </div>
        <Select value={disc} onValueChange={(v) => setDisc(v as DiscFilter)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Discipline" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All disciplines</SelectItem>
            {disciplines.map((d) => (
              <SelectItem key={d} value={d}>
                {DISCIPLINE_LABELS[d]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={level} onValueChange={(v) => setLevel(v as LevelFilter)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Readiness" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All readiness</SelectItem>
            <SelectItem value="on_track">On track</SelectItem>
            <SelectItem value="watch">Watch</SelectItem>
            <SelectItem value="at_risk">At risk</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Swords}
          title="No active weight cuts"
          description={
            items.length === 0
              ? "Plan a cut from any combat-sport athlete's Combat tab."
              : "Try adjusting your filters."
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((it) => (
            <Link key={it.cut.id} href={`/clients/${it.client.id}/combat`}>
              <Card className="hover:border-primary/40 h-full transition-colors">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar className="size-9">
                        <AvatarImage src={it.client.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {initials(
                            fullName(
                              it.client.first_name,
                              it.client.last_name
                            )
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {fullName(
                            it.client.first_name,
                            it.client.last_name
                          )}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {DISCIPLINE_LABELS[it.cut.discipline]}
                          {it.cut.class_name ? ` · ${it.cut.class_name}` : ""}
                        </p>
                      </div>
                    </div>
                    <ReadinessBadge
                      level={it.readiness.level}
                      score={it.readiness.overall}
                    />
                  </div>

                  <div className="text-muted-foreground grid grid-cols-2 gap-2 text-sm">
                    <span className="flex items-center gap-1.5">
                      <Scale className="size-3.5" />
                      {it.readiness.weightToGoLbs != null
                        ? `${formatWeight(it.readiness.weightToGoLbs)} to go`
                        : "—"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CalendarClock className="size-3.5" />
                      {it.cut.weigh_in_at
                        ? relativeDays(it.cut.weigh_in_at)
                        : CUT_STATUS_LABELS[it.cut.status]}
                    </span>
                  </div>

                  {it.cut.weigh_in_at ? (
                    <p className="text-muted-foreground text-xs">
                      Weigh-in {formatDate(it.cut.weigh_in_at)}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
