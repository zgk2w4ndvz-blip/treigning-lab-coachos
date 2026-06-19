"use client"

import Link from "next/link"
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  Inbox,
  ListTodo,
  Target,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import type { AgendaDashboard, AgendaItem, AgendaItemPriority } from "@/types/models"

const PRIORITY_DOT: Record<AgendaItemPriority, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-emerald-500",
}

function timeIn(tz: string, iso?: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" })
}

function dateIn(tz: string, iso?: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" })
}

function ItemRow({ item, tz, showDate }: { item: AgendaItem; tz: string; showDate?: boolean }) {
  const when = showDate
    ? [dateIn(tz, item.startsAt), timeIn(tz, item.startsAt)].filter(Boolean).join(" · ")
    : timeIn(tz, item.startsAt)
  const row = (
    <div className="flex items-center gap-2 py-1.5">
      <span className={cn("size-2 shrink-0 rounded-full", PRIORITY_DOT[item.priority])} />
      <span className="text-muted-foreground w-28 shrink-0 text-xs tabular-nums">{when || "—"}</span>
      <span className="truncate text-sm font-medium">{item.title}</span>
      {item.athleteName ? (
        <span className="text-muted-foreground truncate text-xs">· {item.athleteName}</span>
      ) : null}
      {item.detail ? (
        <span className="text-muted-foreground ml-auto shrink-0 text-[11px] capitalize">{item.detail}</span>
      ) : null}
    </div>
  )
  return item.href ? (
    <Link href={item.href} className="hover:bg-muted/50 -mx-2 block rounded px-2">
      {row}
    </Link>
  ) : (
    row
  )
}

function AttentionStat({
  icon: Icon,
  label,
  count,
  href,
}: {
  icon: typeof Inbox
  label: string
  count: number
  href: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between rounded-lg border p-3 transition-colors hover:border-primary/50",
        count > 0 && "border-amber-300 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-950/20"
      )}
    >
      <span className="flex items-center gap-2 text-sm">
        <Icon className="size-4" /> {label}
      </span>
      <span className={cn("text-lg font-bold tabular-nums", count > 0 && "text-amber-700 dark:text-amber-400")}>
        {count}
      </span>
    </Link>
  )
}

export function AgendaDashboardView({ dashboard }: { dashboard: AgendaDashboard }) {
  const { today, upcoming, attention, timeZone } = dashboard

  return (
    <div className="space-y-4">
      {/* SECTION 2 — ATTENTION REQUIRED (surfaced first as the command center) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4" /> Attention required
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <AttentionStat icon={ClipboardList} label="Unapproved Rx" count={attention.unapprovedPrescriptions} href="/inbox" />
          <AttentionStat icon={Inbox} label="Unreviewed msgs" count={attention.unreviewedMessages} href="/inbox" />
          <AttentionStat icon={ListTodo} label="Overdue tasks" count={attention.overdueTasks} href="/tasks" />
          <AttentionStat icon={Target} label="Plans behind" count={attention.weightPlansBehind} href="/clients" />
        </CardContent>
        {attention.behindPlanItems.length > 0 || attention.overdueTaskItems.length > 0 ? (
          <CardContent className="border-t pt-3">
            {attention.behindPlanItems.map((i) => (
              <ItemRow key={i.id} item={i} tz={timeZone} />
            ))}
            {attention.overdueTaskItems.slice(0, 5).map((i) => (
              <ItemRow key={i.id} item={i} tz={timeZone} />
            ))}
          </CardContent>
        ) : null}
      </Card>

      {/* SECTION 1 — TODAY */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4" /> Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          {today.length === 0 ? (
            <EmptyState title="Nothing scheduled today" className="py-6" />
          ) : (
            <div className="divide-border/60 divide-y">
              {today.map((i) => (
                <ItemRow key={i.id} item={i} tz={timeZone} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 3 — UPCOMING 7 DAYS */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4" /> Upcoming 7 days
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <EmptyState title="Nothing in the next 7 days" className="py-6" />
          ) : (
            <div className="divide-border/60 divide-y">
              {upcoming.map((i) => (
                <ItemRow key={i.id} item={i} tz={timeZone} showDate />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-[11px]">
        Times shown in the gym operating timezone ({timeZone}).
      </p>
    </div>
  )
}
