import { requireCoach } from "@/lib/auth"
import { getDashboardSummary } from "@/lib/data/dashboard"
import { getAgendaAttention } from "@/lib/data/agenda"
import { getInbox } from "@/lib/data/inbox"
import { listClientsForRoster } from "@/lib/data/clients"
import { MissionControl } from "@/components/coach/mission-control"

// Mission Control (U2) — the operating center. Route stays /dashboard. Reuses the
// existing data sources (summary, roster, attention, inbox); the prior combat /
// calendar reads are dropped (those sections moved off this screen), so this makes
// FEWER backend calls, not more. No data is written.
export default async function MissionControlPage() {
  const profile = await requireCoach()
  const [summary, roster, attention, inbox] = await Promise.all([
    getDashboardSummary(),
    listClientsForRoster(),
    getAgendaAttention(),
    getInbox(),
  ])

  const firstName = profile.full_name?.split(" ")[0]
  const hour = new Date().getHours()
  const partOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"
  const needsCount = roster.filter(
    (c) => c.openAlertCount > 0 || c.complianceScore < 60
  ).length
  const pendingCount = inbox.items.filter((i) => i.status === "pending").length

  const greeting =
    `Good ${partOfDay}${firstName ? `, ${firstName}` : ""}. ` +
    `${needsCount} athlete${needsCount === 1 ? "" : "s"} need attention` +
    (pendingCount > 0
      ? ` · ${pendingCount} approval${pendingCount === 1 ? "" : "s"} waiting.`
      : ".")

  return (
    <main className="flex flex-1 flex-col">
      <MissionControl
        greeting={greeting}
        summary={summary}
        roster={roster}
        attention={attention}
        inboxItems={inbox.items}
      />
    </main>
  )
}
