import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { getBypassClientById } from "@/lib/dev-roster-store"
import {
  getAthleteDay,
  getAthleteEntries,
  type AthleteDayEntry,
} from "@/lib/dev-athlete-log-store"
import { getMockClient } from "@/lib/mock/athletes"
import {
  mockHydrationLogs,
  mockNutritionPlan,
  mockRecoveryLogs,
  mockSupplements,
  mockSupplementLogs,
  mockNutritionLogs,
  mockWeightGoal,
  mockWeightLogs,
} from "@/lib/mock/series"
import {
  hydrationCompliance,
  nutritionCompliance,
  recoveryCompliance,
  supplementCompliance,
  weightCompliance,
} from "@/lib/metrics/compliance"
import { todayStr } from "@/lib/utils/format"
import type {
  AthleteDomainStatus,
  AthleteProgress,
  AthleteToday,
  Client,
  TodaySupplement,
} from "@/types/models"

// ---- completion-score math (pure) ------------------------------------------

interface DayInputs {
  weightLogged: boolean
  hydrationOz: number
  hydrationTargetOz: number | null
  nutritionLogged: boolean
  supplementsTaken: number
  supplementsTotal: number
  recoveryLogged: boolean
}

/** Each domain contributes a 0–1 fraction; the score is their average × 100. */
function completionScore(d: DayInputs): number {
  const hydrationFrac = d.hydrationTargetOz
    ? Math.min(1, d.hydrationOz / d.hydrationTargetOz)
    : d.hydrationOz > 0
      ? 1
      : 0
  const supplementFrac =
    d.supplementsTotal > 0 ? d.supplementsTaken / d.supplementsTotal : 1
  const fractions = [
    d.weightLogged ? 1 : 0,
    hydrationFrac,
    d.nutritionLogged ? 1 : 0,
    supplementFrac,
    d.recoveryLogged ? 1 : 0,
  ]
  const avg = fractions.reduce((a, b) => a + b, 0) / fractions.length
  return Math.round(avg * 100)
}

function buildDomains(t: {
  weightLogged: boolean
  weightLbs: number | null
  hydrationOz: number
  hydrationTargetOz: number | null
  nutritionLogged: boolean
  calories: number | null
  supplementsTaken: number
  supplementsTotal: number
  recoveryLogged: boolean
  sleepHours: number | null
}): AthleteDomainStatus[] {
  return [
    {
      domain: "weight",
      label: "Body weight",
      logged: t.weightLogged,
      summary: t.weightLbs != null ? `${t.weightLbs} lb` : null,
    },
    {
      domain: "hydration",
      label: "Hydration",
      logged: t.hydrationOz > 0,
      summary: `${Math.round(t.hydrationOz)}${
        t.hydrationTargetOz ? ` / ${t.hydrationTargetOz}` : ""
      } oz`,
    },
    {
      domain: "nutrition",
      label: "Nutrition",
      logged: t.nutritionLogged,
      summary: t.calories != null ? `${t.calories} kcal` : null,
    },
    {
      domain: "supplements",
      label: "Supplements",
      logged: t.supplementsTotal > 0 && t.supplementsTaken === t.supplementsTotal,
      summary:
        t.supplementsTotal > 0
          ? `${t.supplementsTaken}/${t.supplementsTotal} taken`
          : "None assigned",
    },
    {
      domain: "recovery",
      label: "Recovery",
      logged: t.recoveryLogged,
      summary: t.sleepHours != null ? `${t.sleepHours} h sleep` : null,
    },
  ]
}

/** Coach notes minus the demo seed marker. */
function coachNotesOf(client: Client): string | null {
  const n = client.notes?.trim()
  return n && n !== "DEMO_SEED" ? n : null
}

// ---- Today -----------------------------------------------------------------

