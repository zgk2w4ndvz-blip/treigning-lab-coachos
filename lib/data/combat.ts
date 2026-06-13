import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { computeReadiness } from "@/lib/combat/protocols"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { ensureImportedBaselines, hasImportedRoster } from "@/lib/dev-roster-store"
import {
  getMockCombatDetail,
  getMockWeightSeries,
  mockCombatBoard,
  mockWeightClasses,
} from "@/lib/mock/athletes"
import type { Tables } from "@/types/database"
import type {
  CombatCutDetail,
  CombatCutListItem,
  CombatDiscipline,
  ReadinessScore,
  WeighIn,
  WeightClass,
  WeightCut,
} from "@/types/models"

const ACTIVE_STATUSES = ["planning", "active", "peak_week", "weigh_in"] as const

function dateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
}
function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

/** Narrow the jsonb protocol columns to their typed array shapes. */
function asWeightCut(row: Tables<"weight_cuts">): WeightCut {
  return row as unknown as WeightCut
}

/** Per-client metrics needed to score readiness. */
interface ClientMetrics {
  latestWeightLbs: number | null
  hydrationLogs7d: number
  recoveryLogs7d: number
  avgSleepHours: number | null
  trainingCompleted14d: number
}

function readinessFor(cut: WeightCut, m: ClientMetrics): ReadinessScore {
  return computeReadiness({
    currentLbs: m.latestWeightLbs,
    targetLbs: cut.target_weigh_in_lbs,
    weighInAt: cut.weigh_in_at,
    hydrationLogs7d: m.hydrationLogs7d,
    recoveryLogs7d: m.recoveryLogs7d,
    avgSleepHours: m.avgSleepHours,
    trainingCompleted14d: m.trainingCompleted14d,
  })
}

export async function listWeightClasses(
  discipline?: CombatDiscipline
): Promise<WeightClass[]> {
  if (DEV_AUTH_BYPASS) {
    return discipline
      ? mockWeightClasses.filter((c) => c.discipline === discipline)
      : mockWeightClasses
  }

  const supabase = await createServerSupabase()
  let q = supabase
    .from("weight_classes")
    .select("*")
    .order("discipline", { ascending: true })
    .order("sort_order", { ascending: true })
  if (discipline) q = q.eq("discipline", discipline)
  const { data } = await q
  return data ?? []
}

/** Count of non-finished cuts visible to the coach (dashboard KPI). */
export async function countActiveCuts(): Promise<number> {
  if (DEV_AUTH_BYPASS) return hasImportedRoster() ? 0 : mockCombatBoard.length

  const supabase = await createServerSupabase()
  const { count } = await supabase
    .from("weight_cuts")
    .select("*", { count: "exact", head: true })
    .in("status", [...ACTIVE_STATUSES])
  return count ?? 0
}

/** Active cuts across the whole roster, scored for the combat board. */
export async function listActiveCutsForBoard(): Promise<CombatCutListItem[]> {
  if (DEV_AUTH_BYPASS) return hasImportedRoster() ? [] : mockCombatBoard

  const supabase = await createServerSupabase()

  const { data: cutRows } = await supabase
    .from("weight_cuts")
    .select("*")
    .in("status", [...ACTIVE_STATUSES])
    .order("weigh_in_at", { ascending: true, nullsFirst: false })

  const cuts = (cutRows ?? []).map(asWeightCut)
  if (cuts.length === 0) return []

  const clientIds = [...new Set(cuts.map((c) => c.client_id))]
  const cutIds = cuts.map((c) => c.id)

  const [clients, metrics, nextWeighIns] = await Promise.all([
    supabase
      .from("clients")
      .select("id, first_name, last_name, avatar_url, sport")
      .in("id", clientIds),
    loadMetricsForClients(supabase, clientIds),
    supabase
      .from("weigh_ins")
      .select("*")
      .in("weight_cut_id", cutIds)
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true }),
  ])

  const clientMap = new Map((clients.data ?? []).map((c) => [c.id, c]))
  const nextByCut = new Map<string, WeighIn>()
  for (const w of nextWeighIns.data ?? []) {
    if (!nextByCut.has(w.weight_cut_id)) nextByCut.set(w.weight_cut_id, w)
  }

  return cuts
    .map((cut) => {
      const client = clientMap.get(cut.client_id)
      if (!client) return null
      const m = metrics.get(cut.client_id) ?? emptyMetrics()
      return {
        cut,
        client,
        latestWeightLbs: m.latestWeightLbs,
        readiness: readinessFor(cut, m),
        nextWeighIn: nextByCut.get(cut.id) ?? null,
      } satisfies CombatCutListItem
    })
    .filter((x): x is CombatCutListItem => x !== null)
}

