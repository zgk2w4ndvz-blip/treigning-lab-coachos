"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, ChevronLeft, ChevronRight, MinusCircle, Plus, RotateCcw, X } from "lucide-react"

import { expandOccurrences } from "@/lib/calendar/recurrence"
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/calendar/categories"
import {
  setOccurrenceStatusAction,
  clearOccurrenceStatusAction,
} from "@/lib/actions/athlete-calendar"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CalendarEventDialog } from "@/components/calendar/calendar-event-dialog"
import type {
  AthleteCalendarEvent,
  AthleteCalendarEventOverride,
  CalendarOccurrence,
  CalendarStatus,
} from "@/types/models"

type View = "day" | "week" | "month" | "year"
const VIEWS: View[] = ["day", "week", "month", "year"]
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const pad = (n: number) => String(n).padStart(2, "0")
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const startOfWeek = (d: Date) => addDays(startOfDay(d), -d.getDay())
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const sameMonth = (a: Date, b: Date) => a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
const TODAY_KEY = dateKey(new Date())

function rangeFor(view: View, cursor: Date): [Date, Date] {
  if (view === "day") return [startOfDay(cursor), addDays(startOfDay(cursor), 1)]
  if (view === "week") { const s = startOfWeek(cursor); return [s, addDays(s, 7)] }
  if (view === "month") { const s = startOfWeek(startOfMonth(cursor)); return [s, addDays(s, 42)] }
  return [new Date(cursor.getFullYear(), 0, 1), new Date(cursor.getFullYear() + 1, 0, 1)]
}
function shift(view: View, cursor: Date, dir: number): Date {
  if (view === "day") return addDays(cursor, dir)
  if (view === "week") return addDays(cursor, dir * 7)
  if (view === "month") return new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1)
  return new Date(cursor.getFullYear() + dir, cursor.getMonth(), 1)
}
function title(view: View, c: Date): string {
  if (view === "day") return c.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
  if (view === "week") { const s = startOfWeek(c); const e = addDays(s, 6); return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` }
  if (view === "month") return c.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  return String(c.getFullYear())
}

export function AthleteCalendar({
  clientId,
  events,
  overrides = [],
  timeZone,
}: {
  clientId: string
  events: AthleteCalendarEvent[]
  overrides?: AthleteCalendarEventOverride[]
  timeZone: string
}) {
  const router = useRouter()
  const [, startTx] = useTransition()
  const [view, setView] = useState<View>("month")
  const [cursor, setCursor] = useState(() => startOfDay(new Date()))
  const [dialog, setDialog] = useState<{ open: boolean; event: AthleteCalendarEvent | null; date: string | null; occurrenceDate: string | null }>({ open: false, event: null, date: null, occurrenceDate: null })

  const byDate = useMemo(() => {
    const [rs, re] = rangeFor(view, cursor)
    const map = new Map<string, CalendarOccurrence[]>()
    for (const o of expandOccurrences(events, rs, re, overrides, timeZone)) {
      const list = map.get(o.date)
      if (list) list.push(o)
      else map.set(o.date, [o])
    }
    return map
  }, [events, overrides, view, cursor, timeZone])

  const openNew = (date: string | null) => setDialog({ open: true, event: null, date, occurrenceDate: null })
  // Edit opens with the clicked occurrence's effective event + its slot date, so
  // scoped edits ("this occurrence" / "this and future") know which day.
  const openEdit = (occ: CalendarOccurrence) =>
    setDialog({ open: true, event: occ.event, date: null, occurrenceDate: occ.date })

  const setStatus = (occ: CalendarOccurrence, status: CalendarStatus) =>
    startTx(async () => {
      const res = await setOccurrenceStatusAction(clientId, occ.event.id, occ.date, status)
      if (res.ok) { toast.success(`Marked ${status}`); router.refresh() }
      else toast.error(res.error ?? "Failed")
    })

  const resetStatus = (occ: CalendarOccurrence) =>
    startTx(async () => {
      const res = await clearOccurrenceStatusAction(clientId, occ.event.id, occ.date)
      if (res.ok) { toast.success("Reset to default"); router.refresh() }
      else toast.error(res.error ?? "Failed")
    })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-8" onClick={() => setCursor((c) => shift(view, c, -1))} aria-label="Previous"><ChevronLeft className="size-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(startOfDay(new Date()))}>Today</Button>
          <Button variant="outline" size="icon" className="size-8" onClick={() => setCursor((c) => shift(view, c, 1))} aria-label="Next"><ChevronRight className="size-4" /></Button>
        </div>
        <h2 className="text-base font-semibold">{title(view, cursor)}</h2>
        <div className="ml-auto flex items-center gap-2">
          <div className="bg-muted flex rounded-md p-0.5">
            {VIEWS.map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={cn("rounded px-2.5 py-1 text-xs font-medium capitalize", view === v ? "bg-background shadow-sm" : "text-muted-foreground")}>
                {v}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => openNew(dateKey(cursor))}><Plus className="size-4" /> New</Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {CATEGORY_ORDER.map((c) => (
          <span key={c} className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
            <span className={cn("size-2 rounded-full", CATEGORY_META[c].dot)} /> {CATEGORY_META[c].label}
          </span>
        ))}
      </div>

      {view === "day" && <DayView cursor={cursor} byDate={byDate} timeZone={timeZone} onAdd={openNew} onEdit={openEdit} onStatus={setStatus} onReset={resetStatus} />}
      {view === "week" && <WeekView cursor={cursor} byDate={byDate} timeZone={timeZone} onAdd={openNew} onEdit={openEdit} onStatus={setStatus} onReset={resetStatus} />}
      {view === "month" && <MonthView cursor={cursor} byDate={byDate} timeZone={timeZone} onAdd={openNew} onEdit={openEdit} onStatus={setStatus} onReset={resetStatus} />}
      {view === "year" && <YearView cursor={cursor} events={events} overrides={overrides} timeZone={timeZone} onPick={(d) => { setCursor(d); setView("month") }} />}

      <CalendarEventDialog
        clientId={clientId}
        open={dialog.open}
        onOpenChange={(v) => setDialog((s) => ({ ...s, open: v }))}
        event={dialog.event}
        defaultDate={dialog.date}
        occurrenceDate={dialog.occurrenceDate}
        timeZone={timeZone}
      />
    </div>
  )
}

const STATUS_ICON: Partial<Record<CalendarStatus, typeof Check>> = {
  completed: Check,
  skipped: MinusCircle,
  missed: X,
}

function Chip({ occ, timeZone, onEdit, onStatus, onReset }: ChipProps) {
  const meta = CATEGORY_META[occ.event.category]
  const StatusIcon = STATUS_ICON[occ.status]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium",
            meta.chip,
            occ.status === "completed" && "line-through opacity-60",
            occ.status === "skipped" && "opacity-40",
            occ.status === "missed" && "line-through decoration-red-500 decoration-2 opacity-70"
          )}
          title={occ.event.title}
        >
          {StatusIcon ? <StatusIcon className="size-3 shrink-0" /> : null}
          <span className="truncate">
            {!occ.event.all_day ? `${new Date(occ.start).toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" })} ` : ""}
            {occ.event.title}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => onEdit(occ)}>Edit details…</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onStatus(occ, "completed")}><Check className="size-4" /> Mark complete</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onStatus(occ, "skipped")}><MinusCircle className="size-4" /> Mark skipped</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onStatus(occ, "missed")}><X className="size-4" /> Mark missed</DropdownMenuItem>
        {occ.override ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onReset(occ)}><RotateCcw className="size-4" /> Reset to default</DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type ChipProps = {
  occ: CalendarOccurrence
  timeZone: string
  onEdit: (occ: CalendarOccurrence) => void
  onStatus: (occ: CalendarOccurrence, status: CalendarStatus) => void
  onReset: (occ: CalendarOccurrence) => void
}

