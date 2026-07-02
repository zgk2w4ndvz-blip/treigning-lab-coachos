"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Inbox, CheckCheck, MessageSquare } from "lucide-react"

import { timeAgo } from "@/lib/utils/format"
import { Card, SectionHeader, Chip, EmptyState } from "@/components/ds"

export type NotificationKind = "critical" | "alert" | "suggestion" | "approval" | "message"

export interface NotificationEvent {
  id: string
  kind: NotificationKind
  title: string
  detail?: string | null
  at: string
  href: string
}

const KIND_META: Record<NotificationKind, { cls: string }> = {
  critical: { cls: "bg-ds-danger-bg text-ds-danger-on" },
  alert: { cls: "bg-ds-warning-bg text-ds-warning-on" },
  suggestion: { cls: "bg-ds-primary-bg text-ds-primary-on" },
  approval: { cls: "bg-ds-positive-bg text-ds-positive-on" },
  message: { cls: "bg-ds-surface-2 text-ds-text-secondary" },
}

function KindIcon({ kind }: { kind: NotificationKind }) {
  const cls = "size-4"
  if (kind === "critical" || kind === "alert") return <AlertTriangle className={cls} />
  if (kind === "suggestion") return <Inbox className={cls} />
  if (kind === "approval") return <CheckCheck className={cls} />
  return <MessageSquare className={cls} />
}

const FILTERS: { label: string; value: "all" | NotificationKind }[] = [
  { label: "All", value: "all" },
  { label: "Critical", value: "critical" },
  { label: "Suggestions", value: "suggestion" },
  { label: "Approvals", value: "approval" },
  { label: "Alerts", value: "alert" },
]

function isToday(iso: string): boolean {
  return iso.slice(0, 10) === new Date().toISOString().slice(0, 10)
}

// Notifications Center (U4) — a feed assembled from existing readers (inbox +
// alert engine). Read-only; no notification backend, no fake data. Filters and
// Today/Earlier grouping are client-side over already-fetched events.
export function NotificationsCenter({ events }: { events: NotificationEvent[] }) {
  const [filter, setFilter] = useState<"all" | NotificationKind>("all")

  const filtered = useMemo(
    () => events.filter((e) => (filter === "all" ? true : e.kind === filter)),
    [events, filter]
  )
  const today = filtered.filter((e) => isToday(e.at))
  const earlier = filtered.filter((e) => !isToday(e.at))

  const newCount = events.filter((e) => e.kind === "critical" || e.kind === "suggestion").length

  return (
    <div className="flex flex-1 flex-col gap-4 p-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-sans text-[22px] font-medium tracking-normal text-ds-text-primary">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-ds-text-secondary">
            {events.length === 0 ? "You're all caught up." : `${newCount} new · ${events.length} total`}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-ds-text-muted">
          <CheckCheck className="size-4" /> Mark all read
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Chip key={f.value} active={filter === f.value} onClick={() => setFilter(f.value)}>
            {f.label}
          </Chip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState icon={<Inbox />} title="Nothing here" description="New messages, suggestions, and alerts will appear here." />
        </Card>
      ) : (
        <Card>
          {today.length > 0 ? <SectionHeader title="Today" /> : null}
          {today.map((e) => (
            <Row key={e.id} e={e} />
          ))}
          {earlier.length > 0 ? <div className="mt-2"><SectionHeader title="Earlier" /></div> : null}
          {earlier.map((e) => (
            <Row key={e.id} e={e} />
          ))}
        </Card>
      )}
    </div>
  )
}

function Row({ e }: { e: NotificationEvent }) {
  return (
    <Link
      href={e.href}
      className="flex gap-3 rounded-control px-1 py-2.5 transition-colors hover:bg-ds-surface-2"
    >
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-control ${KIND_META[e.kind].cls}`}
        aria-hidden="true"
      >
        <KindIcon kind={e.kind} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[0.8125rem] font-medium text-ds-text-primary">{e.title}</span>
          <span className="shrink-0 text-xs text-ds-text-muted">{timeAgo(e.at)}</span>
        </div>
        {e.detail ? <div className="mt-0.5 truncate text-xs text-ds-text-muted">{e.detail}</div> : null}
      </div>
    </Link>
  )
}