function bypassToday(clientId: string, date: string): AthleteToday | null {
  const client = getBypassClientById(clientId) ?? getMockClient(clientId)
  if (!client) return null

  const entry = getAthleteDay(clientId, date)
  const plan = mockNutritionPlan(clientId)
  const goal = mockWeightGoal(clientId)
  const hydrationTargetOz = mockHydrationLogs(clientId).at(-1)?.oz_target ?? null
  const sups = mockSupplements(clientId)

  const supplements: TodaySupplement[] = sups.map((s) => ({
    id: s.id,
    name: s.name,
    dosage: s.dosage,
    timing: s.timing,
    taken: entry.supplements?.[s.id] ?? false,
  }))

  return assembleToday({
    client,
    date,
    entry,
    caloriesTarget: plan?.calories ?? null,
    proteinTarget: plan?.protein_g ?? null,
    carbsTarget: plan?.carbs_g ?? null,
    fatTarget: plan?.fat_g ?? null,
    weightTarget: goal?.target_weight ?? null,
    weightDirection: goal?.direction ?? null,
    hydrationTargetOz,
    supplements,
  })
}

interface AssembleArgs {
  client: Client
  date: string
  entry: AthleteDayEntry
  caloriesTarget: number | null
  proteinTarget: number | null
  carbsTarget: number | null
  fatTarget: number | null
  weightTarget: number | null
  weightDirection: "cut" | "bulk" | "maintain" | null
  hydrationTargetOz: number | null
  supplements: TodaySupplement[]
}

function assembleToday(a: AssembleArgs): AthleteToday {
  const hydrationOz = a.entry.hydrationOz ?? 0
  const nutrition = a.entry.nutrition
  const recovery = a.entry.recovery
  const nutritionLogged = nutrition?.calories != null
  const recoveryLogged =
    recovery != null &&
    (recovery.sleepHours != null ||
      recovery.soreness != null ||
      recovery.energy != null ||
      recovery.stress != null)
  const supplementsTaken = a.supplements.filter((s) => s.taken).length

  const domains = buildDomains({
    weightLogged: a.entry.weightLbs != null,
    weightLbs: a.entry.weightLbs ?? null,
    hydrationOz,
    hydrationTargetOz: a.hydrationTargetOz,
    nutritionLogged,
    calories: nutrition?.calories ?? null,
    supplementsTaken,
    supplementsTotal: a.supplements.length,
    recoveryLogged,
    sleepHours: recovery?.sleepHours ?? null,
  })

  return {
    client: a.client,
    date: a.date,
    coachNotes: coachNotesOf(a.client),
    weight: {
      target: a.weightTarget,
      direction: a.weightDirection,
      loggedLbs: a.entry.weightLbs ?? null,
    },
    hydration: { targetOz: a.hydrationTargetOz, consumedOz: hydrationOz },
    nutrition: {
      caloriesTarget: a.caloriesTarget,
      proteinTarget: a.proteinTarget,
      carbsTarget: a.carbsTarget,
      fatTarget: a.fatTarget,
      calories: nutrition?.calories ?? null,
      protein: nutrition?.protein ?? null,
      carbs: nutrition?.carbs ?? null,
      fat: nutrition?.fat ?? null,
    },
    supplements: a.supplements,
    recovery: {
      sleepHours: recovery?.sleepHours ?? null,
      soreness: recovery?.soreness ?? null,
      energy: recovery?.energy ?? null,
      stress: recovery?.stress ?? null,
      logged: recoveryLogged,
    },
    domains,
    completionScore: completionScore({
      weightLogged: a.entry.weightLbs != null,
      hydrationOz,
      hydrationTargetOz: a.hydrationTargetOz,
      nutritionLogged,
      supplementsTaken,
      supplementsTotal: a.supplements.length,
      recoveryLogged,
    }),
  }
}

