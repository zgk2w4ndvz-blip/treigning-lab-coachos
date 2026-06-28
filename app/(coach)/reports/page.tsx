import { requireCoach } from "@/lib/auth"
import { listClientsForRoster } from "@/lib/data/clients"
import { getAllComputedAlerts } from "@/lib/data/alerts"
import { ReportsView } from "@/components/coach/reports-view"

// Reports (U3/U4) — roster-wide analytics. Reuses existing readers only; no new
// backend, no Observation Store reads, no writes.
export default async function ReportsPage() {
  await requireCoach()
  const [roster, alerts] = await Promise.all([
    listClientsForRoster(),
    getAllComputedAlerts(),
  ])
  return (
    <main className="flex flex-1 flex-col">
      <ReportsView roster={roster} alerts={alerts} />
    </main>
  )
}
