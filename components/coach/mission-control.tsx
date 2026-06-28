import Link from "next/link"
import {
  Users,
  CheckCircle2,
  Trophy,
  AlertTriangle,
  MessageSquare,
  ChevronRight,
  Activity,
} from "lucide-react"

import { timeAgo } from "@/lib/utils/format"
import {
  Card,
  SectionHeader,
  KpiCard,
  ListRow,
  Badge,
  Chip,
  StatusDot,
  EmptyState,
} from "@/components/ds"
import type {
  DashboardSummary,
  ClientListItem,
  AgendaAttention,
  ReviewQueueItem,
  SuggestionDomain,
} from "@/types/models"

// Mission Control (U2) — the operating center that replaces the Dashboard. Built
// entirely on the U0 tokens + U1 primitives (components/ds). Frontend only: it
// renders the SAME data the dashboard already fetched, re-organized to answer the
// four coach questions. No data is written; every link points at an existing route.

type BadgeTone = "neutral" | "primary" | "positive" | "warning" | "attention" | "danger"

const DOMAIN_TONE: Record<SuggestionDomain, BadgeTone> = {
  recovery: "primary",
  body_composition: "positive",
  diet: "positive",
  hydration: "primary",
  supplementation: "attention",
  labs: "danger",
  altolab: "neutral",
  low_base: "neutral",
  training: "neutral",
}

