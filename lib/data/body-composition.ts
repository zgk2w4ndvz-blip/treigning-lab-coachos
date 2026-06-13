import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import {
  ensureImportedBaselines,
  getImportedAthleteById,
} from "@/lib/dev-roster-store"
import {
  getStoredMeasurements,
  type StoredMeasurement,
} from "@/lib/dev-body-comp-store"
import { mockWeightGoal, mockWeightLogs } from "@/lib/mock/series"
import type {
  BodyCompMetricKey,
  BodyCompMetricSummary,
  BodyCompositionData,
  WeightLog,
} from "@/types/models"

const COACH = "00000000-0000-0000-0000-0000000000c0"

/** Display metadata for the six tracked metrics (order = display order). */
export const BODY_COMP_METRICS: {
  key: BodyCompMetricKey
  label: string
  unit: string
}[] = [
  { key: "weight_lbs", label: "Weight", unit: "lb" },
  { key: "body_fat_pct", label: "Body Fat", unit: "%" },
  { key: "body_fat_mass_lbs", label: "Body Fat Mass", unit: "lb" },
  { key: "skeletal_muscle_mass_lbs", label: "Skeletal Muscle Mass", unit: "lb" },
  { key: "total_body_water_lbs", label: "Total Body Water", unit: "lb" },
  { key: "bmr", label: "Basal Metabolic Rate", unit: "kcal" },
]

const isoDaysAgo = (d: number) =>
  new Date(Date.now() - d * 86_400_000).toISOString()

/** Build current/previous/change + series for every metric. Null-safe. */
function summarize(logs: WeightLog[]): BodyCompMetricSummary[] {
  return BODY_COMP_METRICS.map(({ key, label, unit }) => {
    const series = logs
      .map((l) => ({ date: l.logged_at.slice(0, 10), value: l[key] }))
      .filter((p): p is { date: string; value: number } => p.value != null)
    const current = series.length ? series[series.length - 1].value : null
    const previous = series.length > 1 ? series[series.length - 2].value : null
    const change =
      current != null && previous != null
        ? Math.round((current - previous) * 100) / 100
        : null
    return { key, label, unit, current, previous, change, series }
  })
}

function storedToLog(clientId: string, m: StoredMeasurement): WeightLog {
  return {
    id: m.id,
    client_id: clientId,
    logged_by: COACH,
    weight_lbs: m.weightLbs,
    body_fat_pct: m.bodyFatPct,
    muscle_mass_lbs: m.skeletalMuscleMassLbs,
    body_fat_mass_lbs: m.bodyFatMassLbs,
    bmr: m.bmr,
    total_body_water_lbs: m.totalBodyWaterLbs,
    skeletal_muscle_mass_lbs: m.skeletalMuscleMassLbs,
    logged_at: m.loggedAt,
    photo_url: null,
    notes: m.notes,
    created_at: m.loggedAt,
  }
}

function bypass(clientId: string, days: number): BodyCompositionData {
  ensureImportedBaselines()
  const base = mockWeightLogs(clientId)

  // Seed the latest reading from CSV-imported body-composition values, if any.
  const imported = getImportedAthleteById(clientId)
  if (imported && base.length) {
    const last = base[base.length - 1]
    if (imported.currentWeight != null) last.weight_lbs = imported.currentWeight
    if (imported.bodyFatPct != null) last.body_fat_pct = imported.bodyFatPct
    if (imported.bodyFatMassLbs != null)
      last.body_fat_mass_lbs = imported.bodyFatMassLbs
    if (imported.bmr != null) last.bmr = imported.bmr
    if (imported.totalBodyWaterLbs != null)
      last.total_body_water_lbs = imported.totalBodyWaterLbs
    if (imported.skeletalMuscleMassLbs != null)
      last.skeletal_muscle_mass_lbs = imported.skeletalMuscleMassLbs
  }

  const stored = getStoredMeasurements(clientId).map((m) =>
    storedToLog(clientId, m)
  )
  const cutoff = Date.now() - days * 86_400_000
  const logs = [...base, ...stored]
    .filter((l) => new Date(l.logged_at).getTime() >= cutoff)
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at))

  return {
    logs,
    goal: mockWeightGoal(clientId),
    latest: logs.length ? logs[logs.length - 1] : null,
    metrics: summarize(logs),
  }
}

async function real(clientId: string, days: number): Promise<BodyCompositionData> {
  const supabase = await createServerSupabase()
  const [logs, goal] = await Promise.all([
    supabase
      .from("weight_logs")
      .select("*")
      .eq("client_id", clientId)
      .gte("logged_at", isoDaysAgo(days))
      .order("logged_at", { ascending: true }),
    supabase
      .from("weight_goals")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  const rows = logs.data ?? []
  return {
    logs: rows,
    goal: goal.data ?? null,
    latest: rows.length ? rows[rows.length - 1] : null,
    metrics: summarize(rows),
  }
}

/** Full body-composition module data for one client. */
export async function getBodyComposition(
  clientId: string,
  days = 45
): Promise<BodyCompositionData> {
  return DEV_AUTH_BYPASS ? bypass(clientId, days) : real(clientId, days)
}