type ViewProps = {
  cursor: Date
  byDate: Map<string, CalendarOccurrence[]>
  timeZone: string
  onAdd: (date: string | null) => void
  onEdit: (occ: CalendarOccurrence) => void
  onStatus: (occ: CalendarOccurrence, status: CalendarStatus) => void
  onReset: (occ: CalendarOccurrence) => void
}

function DayView({ cursor, byDate, timeZone, onAdd, onEdit, onStatus, onReset }: ViewProps) {
  const list = byDate.get(dateKey(cursor)) ?? []
  return (
    <div className="space-y-2 rounded-lg border p-4">
      {list.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing planned. <button className="text-primary underline" onClick={() => onAdd(dateKey(cursor))}>Add an event</button>.</p>
      ) : (
        list.map((o) => (
          <div key={o.key} className="space-y-1">
            <Chip occ={o} timeZone={timeZone} onEdit={onEdit} onStatus={onStatus} onReset={onReset} />
            {o.event.description ? <p className="text-muted-foreground pl-1.5 text-xs">{o.event.description}</p> : null}
          </div>
        ))
      )}
    </div>
  )
}

function WeekView({ cursor, byDate, timeZone, onAdd, onEdit, onStatus, onReset }: ViewProps) {
  const start = startOfWeek(cursor)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {days.map((d) => {
        const key = dateKey(d)
        const list = byDate.get(key) ?? []
        return (
          <div key={key} className={cn("min-h-28 cursor-pointer rounded-lg border p-2", key === TODAY_KEY && "border-primary")} onClick={() => onAdd(key)}>
            <p className="text-muted-foreground mb-1 text-xs font-medium">{WEEKDAYS[d.getDay()]} {d.getDate()}</p>
            <div className="space-y-1">{list.map((o) => <Chip key={o.key} occ={o} timeZone={timeZone} onEdit={onEdit} onStatus={onStatus} onReset={onReset} />)}</div>
          </div>
        )
      })}
    </div>
  )
}

