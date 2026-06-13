"use client"

import { useMemo, useState, useTransition } from "react"
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  isToday,
  getHours,
  getMinutes,
} from "date-fns"
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Video,
  Phone,
  Users,
  Pencil,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { setSessionStatusAction, deleteSessionAction } from "@/lib/actions/schedule"
import { SESSION_TYPE_LABELS, SESSION_MODALITY_LABELS } from "@/lib/validations/schedule"
import { SessionDialog } from "@/components/schedule/session-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { ScheduledSessionView } from "@/types/models"
import type { ScheduleSessionType, SessionStatus } from "@/types/database"

// ─── Constants ────────────────────────────────────────────────────────────────

const START_HOUR = 6   // 6 am
const END_HOUR   = 21  // 9 pm
const HOUR_PX    = 60  // pixels per hour
const GRID_HEIGHT = (END_HOUR - START_HOUR) * HOUR_PX

const TYPE_META: Record<ScheduleSessionType, { label: string; color: string; pill: string }> = {
  training:         { label: "Training",         color: "bg-indigo-500",   pill: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300" },
  consultation:     { label: "Consultation",     color: "bg-emerald-500",  pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  check_in:         { label: "Check-in",         color: "bg-sky-500",      pill: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  competition_prep: { label: "Competition Prep", color: "bg-red-500",      pill: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
  follow_up:        { label: "Follow-up",        color: "bg-slate-500",    pill: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  group_session:    { label: "Group Session",    color: "bg-violet-500",   pill: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300" },
}

const STATUS_META: Record<SessionStatus, { label: string; class: string }> = {
  scheduled:  { label: "Scheduled",  class: "border-border" },
  completed:  { label: "Completed",  class: "border-emerald-400 opacity-70" },
  cancelled:  { label: "Cancelled",  class: "border-red-400 opacity-50" },
  no_show:    { label: "No-show",    class: "border-amber-400 opacity-60" },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeOffset(iso: string): number {
  const d = parseISO(iso)
  const h = getHours(d) + getMinutes(d) / 60
  return (h - START_HOUR) * HOUR_PX
}

function sessionHeight(durationMin: number): number {
  return Math.max(20, (durationMin / 60) * HOUR_PX)
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ModalityIcon({ modality }: { modality: string | null }) {
  if (modality === "virtual") return <Video className="size-3" />
  if (modality === "phone")   return <Phone className="size-3" />
  if (modality === "in_person") return <Users className="size-3" />
  return null
}

function SessionChip({
  session,
  onClick,
}: {
  session: ScheduledSessionView
  onClick: () => void
}) {
  const top = timeOffset(session.scheduledAt)
  const height = sessionHeight(session.durationMin)
  const meta = TYPE_META[session.sessionType] ?? TYPE_META.training
  const cancelled = session.status === "cancelled"
  const completed = session.status === "completed"

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ top, height }}
      className={cn(
        "absolute inset-x-1 overflow-hidden rounded border-l-2 px-1.5 py-0.5 text-left transition-opacity hover:opacity-90",
        meta.pill,
        `border-l-[3px]`,
        meta.color.replace("bg-", "border-l-"),
        cancelled && "opacity-40 line-through",
        completed && "opacity-60"
      )}
      title={session.title}
    >
      <p className="truncate text-[11px] font-semibold leading-tight">
        {format(parseISO(session.scheduledAt), "h:mma").toLowerCase()} {session.title}
      </p>
      {height >= 36 && session.clientName ? (
        <p className="truncate text-[10px] opacity-80">{session.clientName}</p>
      ) : null}
      {height >= 48 && session.modality ? (
        <span className="flex items-center gap-0.5 text-[10px] opacity-70">
          <ModalityIcon modality={session.modality} />
          {SESSION_MODALITY_LABELS[session.modality]}
        </span>
      ) : null}
    </button>
  )
}

function ListSessionRow({
  session,
  onClick,
}: {
  session: ScheduledSessionView
  onClick: () => void
}) {
  const meta = TYPE_META[session.sessionType] ?? TYPE_META.training
  const overdue =
    session.status === "scheduled" &&
    session.scheduledAt.slice(0, 10) < todayStr()

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
    >
      <div
        className={cn("mt-0.5 size-2.5 shrink-0 rounded-full", meta.color)}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium",
            session.status === "cancelled" && "text-muted-foreground line-through",
            session.status === "completed" && "text-muted-foreground"
          )}
        >
          {session.title}
        </p>
        <p className="text-muted-foreground truncate text-xs">
          {session.clientName ?? "General"}
          {" · "}
          <span className={cn(overdue && "text-red-600 dark:text-red-500")}>
            {format(parseISO(session.scheduledAt), "EEE, MMM d · h:mm a")}
          </span>
          {" · "}
          {session.durationMin} min
        </p>
      </div>
      <Badge variant="outline" className={cn("shrink-0 text-[11px]", meta.pill)}>
        {meta.label}
      </Badge>
    </button>
  )
}

// ─── Detail sheet ─────────────────────────────────────────────────────────────

function SessionDetailSheet({
  session,
  athletes,
  open,
  onClose,
}: {
  session: ScheduledSessionView | null
  athletes: { id: string; name: string }[]
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  function handleStatus(status: SessionStatus) {
    if (!session) return
    startTransition(async () => {
      const res = await setSessionStatusAction(session.id, status)
      if (res.ok) {
        toast.success(
          status === "completed" ? "Marked complete" :
          status === "cancelled" ? "Session cancelled" :
          status === "no_show"   ? "Marked no-show" : "Updated"
        )
        onClose()
        router.refresh()
      } else {
        toast.error(res.error ?? "Update failed")
      }
    })
  }

  function handleDelete() {
    if (!session) return
    startTransition(async () => {
      const res = await deleteSessionAction(session.id)
      if (res.ok) {
        toast.success("Session removed")
        onClose()
        router.refresh()
      } else {
        toast.error(res.error ?? "Delete failed")
      }
    })
  }

  if (!session) return null

  const meta = TYPE_META[session.sessionType] ?? TYPE_META.training
  const isScheduled = session.status === "scheduled"

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="truncate pr-4">{session.title}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <Badge className={cn("text-xs", meta.pill)}>
            {meta.label}
          </Badge>

          <dl className="space-y-2 text-sm">
            <DetailRow
              icon={<Clock className="size-4" />}
              label="When"
              value={`${format(parseISO(session.scheduledAt), "EEEE, MMM d · h:mm a")} · ${session.durationMin} min`}
            />
            {session.clientName ? (
              <DetailRow
                icon={<Users className="size-4" />}
                label="Athlete"
                value={session.clientName}
              />
            ) : null}
            {session.modality ? (
              <DetailRow
                icon={<ModalityIcon modality={session.modality} />}
                label="Modality"
                value={SESSION_MODALITY_LABELS[session.modality]}
              />
            ) : null}
            {session.location ? (
              <DetailRow
                icon={<MapPin className="size-4" />}
                label="Location"
                value={session.location}
              />
            ) : null}
            <DetailRow
              icon={null}
              label="Status"
              value={STATUS_META[session.status].label}
            />
            {session.notes ? (
              <div className="pt-1">
                <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">Notes</p>
                <p className="text-sm">{session.notes}</p>
              </div>
            ) : null}
          </dl>

          {session.clientId ? (
            <Button asChild variant="outline" size="sm">
              <a href={`/clients/${session.clientId}`}>Open athlete profile</a>
            </Button>
          ) : null}

          {isScheduled ? (
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                className="text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400"
                onClick={() => handleStatus("completed")}
              >
                <CheckCircle2 className="size-4" />
                Complete
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-amber-700 hover:bg-amber-50 dark:text-amber-400"
                onClick={() => handleStatus("no_show")}
              >
                <AlertCircle className="size-4" />
                No-show
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-700 hover:bg-red-50 dark:text-red-400"
                onClick={() => handleStatus("cancelled")}
              >
                <XCircle className="size-4" />
                Cancel
              </Button>
            </div>
          ) : null}

          <div className="flex gap-2 border-t pt-4">
            <SessionDialog
              athletes={athletes}
              session={session}
              trigger={
                <Button size="sm" variant="outline">
                  <Pencil className="size-4" />
                  Edit
                </Button>
              }
            />
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:bg-destructive/10"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  )
}

// ─── Week view ────────────────────────────────────────────────────────────────

function WeekView({
  sessions,
  weekDays,
  onSelect,
}: {
  sessions: ScheduledSessionView[]
  weekDays: Date[]
  onSelect: (s: ScheduledSessionView) => void
}) {
  const byDay = useMemo(() => {
    const m = new Map<string, ScheduledSessionView[]>()
    for (const s of sessions) {
      const key = s.scheduledAt.slice(0, 10)
      const list = m.get(key) ?? []
      list.push(s)
      m.set(key, list)
    }
    return m
  }, [sessions])

  const hours = Array.from(
    { length: END_HOUR - START_HOUR },
    (_, i) => START_HOUR + i
  )

  return (
    <div className="overflow-auto rounded-lg border">
      {/* header row */}
      <div className="bg-muted/50 grid grid-cols-8 border-b text-center text-xs font-medium">
        <div className="py-2" /> {/* time label column */}
        {weekDays.map((d) => (
          <div
            key={d.toISOString()}
            className={cn("py-2", isToday(d) && "text-primary font-bold")}
          >
            <span className="hidden sm:block">{format(d, "EEE")}</span>
            <span
              className={cn(
                "mx-auto mt-0.5 flex size-6 items-center justify-center rounded-full text-xs",
                isToday(d) && "bg-primary text-primary-foreground"
              )}
            >
              {format(d, "d")}
            </span>
          </div>
        ))}
      </div>

      {/* time grid */}
      <div className="grid grid-cols-8" style={{ height: GRID_HEIGHT }}>
        {/* hour labels */}
        <div className="relative border-r">
          {hours.map((h) => (
            <div
              key={h}
              style={{ top: (h - START_HOUR) * HOUR_PX }}
              className="absolute inset-x-0 flex items-start justify-end pr-2 pt-0.5"
            >
              <span className="text-muted-foreground text-[10px]">
                {format(new Date().setHours(h, 0, 0, 0), "h a")}
              </span>
            </div>
          ))}
          {/* horizontal hour lines across the full grid */}
        </div>

        {/* day columns */}
        {weekDays.map((d) => {
          const key = format(d, "yyyy-MM-dd")
          const daySessions = byDay.get(key) ?? []
          return (
            <div key={key} className={cn("relative border-r last:border-r-0", isToday(d) && "bg-primary/5")}>
              {/* hour lines */}
              {hours.map((h) => (
                <div
                  key={h}
                  style={{ top: (h - START_HOUR) * HOUR_PX }}
                  className="border-muted absolute inset-x-0 border-t border-dashed"
                />
              ))}
              {/* current time indicator */}
              {isToday(d) ? <CurrentTimeBar /> : null}
              {/* sessions */}
              {daySessions.map((s) => (
                <SessionChip
                  key={s.id}
                  session={s}
                  onClick={() => onSelect(s)}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CurrentTimeBar() {
  const now = new Date()
  const h = getHours(now) + getMinutes(now) / 60
  const top = (h - START_HOUR) * HOUR_PX
  if (top < 0 || top > GRID_HEIGHT) return null
  return (
    <div
      style={{ top }}
      className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
    >
      <div className="bg-primary size-2 rounded-full" />
      <div className="bg-primary h-px flex-1" />
    </div>
  )
}

// ─── List view ────────────────────────────────────────────────────────────────

type ListBucket = "past" | "today" | "tomorrow" | "this_week" | "next_week" | "later"

function bucketForDate(dateStr: string): ListBucket {
  const today = todayStr()
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
  const weekEnd = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
  const nextWeekEnd = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
  if (dateStr < today) return "past"
  if (dateStr === today) return "today"
  if (dateStr === tomorrow) return "tomorrow"
  if (dateStr <= weekEnd) return "this_week"
  if (dateStr <= nextWeekEnd) return "next_week"
  return "later"
}

const LIST_BUCKETS: { key: ListBucket; label: string }[] = [
  { key: "past",      label: "Earlier" },
  { key: "today",     label: "Today" },
  { key: "tomorrow",  label: "Tomorrow" },
  { key: "this_week", label: "This week" },
  { key: "next_week", label: "Next week" },
  { key: "later",     label: "Later" },
]

function ListView({
  sessions,
  onSelect,
}: {
  sessions: ScheduledSessionView[]
  onSelect: (s: ScheduledSessionView) => void
}) {
  const grouped = useMemo(() => {
    const m = new Map<ListBucket, ScheduledSessionView[]>()
    for (const s of sessions) {
      const b = bucketForDate(s.scheduledAt.slice(0, 10))
      const list = m.get(b) ?? []
      list.push(s)
      m.set(b, list)
    }
    return m
  }, [sessions])

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <p className="text-muted-foreground text-sm">No sessions match these filters.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {LIST_BUCKETS.map(({ key, label }) => {
        const group = grouped.get(key)
        if (!group?.length) return null
        return (
          <div key={key} className="space-y-1">
            <p className={cn(
              "text-sm font-semibold",
              key === "today" && "text-primary",
              key === "past" && "text-muted-foreground"
            )}>
              {label} <span className="text-muted-foreground font-normal">({group.length})</span>
            </p>
            <Card>
              <CardContent className="divide-border divide-y p-0">
                {group.map((s) => (
                  <ListSessionRow key={s.id} session={s} onClick={() => onSelect(s)} />
                ))}
              </CardContent>
            </Card>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main board ───────────────────────────────────────────────────────────────

export function ScheduleBoard({
  sessions,
  athletes,
}: {
  sessions: ScheduledSessionView[]
  athletes: { id: string; name: string }[]
}) {
  const [view, setView] = useState<"week" | "list">("week")
  const [cursor, setCursor] = useState(new Date())
  const [athleteFilter, setAthleteFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("active") // 'active' | 'all' | 'completed' | 'cancelled'
  const [selected, setSelected] = useState<ScheduledSessionView | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const weekDays = useMemo(() => {
    return eachDayOfInterval({
      start: startOfWeek(cursor, { weekStartsOn: 1 }), // Monday start
      end: endOfWeek(cursor, { weekStartsOn: 1 }),
    })
  }, [cursor])

  const weekLabel = `${format(weekDays[0], "MMM d")} – ${format(weekDays[6], "MMM d, yyyy")}`

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (athleteFilter !== "all" && s.clientId !== athleteFilter) return false
      if (typeFilter !== "all" && s.sessionType !== typeFilter) return false
      if (statusFilter === "active" && (s.status === "cancelled" || s.status === "completed")) return false
      if (statusFilter === "completed" && s.status !== "completed") return false
      if (statusFilter === "cancelled" && s.status !== "cancelled") return false
      return true
    })
  }, [sessions, athleteFilter, typeFilter, statusFilter])

  // For week view, only show sessions in the current week
  const weekFiltered = useMemo(() => {
    const start = format(weekDays[0], "yyyy-MM-dd")
    const end   = format(weekDays[6], "yyyy-MM-dd")
    return filtered.filter((s) => {
      const d = s.scheduledAt.slice(0, 10)
      return d >= start && d <= end
    })
  }, [filtered, weekDays])

  function openSession(s: ScheduledSessionView) {
    setSelected(s)
    setSheetOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect value={athleteFilter} onChange={setAthleteFilter} placeholder="Athlete" width="w-44">
          <SelectItem value="all">All athletes</SelectItem>
          {athletes.map((a) => (
            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
          ))}
        </FilterSelect>

        <FilterSelect value={typeFilter} onChange={setTypeFilter} placeholder="Type" width="w-44">
          <SelectItem value="all">All types</SelectItem>
          {Object.entries(SESSION_TYPE_LABELS).map(([k, v]) => (
            <SelectItem key={k} value={k}>{v}</SelectItem>
          ))}
        </FilterSelect>

        <FilterSelect value={statusFilter} onChange={setStatusFilter} placeholder="Status">
          <SelectItem value="active">Scheduled</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
          <SelectItem value="all">All statuses</SelectItem>
        </FilterSelect>

        <div className="ml-auto flex items-center gap-2">
          <div className="bg-muted inline-flex rounded-md p-0.5 text-sm">
            {(["week", "list"] as const).map((v) => (
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
                {v === "week" ? "Week" : "List"}
              </button>
            ))}
          </div>

          <SessionDialog athletes={athletes} />
        </div>
      </div>

      {/* Week navigator (shown in week view) */}
      {view === "week" ? (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor((c) => addWeeks(c, -1))}
            aria-label="Previous week"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor(new Date())}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor((c) => addWeeks(c, 1))}
            aria-label="Next week"
          >
            <ChevronRight className="size-4" />
          </Button>
          <span className="ml-2 text-base font-semibold">{weekLabel}</span>
        </div>
      ) : null}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {(Object.entries(TYPE_META) as [ScheduleSessionType, typeof TYPE_META[ScheduleSessionType]][]).map(([type, meta]) => (
          <span key={type} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", meta.color)} />
            {meta.label}
          </span>
        ))}
      </div>

      {/* View */}
      {view === "week" ? (
        <WeekView sessions={weekFiltered} weekDays={weekDays} onSelect={openSession} />
      ) : (
        <ListView sessions={filtered} onSelect={openSession} />
      )}

      {/* Detail sheet */}
      <SessionDetailSheet
        session={selected}
        athletes={athletes}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  )
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  width = "w-36",
  children,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  width?: string
  children: React.ReactNode
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={width} aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  )
}
