import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { getBypassClientById } from "@/lib/dev-roster-store"
import {
  getStoredBiomarkers,
  type StoredBiomarker,
} from "@/lib/dev-biomarker-store"
import { getMockClient } from "@/lib/mock/athletes"
import { mockBiomarkers } from "@/lib/mock/series"
import type {
  BiomarkerCategoryGroup,
  BiomarkerReading,
  BiomarkerSummary,
  BiomarkersData,
} from "@/types/models"

const COACH = "00000000-0000-0000-0000-0000000000c0"

const CATEGORY_LABELS: Record<string, string> = {
  recovery: "Recovery",
  performance: "Performance",
  blood: "Blood work",
  other: "Other",
}
const CATEGORY_ORDER = ["recovery", "performance", "blood", "other"]

function storedToReading(clientId: string, b: StoredBiomarker): BiomarkerReading {
  return {
    id: b.id,
    client_id: clientId,
    logged_by: COACH,
    marker: b.marker,
    label: b.label,
    value_num: b.valueNum,
    value_text: b.valueText,
    unit: b.unit,
    category: b.category,
    measured_at: b.measuredAt,
    source: "manual",
    notes: null,
    created_at: b.measuredAt,
  }
}

/** Group readings by marker → summary, then bucket summaries by category. */
function summarize(readings: BiomarkerReading[]): BiomarkerCategoryGroup[] {
  const byMarker = new Map<string, BiomarkerReading[]>()
  for (const r of readings) {
    const list = byMarker.get(r.marker) ?? []
    list.push(r)
    byMarker.set(r.marker, list)
  }

  const summaries: BiomarkerSummary[] = []
  for (const [marker, list] of byMarker) {
    const sorted = [...list].sort((a, b) => a.measured_at.localeCompare(b.measured_at))
    const numeric = sorted.filter((r) => r.value_num != null)
    const last = sorted[sorted.length - 1]
    const latest = numeric.length ? numeric[numeric.length - 1].value_num : null
    const previous = numeric.length > 1 ? numeric[numeric.length - 2].value_num : null
    summaries.push({
      marker,
      label: last.label ?? marker,
      unit: last.unit,
      category: last.category ?? "other",
      latest,
      latestText: latest == null ? last.value_text : null,
      previous,
      change:
        latest != null && previous != null
          ? Math.round((latest - previous) * 100) / 100
          : null,
      measuredAt: last.measured_at,
      series: numeric.map((r) => ({
        date: r.measured_at.slice(0, 10),
        value: r.value_num as number,
      })),
    })
  }

  const groups = new Map<string, BiomarkerSummary[]>()
  for (const s of summaries) {
    const list = groups.get(s.category) ?? []
    list.push(s)
    groups.set(s.category, list)
  }

  return [...groups.entries()]
    .map(([category, markers]) => ({
      category,
      label: CATEGORY_LABELS[category] ?? category,
      markers: markers.sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a.category)
      const ib = CATEGORY_ORDER.indexOf(b.category)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
}

function bypass(clientId: string): BiomarkersData | null {
  const client = getBypassClientById(clientId) ?? getMockClient(clientId)
  if (!client) return null
  const stored = getStoredBiomarkers(clientId).map((b) => storedToReading(clientId, b))
  const readings = [...mockBiomarkers(clientId), ...stored]
  return { client, groups: summarize(readings), totalReadings: readings.length }
}

async function real(clientId: string): Promise<BiomarkersData | null> {
  const supabase = await createServerSupabase()
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle()
  if (!client) return null
  const { data: readings } = await supabase
    .from("biomarker_readings")
    .select("*")
    .eq("client_id", clientId)
    .order("measured_at", { ascending: true })
  return {
    client,
    groups: summarize(readings ?? []),
    totalReadings: (readings ?? []).length,
  }
}

/** Per-client biomarker readings grouped by category, with per-marker trends. */
export async function getBiomarkers(clientId: string): Promise<BiomarkersData | null> {
  return DEV_AUTH_BYPASS ? bypass(clientId) : real(clientId)
}