function MonthView({ cursor, byDate, timeZone, onAdd, onEdit, onStatus, onReset }: ViewProps) {
  const gridStart = startOfWeek(startOfMonth(cursor))
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="bg-muted/50 grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
        {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const key = dateKey(d)
          const list = byDate.get(key) ?? []
          const muted = !sameMonth(d, cursor)
          return (
            <div key={key} onClick={() => onAdd(key)}
              className={cn("min-h-24 cursor-pointer border-t border-l p-1 [&:nth-child(7n+1)]:border-l-0", muted && "bg-muted/30")}>
              <p className={cn("text-right text-[11px]", key === TODAY_KEY ? "text-primary font-bold" : muted ? "text-muted-foreground/50" : "text-muted-foreground")}>{d.getDate()}</p>
              <div className="mt-0.5 space-y-0.5">
                {list.slice(0, 3).map((o) => <Chip key={o.key} occ={o} timeZone={timeZone} onEdit={onEdit} onStatus={onStatus} onReset={onReset} />)}
                {list.length > 3 ? <p className="text-muted-foreground pl-1 text-[10px]">+{list.length - 3} more</p> : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function YearView({ cursor, events, overrides, timeZone, onPick }: { cursor: Date; events: AthleteCalendarEvent[]; overrides: AthleteCalendarEventOverride[]; timeZone: string; onPick: (d: Date) => void }) {
  const year = cursor.getFullYear()
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarOccurrence[]>()
    for (const o of expandOccurrences(events, new Date(year, 0, 1), new Date(year + 1, 0, 1), overrides, timeZone)) {
      const l = map.get(o.date); if (l) l.push(o); else map.set(o.date, [o])
    }
    return map
  }, [events, overrides, year, timeZone])

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, m) => {
        const first = new Date(year, m, 1)
        const gridStart = startOfWeek(first)
        const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
        return (
          <button key={m} onClick={() => onPick(first)} className="rounded-lg border p-2 text-left hover:border-primary/50">
            <p className="mb-1 text-xs font-semibold">{first.toLocaleDateString("en-US", { month: "long" })}</p>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((d) => {
                const key = dateKey(d)
                const list = byDate.get(key) ?? []
                const muted = d.getMonth() !== m
                return (
                  <div key={key} className="flex flex-col items-center">
                    <span className={cn("text-[9px] leading-none", muted ? "text-muted-foreground/30" : key === TODAY_KEY ? "text-primary font-bold" : "text-muted-foreground")}>{d.getDate()}</span>
                    <span className={cn("mt-0.5 size-1 rounded-full", list.length && !muted ? CATEGORY_META[list[0].event.category].dot : "bg-transparent")} />
                  </div>
                )
              })}
            </div>
          </button>
        )
      })}
    </div>
  )
}
