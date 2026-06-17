import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import {
  getStoredAssessments,
  type StoredAssessment,
  type StoredCurvePoint,
} from "@/lib/dev-metabolic-store"
import { getLowBasePrescription } from "@/lib/data/low-base"
import { heartRateZones } from "@/lib/metrics/metabolic"
import type {
  LowBasePrescription,
  MetabolicAssessment,
  MetabolicAssessmentWithPoints,
  MetabolicCurvePoint,
  MetabolicData,
} from "@/types/models"

const COACH = "00000000-0000-0000-0000-0000000000c0"

/** Display metadata for the four scalar metrics (order = display order). */
export const METABOLIC_METRICS: {
  key: "vo2_max" | "mep_bpm" | "aerobic_threshold_bpm" | "max_hr_bpm"
  label: string
  unit: string
}[] = [
  { key: "vo2_max", label: "VO₂ Max", unit: "ml/kg/min" },
  { key: "mep_bpm", label: "MEP", unit: "bpm" },
  { key: "aerobic_threshold_bpm", label: "Aerobic Threshold", unit: "bpm" },
  { key: "max_hr_bpm", label: "Max HR", unit: "bpm" },
]

function storedPointToRow(
  assessmentId: string,
  clientId: string,
  p: StoredCurvePoint
): MetabolicCurvePoint {
  return {
    id: p.id,
    assessment_id: assessmentId,
    client_id: clientId,
    stage: p.stage,
    intensity: p.intensity,
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
    vo2_max: a.vo2Max,
    mep_bpm: a.mepBpm,
    aerobic_threshold_bpm: a.aerobicThresholdBpm,
    max_hr_bpm: a.maxHrBpm,
    notes: a.notes,
    created_at: a.assessedAt,
    updated_at: a.assessedAt,
    points: [...a.points]
      .sort((x, y) => x.stage - y.stage)
      .map((p) => storedPointToRow(a.id, clientId, p)),
  }
}

/** Drop the curve points from an assessment for the list view (smaller payload). */
function scalarOnly(a: MetabolicAssessmentWithPoints): MetabolicAssessment {
  return {
    id: a.id,
    client_id: a.client_id,
    logged_by: a.logged_by,
    assessed_at: a.assessed_at,
    vo2_max: a.vo2_max,
    mep_bpm: a.mep_bpm,
    aerobic_threshold_bpm: a.aerobic_threshold_bpm,
    max_hr_bpm: a.max_hr_bpm,
    notes: a.notes,
    created_at: a.created_at,
    updated_at: a.updated_at,
  }
}

function build(
  assessments: MetabolicAssessment[],
  latest: MetabolicAssessmentWithPoints | null,
  lowBase: LowBasePrescription | null
): MetabolicData {
  return {
    assessments,
    latest,
    zones: heartRateZones(latest?.max_hr_bpm ?? null),
    lowBase,
  }
}

async function bypass(clientId: string): Promise<MetabolicData> {
  const stored = getStoredAssessments(clientId)
    .map((a) => storedToAssessment(clientId, a))
    .sort((a, b) => b.assessed_at.localeCompare(a.assessed_at)) // newest first
  const latest = stored[0] ?? null
  const lowBase = await getLowBasePrescription(clientId)
  // Strip points off the list view (only `latest` needs to carry them).
  const list: MetabolicAssessment[] = stored.map(scalarOnly)
  return build(list, latest, lowBase)
}

async function real(clientId: string): Promise<MetabolicData> {
  const supabase = await createServerSupabase()
  const { data: assessments } = await supabase
    .from("metabolic_assessments")
    .select("*")
    .eq("client_id", clientId)
    .order("assessed_at", { ascending: false })

  const list = assessments ?? []
  const lowBase = await getLowBasePrescription(clientId)
  if (list.length === 0) return build(list, null, lowBase)

  const head = list[0]
  const { data: points } = await supabase
    .from("metabolic_curve_points")
    .select("*")
    .eq("assessment_id", head.id)
    .order("stage", { ascending: true })

  return build(list, { ...head, points: points ?? [] }, lowBase)
}

/** Full metabolic-assessments module data for one client. */
export async function getMetabolic(clientId: string): Promise<MetabolicData> {
  return DEV_AUTH_BYPASS ? bypass(clientId) : real(clientId)
}
