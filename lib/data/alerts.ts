import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { getBypassCompetitions } from "@/lib/dev-roster-store"
import { evaluateAlerts, sortBySeverity } from "@/lib/alerts/engine"
import {
  getHydrationData,
  getNutritionData,
  getRecoveryData,
  getTrainingData,
  getWeightData,
} from "@/lib/data/logs"
import { getClientById, listClientsForRoster } from "@/lib/data/clients"
import { getClientCombatDetail } from "@/lib/data/combat"
import { fullName } from "@/lib/utils/format"
import type { Alert, Competition } from "@/types/models"

async function nextCompetitionFor(clientId: string): Promise<Competition | null> {
  const today = new Date().toISOString().slice(0, 10)
  if (DEV_AUTH_BYPASS) {
    return (
      getBypassCompetitions()
        .filter((c) => c.client_id === clientId && c.competition_date >= today)
        .sort((a, b) => a.competition_date.localeCompare(b.competition_date))[0] ?? null
    )
  }
  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from("competitions")
    .select("*")
    .eq("client_id", clientId)
    .gte("competition_date", today)
    .order("competition_date", { ascending: true })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

interface ClientLite {
  id: string
  first_name: string
  last_name: string
}

async function evaluateForClient(client: ClientLite): Promise<Alert[]> {
  const [weight, hydration, recovery, nutrition, training, combat, nextComp] =
    await Promise.all([
      getWeightData(client.id),
      getHydrationData(client.id),
      getRecoveryData(client.id),
      getNutritionData(client.id),
      getTrainingData(client.id),
      getClientCombatDetail(client.id),
      nextCompetitionFor(client.id),
    ])

  return evaluateAlerts({
    clientId: client.id,
    clientName: fullName(client.first_name, client.last_name),
    weightLogs: weight.logs,
    weightGoal: weight.goal,
    hydration,
    recovery,
    nutritionPlan: nutrition.plan,
    nutritionLogs: nutrition.logs,
    training: training.sessions,
    nextCompetition: nextComp,
    combat: combat
      ? {
          weighInAt: combat.cut.weigh_in_at,
          targetLbs: combat.cut.target_weigh_in_lbs,
          currentLbs: combat.latestWeightLbs,
          readinessOverall: combat.readiness.overall,
        }
      : null,
  })
}

/** Live alerts computed from one athlete's data across all modules. */
export async function getClientComputedAlerts(clientId: string): Promise<Alert[]> {
  const client = await getClientById(clientId)
  if (!client) return []
  return sortBySeverity(await evaluateForClient(client))
}

/** Live alerts computed across the whole roster (severity-sorted). */
export async function getAllComputedAlerts(): Promise<Alert[]> {
  const roster = await listClientsForRoster()
  const perClient = await Promise.all(
    roster.map((r) => evaluateForClient(r.client))
  )
  return sortBySeverity(perClient.flat())
}
