import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import {
  getStoredMeasurementSessions,
  type StoredMeasurementSession,
} from "@/lib/dev-measurements-store"
import { hipWaistRatio, waistHeightRatio } from "@/lib/metrics/measurements"
import type {
  BodyMeasurement,
  MeasurementMetricSummary,
  MeasurementRatioKey,
  MeasurementSiteKey,
  MeasurementsData,
} from "@/types/models"

const COACH = "00000000-0000-0000-0000-0000000000c0"

/** Display metadata for the tracked circumference sites (order = display order). */
export const MEASUREMENT_SITES: {
  key: MeasurementSiteKey
  label: string
  unit: string
}[] = [
  { key: "waist_in", label: "Waist", unit: "in" },
  { key: "hips_in", label: "Hips", unit: "in" },
  { key: "chest_in", label: "Chest", unit: "in" },
  { key: "shoulder_in", label: "Shoulder", unit: "in" },
  { key: "thigh_in", label: "Thigh", unit: "in" },
  { key: "calves_in", label: "Calves", unit: "in" },
  { key: "wrist_in", label: "Wrist", unit: "in" },
  { key: "ankle_in", label: "Ankle", unit: "in" },
  { key: "neck_in", label: "Neck", unit: "in" },
  { key: "bicep_in", label: "Bicep", unit: "in" },
]

export const MEASUREMENT_RATIOS: {
  key: MeasurementRatioKey
  label: string
  unit: string
}[] = [
  { key: "hip_waist_ratio", label: "Hip / Waist", unit: "" },
  { key: "waist_height_ratio", label: "Waist / Height", unit: "" },
]

const round2 = (n: number) => Math.round(n * 100) / 100

const isoDaysAgo = (d: number) =>
  new Date(Date.now() - d * 86_400_000).toISOString()

/** Build current/previous/change + series from a per-row numeric extractor. */
function summarizeBy(
  logs: BodyMeasurement[],
  key: string,
  label: string,
  unit: string,
  value: (m: BodyMeasurement) => number | null
): MeasurementMetricSummary {
  const series = logs
    .map((l) => ({ date: l.measured_at.slice(0, 10), value: value(l) }))
    .filter((p): p is { date: string; value: number } => p.value != null)
  const current = series.length ? series[series.length - 1].value : null
  const previous = series.length > 1 ? series[series.length - 2].value : null
  const change =
    current != null && previous != null ? round2(current - previous) : null
  return { key: key as never, label, unit, current, previous, change, series }
}

function summarizeSites(logs: BodyMeasurement[]): MeasurementMetricSummary[] {
  return MEASUREMENT_SITES.map(({ key, label, unit }) =>
    summarizeBy(logs, key, label, unit, (m) => m[key])
  )
}

function summarizeRatios(logs: BodyMeasurement[]): MeasurementMetricSummary[] {
  return [
    summarizeBy(logs, "hip_waist_ratio", "Hip / Waist", "", hipWaistRatio),
    summarizeBy(logs, "waist_height_ratio", "Waist / Height", "", waistHeightRatio),
  ]
}

function storedToRow(
  clientId: string,
  m: StoredMeasurementSession
): BodyMeasurement {
  return {
    id: m.id,
    client_id: clientId,
    logged_by: COACH,
    measured_at: m.measuredAt,
    waist_in: m.waistIn,
    hips_in: m.hipsIn,
    chest_in: m.chestIn,
    shoulder_in: m.shoulderIn,
    thigh_in: m.thighIn,
    calves_in: m.calvesIn,
    wrist_in: m.wristIn,
    ankle_in: m.ankleIn,
    neck_in: m.neckIn,
    bicep_in: m.bicepIn,
    height_in: m.heightIn,
    notes: m.notes,
    created_at: m.measuredAt,
    updated_at: m.measuredAt,
  }
}

function build(logs: BodyMeasurement[]): MeasurementsData {
  return {
    logs,
    latest: logs.length ? logs[logs.length - 1] : null,
    sites: summarizeSites(logs),
    ratios: summarizeRatios(logs),
  }
}

function bypass(clientId: string, days: number): MeasurementsData {
  const cutoff = Date.now() - days * 86_400_000
  const logs = getStoredMeasurementSessions(clientId)
    .map((m) => storedToRow(clientId, m))
    .filter((l) => new Date(l.measured_at).getTime() >= cutoff)
    .sort((a, b) => a.measured_at.localeCompare(b.measured_at))
  return build(logs)
}

async function real(clientId: string, days: number): Promise<MeasurementsData> {
  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from("body_measurements")
    .select("*")
    .eq("client_id", clientId)
    .gte("measured_at", isoDaysAgo(days))
    .order("measured_at", { ascending: true })
  return build(data ?? [])
}

/** Full measurements module data for one client. */
export async function getMeasurements(
  clientId: string,
  days = 90
): Promise<MeasurementsData> {
  return DEV_AUTH_BYPASS ? bypass(clientId, days) : real(clientId, days)
}
