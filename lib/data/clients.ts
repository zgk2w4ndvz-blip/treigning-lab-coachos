import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { compliancePct } from "@/lib/utils/format"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import {
  getBypassClientById,
  getBypassRosterList,
  getBypassSnapshot,
} from "@/lib/dev-roster-store"
import type {
  Client,
  ClientListItem,
  ClientSnapshot,
  Competition,
} from "@/types/models"

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function dateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
}

/**
 * Roster view: every client visible to the current coach, enriched with their
 * next competition, open-alert count, and a 7-day compliance proxy.
 * RLS scopes the rows to the signed-in coach automatically.
 */
export async function listClientsForRoster(): Promise<ClientListItem[]> {
  if (DEV_AUTH_BYPASS) return getBypassRosterList()

  const supabase = await createServerSupabase()

  const [{ data: clients }, { data: comps }, { data: alerts }, { data: hydration }, { data: recovery }, { data: weights }] =
    await Promise.all([
      supabase.from("clients").select("*").order("created_at", { ascending: false }),
      supabase
        .from("competitions")
        .select("*")
        .gte("competition_date", dateDaysAgo(0))
        .order("competition_date", { ascending: true }),
      supabase.from("alerts").select("client_id").eq("status", "active"),
      supabase
        .from("hydration_logs")
        .select("client_id")
        .gte("logged_date", dateDaysAgo(7)),
      supabase
        .from("recovery_logs")
        .select("client_id")
        .gte("logged_date", dateDaysAgo(7)),
      supabase
        .from("weight_logs")
        .select("client_id, body_fat_pct, logged_at")
        .order("logged_at", { ascending: false }),
    ])

  const nextCompByClient = new Map<string, Competition>()
  for (const c of comps ?? []) {
    if (!nextCompByClient.has(c.client_id)) nextCompByClient.set(c.client_id, c)
  }

  // Latest non-null body-fat % per client (rows are newest-first).
  const bodyFatByClient = new Map<string, number>()
  for (const w of weights ?? []) {
    if (w.body_fat_pct != null && !bodyFatByClient.has(w.client_id)) {
      bodyFatByClient.set(w.client_id, w.body_fat_pct)
    }
  }

  const alertCount = tally(alerts)
  const hydrationCount = tally(hydration)
  const recoveryCount = tally(recovery)

  return (clients ?? []).map((client) => ({
    client,
    nextCompetition: nextCompByClient.get(client.id) ?? null,
    openAlertCount: alertCount.get(client.id) ?? 0,
    complianceScore: rosterCompliance(
      hydrationCount.get(client.id) ?? 0,
      recoveryCount.get(client.id) ?? 0
    ),
    latestBodyFatPct: bodyFatByClient.get(client.id) ?? null,
  }))
}

export async function getClientById(clientId: string): Promise<Client | null> {
  if (DEV_AUTH_BYPASS) return getBypassClientById(clientId)

  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle()
  return data ?? null
}

/** Full 360° snapshot used by the client overview page. */
export async function getClientSnapshot(
  clientId: string
): Promise<ClientSnapshot | null> {
  if (DEV_AUTH_BYPASS) return getBypassSnapshot(clientId)

  const supabase = await createServerSupabase()

  const client = await getClientById(clientId)
  if (!client) return null

  const today = dateDaysAgo(0)

  const [
    latestWeight,
    weightGoal,
    activeNutritionPlan,
    hydrationToday,
    latestRecovery,
    activeProgram,
    nextCompetition,
    openAlerts,
    weightCount,
    nutritionCount,
    hydrationCount,
    recoveryCount,
  ] = await Promise.all([
    supabase
      .from("weight_logs")
      .select("*")
      .eq("client_id", clientId)
      .order("logged_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("weight_goals")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("nutrition_plans")
      .select("*")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("hydration_logs")
      .select("*")
      .eq("client_id", clientId)
      .eq("logged_date", today)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("recovery_logs")
      .select("*")
      .eq("client_id", clientId)
      .order("logged_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("training_programs")
      .select("*")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("competitions")
      .select("*")
      .eq("client_id", clientId)
      .gte("competition_date", today)
      .order("competition_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("alerts")
      .select("*")
      .eq("client_id", clientId)
      .eq("status", "active")
      .order("severity", { ascending: false }),
    countSince(supabase, "weight_logs", clientId, "logged_at", isoDaysAgo(7)),
    countSince(supabase, "nutrition_logs", clientId, "logged_date", dateDaysAgo(7)),
    countSince(supabase, "hydration_logs", clientId, "logged_date", dateDaysAgo(7)),
    countSince(supabase, "recovery_logs", clientId, "logged_date", dateDaysAgo(7)),
  ])

  return {
    client,
    latestWeight: latestWeight.data ?? null,
    weightGoal: weightGoal.data ?? null,
    activeNutritionPlan: activeNutritionPlan.data ?? null,
    hydrationToday: hydrationToday.data ?? null,
    latestRecovery: latestRecovery.data ?? null,
    activeProgram: activeProgram.data ?? null,
    nextCompetition: nextCompetition.data ?? null,
    openAlerts: openAlerts.data ?? [],
    complianceScore: snapshotCompliance({
      weight: weightCount,
      nutrition: nutritionCount,
      hydration: hydrationCount,
      recovery: recoveryCount,
    }),
  }
}

// ---- helpers ---------------------------------------------------------------

function tally(rows: { client_id: string }[] | null): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows ?? []) m.set(r.client_id, (m.get(r.client_id) ?? 0) + 1)
  return m
}

async function countSince(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  table:
    | "weight_logs"
    | "nutrition_logs"
    | "hydration_logs"
    | "recovery_logs",
  clientId: string,
  column: string,
  since: string
): Promise<number> {
  const { count } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .gte(column, since)
  return count ?? 0
}

/** Roster proxy: hydration + recovery logging over the last 7 days. */
function rosterCompliance(hydration: number, recovery: number): number {
  const score = ((Math.min(hydration, 7) + Math.min(recovery, 7)) / 14) * 100
  return compliancePct(score)
}

/** Weighted compliance across the four daily-loggable domains (7-day window). */
function snapshotCompliance(counts: {
  weight: number
  nutrition: number
  hydration: number
  recovery: number
}): number {
  const ratio =
    Math.min(counts.weight, 3) / 3 * 0.2 +
    Math.min(counts.nutrition, 7) / 7 * 0.3 +
    Math.min(counts.hydration, 7) / 7 * 0.25 +
    Math.min(counts.recovery, 7) / 7 * 0.25
  return compliancePct(ratio * 100)
}
