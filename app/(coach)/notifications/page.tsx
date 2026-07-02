import { requireCoach } from "@/lib/auth"
import { getInbox } from "@/lib/data/inbox"
import { getAllComputedAlerts } from "@/lib/data/alerts"
import { NotificationsCenter, type NotificationEvent } from "@/components/coach/notifications-center"

// Notifications Center (U4) — built from existing readers (inbox + alert engine).
// Read-only; no notification backend, no writes, no fake data.
export default async function NotificationsPage() {
  await requireCoach()
  const [{ items }, alerts] = await Promise.all([getInbox(), getAllComputedAlerts()])

  const events: NotificationEvent[] = []

  for (const a of alerts) {
    events.push({
      id: `a-${a.id}`,
      kind: a.severity === "critical" ? "critical" : "alert",
      title: a.title,
      detail: a.detail,
      at: a.created_at,
      href: a.client_id ? `/clients/${a.client_id}` : "/alerts",
    })
  }

  for (const i of items) {
    if (i.status === "pending") {
      events.push({
        id: `s-${i.id}`,
        kind: "suggestion",
        title: `New suggestion · ${i.athleteName ?? "unmatched"}`,
        detail: `${i.domain.replace("_", " ")} · ${i.messageSnippet}`.slice(0, 140),
        at: i.createdAt,
        href: "/inbox",
      })
    } else if (i.status === "approved" || i.status === "edited") {
      events.push({
        id: `p-${i.id}`,
        kind: "approval",
        title: `Approved · ${i.athleteName ?? "athlete"}`,
        detail: i.intent ?? i.domain.replace("_", " "),
        at: i.createdAt,
        href: "/inbox",
      })
    }
  }

  events.sort((x, y) => (y.at ?? "").localeCompare(x.at ?? ""))

  return (
    <main className="flex flex-1 flex-col">
      <NotificationsCenter events={events.slice(0, 50)} />
    </main>
  )
}