async function realToday(
  clientId: string,
  date: string
): Promise<AthleteToday | null> {
  const supabase = await createServerSupabase()

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle()
  if (!client) return null

  const [plan, hydration, nutrition, recovery, supplements, supLogs, weight] =
    await Promise.all([
      supabase
        .from("nutrition_plans")
        .select("*")
        .eq("client_id", clientId)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("hydration_logs")
        .select("*")
        .eq("client_id", clientId)
        .eq("logged_date", date)
        .maybeSingle(),
      supabase
        .from("nutrition_logs")
        .select("*")
        .eq("client_id", clientId)
        .eq("logged_date", date)
        .maybeSingle(),
      supabase
        .from("recovery_logs")
        .select("*")
        .eq("client_id", clientId)
        .eq("logged_date", date)
        .maybeSingle(),
      supabase
        .from("supplements")
        .select("*")
        .eq("client_id", clientId)
        .eq("is_active", true),
      supabase
        .from("supplement_logs")
        .select("*")
        .eq("client_id", clientId)
        .gte("logged_at", `${date}T00:00:00`)
        .lte("logged_at", `${date}T23:59:59`),
      supabase
        .from("weight_logs")
        .select("*")
        .eq("client_id", clientId)
        .gte("logged_at", `${date}T00:00:00`)
        .lte("logged_at", `${date}T23:59:59`)
        .order("logged_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

  const takenById = new Map(
    (supLogs.data ?? []).map((l) => [l.supplement_id, l.taken])
  )
  const todaySupplements: TodaySupplement[] = (supplements.data ?? []).map(
    (s) => ({
      id: s.id,
      name: s.name,
      dosage: s.dosage,
      timing: s.timing,
      taken: takenById.get(s.id) ?? false,
    })
  )

  const entry: AthleteDayEntry = {
    weightLbs: weight.data?.weight_lbs ?? null,
    hydrationOz: hydration.data?.oz_consumed ?? 0,
    nutrition: nutrition.data
      ? {
          calories: nutrition.data.calories,
          protein: nutrition.data.protein_g,
          carbs: nutrition.data.carbs_g,
          fat: nutrition.data.fat_g,
        }
      : undefined,
    recovery: recovery.data
      ? {
          sleepHours: recovery.data.sleep_hours,
          soreness: recovery.data.soreness,
          energy: recovery.data.energy,
          stress: recovery.data.stress,
        }
      : undefined,
  }

  return assembleToday({
    client,
    date,
    entry,
    caloriesTarget: plan.data?.calories ?? null,
    proteinTarget: plan.data?.protein_g ?? null,
    carbsTarget: plan.data?.carbs_g ?? null,
    fatTarget: plan.data?.fat_g ?? null,
    weightTarget: null,
    weightDirection: null,
    hydrationTargetOz: hydration.data?.oz_target ?? null,
    supplements: todaySupplements,
  })
}

/** The athlete's "Today" view: targets + today's logged entries + score. */
export async function getAthleteToday(
  clientId: string
): Promise<AthleteToday | null> {
  const date = todayStr()
  return DEV_AUTH_BYPASS ? bypassToday(clientId, date) : realToday(clientId, date)
}

// ---- Progress --------------------------------------------------------------

function dayCompletionFromEntry(
  entry: AthleteDayEntry,
  hydrationTargetOz: number | null,
  supplementsTotal: number
): number {
  const nutritionLogged = entry.nutrition?.calories != null
  const recoveryLogged =
    entry.recovery != null &&
    (entry.recovery.sleepHours != null ||
      entry.recovery.soreness != null ||
      entry.recovery.energy != null ||
      entry.recovery.stress != null)
  const supplementsTaken = entry.supplements
    ? Object.values(entry.supplements).filter(Boolean).length
    : 0
  return completionScore({
    weightLogged: entry.weightLbs != null,
    hydrationOz: entry.hydrationOz ?? 0,
    hydrationTargetOz,
    nutritionLogged,
    supplementsTaken,
    supplementsTotal,
    recoveryLogged,
  })
}

function bypassProgress(clientId: string): AthleteProgress | null {
  const client = getBypassClientById(clientId) ?? getMockClient(clientId)
  if (!client) return null

  const entries = getAthleteEntries(clientId)
  const hydrationTargetOz = mockHydrationLogs(clientId).at(-1)?.oz_target ?? null
  const supplementsTotal = mockSupplements(clientId).length

  // Weight series: mock history overlaid with any self-logged days.
  const series = new Map<string, number>()
  for (const w of mockWeightLogs(clientId, 30)) {
    series.set(w.logged_at.slice(0, 10), w.weight_lbs)
  }
  for (const [date, e] of Object.entries(entries)) {
    if (e.weightLbs != null) series.set(date, e.weightLbs)
  }
  const weightSeries = [...series.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, weight]) => ({ date, weight }))

  const compliance = {
    weight: weightCompliance(mockWeightLogs(clientId, 30), 30),
    hydration: hydrationCompliance(mockHydrationLogs(clientId)),
    nutrition: nutritionCompliance(
      mockNutritionPlan(clientId),
      mockNutritionLogs(clientId)
    ),
    supplements: supplementCompliance(
      mockSupplements(clientId),
      mockSupplementLogs(clientId),
      7
    ),
    recovery: recoveryCompliance(mockRecoveryLogs(clientId), 14),
  }
  const overall = Math.round(
    (compliance.weight +
      compliance.hydration +
      compliance.nutrition +
      compliance.supplements +
      compliance.recovery) /
      5
  )

  // Last 7 days of the athlete's own logging + the streak it implies.
  const last7Completion: { date: string; score: number }[] = []
  for (let d = 6; d >= 0; d--) {
    const date = new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10)
    const e = entries[date]
    last7Completion.push({
      date,
      score: e ? dayCompletionFromEntry(e, hydrationTargetOz, supplementsTotal) : 0,
    })
  }
  let streakDays = 0
  for (let d = 0; d < 60; d++) {
    const date = new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10)
    if (entries[date] && dayCompletionFromEntry(entries[date], hydrationTargetOz, supplementsTotal) > 0) {
      streakDays++
    } else if (d > 0) {
      break
    }
  }

  return {
    client,
    weightSeries,
    weightGoal: mockWeightGoal(clientId),
    compliance: { ...compliance, overall },
    streakDays,
    last7Completion,
  }
}

