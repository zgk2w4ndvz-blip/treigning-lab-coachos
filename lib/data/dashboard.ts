import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { listClientsForRoster } from "@/lib/data/clients"
import { countActiveCuts } from "@/lib/data/combat"
import { getAllComputedAlerts } from "@/lib/data/alerts"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { getBypassDashboard } from "@/lib/dev-roster-store"
import type { DashboardSummary } from "@/types/models"

/** Active-alert count for the topbar bell, derived from the alert engine. */
export async function getActiveAlertCount(): Promise<number> {
  return (await getAllComputedAlerts()).length
}

function dateDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
}

const today = () => new Date().toISOString().slice(0, 10)

/** Aggregate KPIs + feeds for the coach dashboard. Alerts come from the engine. */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const computedAlerts = await getAllComputedAlerts()
  const alertFields = {
    openAlerts: computedAlerts.length,
    recentAlerts: computedAlerts.slice(0, 8),
  }

  if (DEV_AUTH_BYPASS) {
    return { ...getBypassDashboard(), ...alertFields }
  }

  const supabase = await createServerSupabase()

  const [roster, activeCuts, activeClients, upcomingComps, todaysTasks] =
    await Promise.all([
      listClientsForRoster(),
      countActiveCuts(),
      supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("competitions")
        .select("*", { count: "exact", head: true })
        .gte("competition_date", today())
        .lte("competition_date", dateDaysFromNow(30)),
      supabase
        .from("tasks")
        .select("*")
        .in("status", ["open", "in_progress"])
        .order("priority", { ascending: false })
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(8),
    ])

  const avgCompliance =
    roster.length === 0
      ? 0
      : Math.round(
          roster.reduce((sum, r) => sum + r.complianceScore, 0) / roster.length
        )

  return {
    activeClients: activeClients.count ?? 0,
    upcomingCompetitions: upcomingComps.count ?? 0,
    avgCompliance,
    activeCuts,
    todaysTasks: todaysTasks.data ?? [],
    ...alertFields,
  }
}
