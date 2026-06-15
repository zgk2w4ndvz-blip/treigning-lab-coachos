"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { CalendarRange } from "lucide-react"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { CalendarEvent, CalendarEventType } from "@/types/models"

const TYPE_DOT: Record<CalendarEventType, string> = {
  competition: "bg-red-500",
  weigh_in: "bg-amber-500",
  check_in: "bg-sky-500",
  training: "bg-indigo-500",
  consultation: "bg-emerald-500",
  follow_up: "bg-slate-500",
}

const pad = (n: number) => String(n).padStart(2, "0")
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

function timeLabel(iso: string): string {
  const d = new Date(iso)
  if (d.getHours() === 0 && d.getMinutes() === 0) return "All day"
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

export function RosterWeek({ events }: { events: CalendarEvent[] }) {
  const [view, setView] = useState<"today" | "week">("week")

  const days = useMemo(() => {
    const today = startOfDay(new Date())
    const span = view === "today" ? 1 : 7
    const buckets = new Map<string, CalendarEvent[]>()
    for (let i = 0; i < span; i++) buckets.set(keyOf(addDays(today, i)), [])
    for (const e of events) {
      const k = keyOf(new Date(e.date))
      buckets.get(k)?.push(e)
    }
    return [...buckets.entries()].map(([key, items]) => ({
      key,
      date: new Date(`${key}T00:00:00`),
      items: items.sort((a, b) => a.date.localeCompare(b.date)),
    }))
  }, [events, view])

  const total = days.reduce((n, d) => n + d.items.length, 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarRange className="size-4" /> Roster schedule
        </CardTitle>
        <div className="bg-muted flex rounded-md p-0.5 text-xs">
          {(["today", "week"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={cn("rounded px-2.5 py-1 font-medium capitalize", view === v ? "bg-background shadow-sm" : "text-muted-foreground")}>
              {v === "today" ? "Today" : "This week"}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {total === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing scheduled across the roster {view === "today" ? "today" : "this week"}.</p>
        ) : (
          days.map((d) => (
            <div key={d.key}>
              <p className={cn("mb-1 text-xs font-semibold", d.key === keyOf(new Date()) ? "text-primary" : "text-muted-foreground")}>
                {d.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                {d.items.length ? <span className="text-muted-foreground font-normal"> · {d.items.length}</span> : null}
              </p>
              {d.items.length === 0 ? (
                <p className="text-muted-foreground/60 pl-1 text-xs">—</p>
              ) : (
                <ul className="space-y-1">
                  {d.items.map((e) => (
                    <li key={e.id}>
                      <Link
                        href={e.clientId ? `/clients/${e.clientId}/calendar` : "/calendar"}
                        className="hover:bg-muted flex items-center gap-2 rounded px-1.5 py-1 text-sm"
                      >
                        <span className={cn("size-2 shrink-0 rounded-full", TYPE_DOT[e.type])} />
                        <span className="text-muted-foreground w-16 shrink-0 text-xs tabular-nums">{timeLabel(e.date)}</span>
                        <span className="min-w-0 flex-1 truncate">{e.title}</span>
                        {e.detail ? <span className="text-muted-foreground hidden shrink-0 text-xs sm:inline">{e.detail}</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
