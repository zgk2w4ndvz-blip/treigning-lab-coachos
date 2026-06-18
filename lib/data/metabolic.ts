import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import {
  getStoredAssessments,
  type StoredAssessment,
  type StoredCurvePoint,
} from "@/lib/dev-metabolic-store"
import { getLowBasePrescription } from "@/lib/data/low-base"
import { getMeasurements } from "@/lib/data/measurements"
import { getBodyComposition } from "@/lib/data/body-composition"
import { setPointZone } from "@/lib/metrics/metabolic"
import { hipWaistPercent } from "@/lib/metrics/measurements"
import type {
  BodyMeasurement,
  LowBasePrescription,
  MetabolicAssessment,
  MetabolicAssessmentWithPoints,
  MetabolicCurvePoint,
  MetabolicData,
  StatTrackerScale,
  StatTrackerTape,
  WeightLog,
} from "@/types/models"

const COACH = "00000000-0000-0000-0000-0000000000c0"

/**
 * Scalar metric metadata for the Cart / Manual Cart cards. The UI labels are the
 * Treigning Lab terms (Set Point ← mep_bpm, Aerobic ← aerobic_threshold_bpm).
 */
export const METABOLIC_METRICS: {
  key: "vo2_max" | "mep_bpm" | "aerobic_threshold_bpm" | "max_hr_bpm" | "calories_burned_per_min"
  label: string
  unit: string
}[] = [
  { key: "vo2_max", label: "VO₂ Max", unit: "ml/kg/min" },
  { key: "mep_bpm", label: "Set Point", unit: "bpm" },
  { key: "max_hr_bpm", label: "Max HR", unit: "bpm" },
  { key: "aerobic_threshold_bpm", label: "Aerobic", unit: "bpm" },
  { key: "calories_burned_per_min", label: "Calories Burned/min", unit: "kcal" },
]

// ---- dev-store → row mappers -----------------------------------------------

function storedPointToRow(
  assessmentId: string,
  clientId: string,
  p: StoredCurvePoint
): MetabolicCurvePoint {
  return {
    id: p.id,
    assessment_id: assessmentId,
    client_id: clientId,
    phase: p.phase,
    elapsed_sec: p.elapsedSec,
    stage: p.stage,
    heart_rate_bpm: p.heartRateBpm,
    ventilation_l_min: p.ventilationLMin,
    vo2: p.vo2,
    created_at: "",
  }
}

function storedToAssessment(
  clientId: string,
  a: StoredAssessment
): MetabolicAssessmentWithPoints {
  return {
    id: a.id,
    client_id: clientId,
    logged_by: COACH,
    assessed_at: a.assessedAt,
    source: a.source,
    vo2_max: a.vo2Max,
    mep_bpm: a.mepBpm,
    aerobic_threshold_bpm: a.aerobicThresholdBpm,
    max_hr_bpm: a.maxHrBpm,
    calories_burned_per_min: a.caloriesBurnedPerMin,
    notes: a.notes,
    created_at: a.assessedAt,
    updated_at: a.assessedAt,
    points: sortPoints(a.points.map((p) => storedPointToRow(a.id, clientId, p))),
  }
}

/** Order curve points by phase (increase first), then stage. */
function sortPoints(points: MetabolicCurvePoint[]): MetabolicCurvePoint[] {
  const order = { increase: 0, decrease: 1 } as const
  return [...points].sort(
    (a, b) => order[a.phase] - order[b.phase] || a.stage - b.stage
  )
}

/** Drop curve points for the list view (only `latest` needs them). */
function scalarOnly(a: MetabolicAssessmentWithPoints): MetabolicAssessment {
  return {
    id: a.id,
    client_id: a.client_id,
    logged_by: a.logged_by,
    assessed_at: a.assessed_at,
    source: a.source,
    vo2_max: a.vo2_max,
    mep_bpm: a.mep_bpm,
    aerobic_threshold_bpm: a.aerobic_threshold_bpm,
    max_hr_bpm: a.max_hr_bpm,
    calories_burned_per_min: a.calories_burned_per_min,
    notes: a.notes,
    created_at: a.created_at,
    updated_at: a.updated_at,
  }
}

// ---- Tape / Scale aggregation ----------------------------------------------

