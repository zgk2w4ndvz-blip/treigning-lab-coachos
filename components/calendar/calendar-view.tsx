"use client"

import { useMemo, useState } from "react"
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { CalendarEvent, CalendarEventType } from "@/types/models"

const META: Record<
  CalendarEventType,
  { label: string; pill: string; dot: string }
> = {
  competition: { label: "Competition", pill: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300", dot: "bg-red-500" },
  weigh_in: { label: "Weigh-in", pill: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", dot: "bg-amber-500" },
  check_in: { label: "Check-in", pill: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300", dot: "bg-sky-500" },
  training: { label: "Training", pill: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300", dot: "bg-indigo-500" },
  consultation: { label: "Consultation", pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", dot: "bg-emerald-500" },
  follow_up: { label: "Follow-up", pill: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300", dot: "bg-slate-500" },
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function CalendarView({ events }: { events: CalendarEvent[] }) {
  const [view, setView] = useState<"month" | "week">("month")
  const [cursor, setCursor] = useState(new Date())
  const [selected, setSelected] = useState<CalendarEvent | null>(null)

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const key = e.date.slice(0, 10)
      const list = m.get(key) ?? []
      list.push(e)
      m.set(key, list)
    }
    for (const list of m.values())
      list.sort((a, b) => a.date.localeCompare(b.date))
    return m
  }, [events])

  const days = useMemo(() => {
    if (view === "month") {
      return eachDayOfInterval({
        start: startOfWeek(startOfMonth(cursor)),
        end: endOfWeek(endOfMonth(cursor)),
      })
    }
    return eachDayOfInterval({
      start: startOfWeek(cursor),
      end: endOfWeek(cursor),
    })
  }, [cursor, view])

  const title =
    view === "month"
      ? format(cursor, "MMMM yyyy")
      : `${format(startOfWeek(cursor), "MMM d")} – ${format(endOfWeek(cursor), "MMM d, yyyy")}`

  function shift(dir: number) {
    setCursor((c) => (view === "month" ? addMonths(c, dir) : addWeeks(c, dir)))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Previous">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Next">
            <ChevronRight className="size-4" />
          </Button>
          <h2 className="ml-2 text-lg font-semibold">{title}</h2>
        </div>
        <div className="bg-muted inline-flex rounded-md p-0.5 text-sm">
          {(["month", "week"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "rounded px-3 py-1 font-medium capitalize transition-colors",
                view === v
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {(Object.keys(META) as CalendarEventType[]).map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", META[t].dot)} />
            {META[t].label}
          </span>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border">
        {/* weekday header */}
        <div className="bg-muted/50 grid grid-cols-7 border-b text-center text-xs font-medium">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">{d}</div>
          ))}
        </div>

        {/* day grid */}
        <div className={cn("grid grid-cols-7", view === "month" && "grid-rows-6")}>
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd")
            const dayEvents = byDay.get(key) ?? []
            const muted = view === "month" && !isSameMonth(day, cursor)
            const today = isSameDay(day, new Date())
            const max = view === "month" ? 3 : 8
            return (
              <div
                key={key}
                className={cn(
                  "min-h-24 border-b border-r p-1.5 [&:nth-child(7n)]:border-r-0",
                  view === "week" && "min-h-64",
                  muted && "bg-muted/30"
                )}
              >
                <div className="mb-1 flex justify-end">
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs",
                      today && "bg-primary text-primary-foreground font-semibold",
                      muted && "text-muted-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, max).map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setSelected(e)}
                      className={cn(
                        "block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium",
                        META[e.type].pill
                      )}
                      title={e.title}
                    >
                      {format(parseISO(e.date), "h:mma").toLowerCase()} {e.title}
                    </button>
                  ))}
                  {dayEvents.length > max ? (
                    <p className="text-muted-foreground px-1 text-[11px]">
                      +{dayEvents.length - max} more
                    </p>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <Badge variant="secondary" className={META[selected.type].pill}>
                  {META[selected.type].label}
                </Badge>
                <dl className="space-y-1.5">
                  <Row label="When" value={format(parseISO(selected.date), "EEEE, MMM d · h:mm a")} />
                  {selected.durationMin ? (
                    <Row label="Duration" value={`${selected.durationMin} min`} />
                  ) : null}
                  {selected.clientName ? (
                    <Row label="Athlete" value={selected.clientName} />
                  ) : null}
                  {selected.detail ? <Row label="Details" value={selected.detail} /> : null}
                </dl>
                {selected.clientId ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={`/clients/${selected.clientId}`}>Open athlete</a>
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}