/** The client's current cut (if any) plus its weigh-ins + readiness. */
export async function getClientCombatDetail(
  clientId: string
): Promise<CombatCutDetail | null> {
  if (DEV_AUTH_BYPASS) return hasImportedRoster() ? null : getMockCombatDetail(clientId)

  const supabase = await createServerSupabase()

  const { data: cutRow } = await supabase
    .from("weight_cuts")
    .select("*")
    .eq("client_id", clientId)
    .in("status", [...ACTIVE_STATUSES])
    .order("weigh_in_at", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (!cutRow) return null
  const cut = asWeightCut(cutRow)

  const [weighIns, metrics, weightClass] = await Promise.all([
    supabase
      .from("weigh_ins")
      .select("*")
      .eq("weight_cut_id", cut.id)
      .order("scheduled_at", { ascending: true }),
    loadMetricsForClients(supabase, [clientId]),
    cut.weight_class_id
      ? supabase
          .from("weight_classes")
          .select("*")
          .eq("id", cut.weight_class_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const m = metrics.get(clientId) ?? emptyMetrics()

  return {
    cut,
    weighIns: weighIns.data ?? [],
    latestWeightLbs: m.latestWeightLbs,
    readiness: readinessFor(cut, m),
    weightClass: weightClass.data ?? null,
  }
}

/** Weight-log series (oldest→newest) for the cut descent chart. */
export async function getClientWeightSeries(
  clientId: string,
  days = 45
): Promise<{ date: string; weight: number }[]> {
  if (DEV_AUTH_BYPASS) {
    ensureImportedBaselines()
    return getMockWeightSeries(clientId)
  }

  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from("weight_logs")
    .select("weight_lbs, logged_at")
    .eq("client_id", clientId)
    .gte("logged_at", isoDaysAgo(days))
    .order("logged_at", { ascending: true })
  return (data ?? []).map((r) => ({
    date: r.logged_at.slice(0, 10),
    weight: r.weight_lbs,
  }))
}

/** All cuts for a client (history), newest first. */
export async function listClientCuts(clientId: string): Promise<WeightCut[]> {
  if (DEV_AUTH_BYPASS) {
    if (hasImportedRoster()) return []
    const d = getMockCombatDetail(clientId)
    return d ? [d.cut] : []
  }

  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from("weight_cuts")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
  return (data ?? []).map(asWeightCut)
}

// ---- metrics loader --------------------------------------------------------

function emptyMetrics(): ClientMetrics {
  return {
    latestWeightLbs: null,
    hydrationLogs7d: 0,
    recoveryLogs7d: 0,
    avgSleepHours: null,
    trainingCompleted14d: 0,
  }
}

async function loadMetricsForClients(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  clientIds: string[]
): Promise<Map<string, ClientMetrics>> {
  const [weights, hydration, recovery, training] = await Promise.all([
    supabase
      .from("weight_logs")
      .select("client_id, weight_lbs, logged_at")
      .in("client_id", clientIds)
      .order("logged_at", { ascending: false }),
    supabase
      .from("hydration_logs")
      .select("client_id")
      .in("client_id", clientIds)
      .gte("logged_date", dateDaysAgo(7)),
    supabase
      .from("recovery_logs")
      .select("client_id, sleep_hours")
      .in("client_id", clientIds)
      .gte("logged_date", dateDaysAgo(7)),
    supabase
      .from("training_sessions")
      .select("client_id")
      .in("client_id", clientIds)
      .not("completed_at", "is", null)
      .gte("completed_at", isoDaysAgo(14)),
  ])

  const map = new Map<string, ClientMetrics>()
  const ensure = (id: string) => {
    if (!map.has(id)) map.set(id, emptyMetrics())
    return map.get(id)!
  }

  // latest weight (rows already sorted desc)
  for (const w of weights.data ?? []) {
    const m = ensure(w.client_id)
    if (m.latestWeightLbs == null) m.latestWeightLbs = w.weight_lbs
  }
  for (const h of hydration.data ?? []) ensure(h.client_id).hydrationLogs7d++
  const sleepAcc = new Map<string, { sum: number; n: number }>()
  for (const r of recovery.data ?? []) {
    ensure(r.client_id).recoveryLogs7d++
    if (r.sleep_hours != null) {
      const acc = sleepAcc.get(r.client_id) ?? { sum: 0, n: 0 }
      acc.sum += r.sleep_hours
      acc.n += 1
      sleepAcc.set(r.client_id, acc)
    }
  }
  for (const [id, acc] of sleepAcc) {
    if (acc.n > 0) ensure(id).avgSleepHours = acc.sum / acc.n
  }
  for (const t of training.data ?? []) ensure(t.client_id).trainingCompleted14d++

  return map
}