async function realProgress(clientId: string): Promise<AthleteProgress | null> {
  const supabase = await createServerSupabase()
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle()
  if (!client) return null

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const [weights, hydration, nutrition, recovery, supplements, supLogs, plan, goal] =
    await Promise.all([
      supabase.from("weight_logs").select("*").eq("client_id", clientId).gte("logged_at", since).order("logged_at"),
      supabase.from("hydration_logs").select("*").eq("client_id", clientId),
      supabase.from("nutrition_logs").select("*").eq("client_id", clientId),
      supabase.from("recovery_logs").select("*").eq("client_id", clientId),
      supabase.from("supplements").select("*").eq("client_id", clientId).eq("is_active", true),
      supabase.from("supplement_logs").select("*").eq("client_id", clientId),
      supabase.from("nutrition_plans").select("*").eq("client_id", clientId).eq("is_active", true).maybeSingle(),
      supabase.from("weight_goals").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ])

  const weightSeries = (weights.data ?? []).map((w) => ({
    date: w.logged_at.slice(0, 10),
    weight: w.weight_lbs,
  }))

  const compliance = {
    weight: weightCompliance(weights.data ?? [], 30),
    hydration: hydrationCompliance(hydration.data ?? []),
    nutrition: nutritionCompliance(plan.data ?? null, nutrition.data ?? []),
    supplements: supplementCompliance(supplements.data ?? [], supLogs.data ?? [], 7),
    recovery: recoveryCompliance(recovery.data ?? [], 14),
  }
  const overall = Math.round(
    (compliance.weight + compliance.hydration + compliance.nutrition + compliance.supplements + compliance.recovery) / 5
  )

  return {
    client,
    weightSeries,
    weightGoal: goal.data ?? null,
    compliance: { ...compliance, overall },
    streakDays: 0,
    last7Completion: [],
  }
}

/** The athlete's progress dashboard aggregate. */
export async function getAthleteProgress(
  clientId: string
): Promise<AthleteProgress | null> {
  return DEV_AUTH_BYPASS ? bypassProgress(clientId) : realProgress(clientId)
}