function buildTape(latest: BodyMeasurement | null): StatTrackerTape {
  if (!latest) return { bicep_in: null, neck_in: null, hipWaistPct: null }
  return {
    bicep_in: latest.bicep_in,
    neck_in: latest.neck_in,
    hipWaistPct: hipWaistPercent(latest),
  }
}

function buildScale(latest: WeightLog | null): StatTrackerScale {
  if (!latest) return { bodyFatPct: null, bodyWaterLbs: null, leanBodyMassLbs: null }
  const lbm =
    latest.weight_lbs != null && latest.body_fat_mass_lbs != null
      ? Math.round((latest.weight_lbs - latest.body_fat_mass_lbs) * 100) / 100
      : null
  return {
    bodyFatPct: latest.body_fat_pct,
    bodyWaterLbs: latest.total_body_water_lbs,
    leanBodyMassLbs: lbm,
  }
}

// ---- assembly --------------------------------------------------------------

function assemble(
  assessments: MetabolicAssessment[],
  latest: MetabolicAssessmentWithPoints | null,
  latestCurve: MetabolicAssessmentWithPoints | null,
  lowBase: LowBasePrescription | null,
  tape: StatTrackerTape,
  scale: StatTrackerScale
): MetabolicData {
  return {
    assessments,
    latest,
    latestCurve,
    latestCart: assessments.find((a) => a.source === "cart") ?? null,
    latestManual: assessments.find((a) => a.source === "manual_cart") ?? null,
    zone: setPointZone(latest?.mep_bpm ?? null),
    lowBase,
    tape,
    scale,
  }
}

async function bypass(clientId: string): Promise<MetabolicData> {
  const stored = getStoredAssessments(clientId)
    .map((a) => storedToAssessment(clientId, a))
    .sort((a, b) => b.assessed_at.localeCompare(a.assessed_at)) // newest first
  const latest = stored[0] ?? null
  const latestCurve = stored.find((a) => a.points.length > 0) ?? null
  const [lowBase, measurements, bodyComp] = await Promise.all([
    getLowBasePrescription(clientId),
    getMeasurements(clientId),
    getBodyComposition(clientId),
  ])
  return assemble(
    stored.map(scalarOnly),
    latest,
    latestCurve,
    lowBase,
    buildTape(measurements.latest),
    buildScale(bodyComp.latest)
  )
}

async function real(clientId: string): Promise<MetabolicData> {
  const supabase = await createServerSupabase()
  const [{ data: rows }, lowBase, measurements, bodyComp] = await Promise.all([
    supabase
      .from("metabolic_assessments")
      .select("*")
      .eq("client_id", clientId)
      .order("assessed_at", { ascending: false }),
    getLowBasePrescription(clientId),
    getMeasurements(clientId),
    getBodyComposition(clientId),
  ])

  const list = rows ?? []
  const tape = buildTape(measurements.latest)
  const scale = buildScale(bodyComp.latest)
  if (list.length === 0) return assemble(list, null, null, lowBase, tape, scale)

  // Pull all curve points for the client, group by assessment.
  const { data: allPoints } = await supabase
    .from("metabolic_curve_points")
    .select("*")
    .eq("client_id", clientId)
  const byAssessment = new Map<string, MetabolicCurvePoint[]>()
  for (const p of allPoints ?? []) {
    const arr = byAssessment.get(p.assessment_id) ?? []
    arr.push(p)
    byAssessment.set(p.assessment_id, arr)
  }
  const withPoints = (a: MetabolicAssessment): MetabolicAssessmentWithPoints => ({
    ...a,
    points: sortPoints(byAssessment.get(a.id) ?? []),
  })

  const head = list[0]
  const latest = withPoints(head)
  // Newest assessment (list is already desc by assessed_at) that has any points.
  const curveHead = list.find((a) => (byAssessment.get(a.id)?.length ?? 0) > 0)
  const latestCurve = curveHead ? withPoints(curveHead) : null
  return assemble(list, latest, latestCurve, lowBase, tape, scale)
}

/** Full Stat Tracker (metabolic) module data for one client. */
export async function getMetabolic(clientId: string): Promise<MetabolicData> {
  return DEV_AUTH_BYPASS ? bypass(clientId) : real(clientId)
}