function Initials({ first, last }: { first?: string | null; last?: string | null }) {
  const text = `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?"
  return (
    <span className="flex size-8 items-center justify-center rounded-full bg-ds-surface-2 text-[11px] font-medium text-ds-text-secondary">
      {text}
    </span>
  )
}

export function MissionControl({
  greeting,
  summary,
  roster,
  attention,
  inboxItems,
}: {
  greeting: string
  summary: DashboardSummary
  roster: ClientListItem[]
  attention: AgendaAttention
  inboxItems: ReviewQueueItem[]
}) {
  const pending = inboxItems.filter((i) => i.status === "pending")

  const needsMe = roster
    .filter((c) => c.openAlertCount > 0 || c.complianceScore < 60)
    .sort(
      (a, b) =>
        b.openAlertCount - a.openAlertCount || a.complianceScore - b.complianceScore
    )
    .slice(0, 6)

  const competitions = roster
    .filter((c) => c.nextCompetition)
    .sort((a, b) =>
      (a.nextCompetition!.competition_date ?? "").localeCompare(
        b.nextCompetition!.competition_date ?? ""
      )
    )
    .slice(0, 5)

  const attentionChips = [
    { label: "Unapproved Rx", count: attention.unapprovedPrescriptions, href: "/inbox" },
    { label: "Unreviewed msgs", count: attention.unreviewedMessages, href: "/inbox" },
    { label: "Overdue tasks", count: attention.overdueTasks, href: "/tasks" },
    { label: "Plans behind", count: attention.weightPlansBehind, href: "/agenda" },
  ]

  const recent = [...inboxItems]
    .sort((a, b) =>
      (b.receivedAt ?? b.createdAt).localeCompare(a.receivedAt ?? a.createdAt)
    )
    .slice(0, 5)

  return (
    <div className="flex flex-1 flex-col gap-5 p-6 md:p-8">
      <div>
        <h1 className="font-sans text-[22px] font-medium tracking-normal text-ds-text-primary">
          Mission Control
        </h1>
        <p className="mt-1 text-sm text-ds-text-secondary">{greeting}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active athletes" value={summary.activeClients} icon={<Users />} />
        <KpiCard label="Needs approval" value={pending.length} icon={<CheckCircle2 />} />
        <KpiCard label="Competitions ≤30d" value={summary.upcomingCompetitions} icon={<Trophy />} />
        <KpiCard label="Avg compliance" value={`${summary.avgCompliance}%`} icon={<Activity />} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionHeader
            title="Who needs me today"
            icon={<AlertTriangle />}
            action={<span className="text-xs text-ds-text-muted">{needsMe.length}</span>}
          />
          {needsMe.length === 0 ? (
            <EmptyState title="All clear" description="No athletes are flagged right now." />
          ) : (
            needsMe.map((c) => (
              <Link key={c.client.id} href={`/clients/${c.client.id}`} className="block">
                <ListRow
                  interactive
                  leading={<Initials first={c.client.first_name} last={c.client.last_name} />}
                  title={`${c.client.first_name} ${c.client.last_name}`}
                  subtitle={`${c.openAlertCount > 0 ? `${c.openAlertCount} alert${c.openAlertCount > 1 ? "s" : ""} · ` : ""}${c.complianceScore}% compliance`}
                  trailing={<StatusDot status={c.openAlertCount > 0 ? "critical" : "warning"} />}
                />
              </Link>
            ))
          )}
        </Card>

        <Card>
          <SectionHeader
            title="Needs approval"
            icon={<CheckCircle2 />}
            action={
              <Link href="/inbox" className="inline-flex items-center gap-1 text-xs text-ds-primary-on">
                Inbox <ChevronRight className="size-3.5" />
              </Link>
            }
          />
          {pending.length === 0 ? (
            <EmptyState title="Nothing to approve" description="The queue is empty." />
          ) : (
            pending.slice(0, 5).map((i) => (
              <Link key={i.id} href="/inbox" className="block">
                <ListRow
                  interactive
                  title={i.athleteName ?? i.senderLabel ?? "Unmatched"}
                  subtitle={i.intent ?? i.suggestedProtocol}
                  trailing={<Badge tone={DOMAIN_TONE[i.domain] ?? "neutral"}>{i.domain.replace("_", " ")}</Badge>}
                />
              </Link>
            ))
          )}
        </Card>

        <Card>
          <SectionHeader title="Competitions" icon={<Trophy />} />
          {competitions.length === 0 ? (
            <EmptyState title="No upcoming competitions" description="Nothing on the calendar yet." />
          ) : (
            competitions.map((c) => (
              <Link key={c.client.id} href={`/clients/${c.client.id}`} className="block">
                <ListRow
                  interactive
                  leading={<Initials first={c.client.first_name} last={c.client.last_name} />}
                  title={c.nextCompetition!.name}
                  subtitle={`${c.client.first_name} ${c.client.last_name}`}
                  trailing={
                    <span className="text-xs text-ds-text-muted">
                      {c.nextCompetition!.competition_date}
                    </span>
                  }
                />
              </Link>
            ))
          )}
        </Card>

        <Card>
          <SectionHeader title="Needs attention" icon={<AlertTriangle />} />
          <div className="flex flex-wrap gap-2">
            {attentionChips.map((s) => (
              <Link key={s.label} href={s.href}>
                <Chip active={s.count > 0}>
                  {s.label}
                  <span className="tabular-nums">{s.count}</span>
                </Chip>
              </Link>
            ))}
          </div>
          {summary.openAlerts > 0 ? (
            <p className="mt-3 text-xs text-ds-text-muted">
              {summary.openAlerts} open athlete alert{summary.openAlerts > 1 ? "s" : ""} —{" "}
              <Link href="/alerts" className="text-ds-primary-on">
                view all
              </Link>
            </p>
          ) : (
            <p className="mt-3 text-xs text-ds-text-muted">No open alerts.</p>
          )}
        </Card>
      </div>

      <Card>
        <SectionHeader
          title="Recent activity"
          icon={<MessageSquare />}
          action={
            <Link href="/inbox" className="inline-flex items-center gap-1 text-xs text-ds-text-muted">
              All <ChevronRight className="size-3.5" />
            </Link>
          }
        />
        {recent.length === 0 ? (
          <EmptyState title="No recent activity" description="New messages will show up here." />
        ) : (
          recent.map((i) => (
            <ListRow
              key={i.id}
              title={i.athleteName ?? i.senderLabel ?? "Unmatched"}
              subtitle={i.messageSnippet}
              trailing={
                <span className="text-xs text-ds-text-muted">
                  {timeAgo(i.receivedAt ?? i.createdAt)}
                </span>
              }
            />
          ))
        )}
      </Card>
    </div>
  )
}
