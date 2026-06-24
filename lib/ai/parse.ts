// Pure: validate a raw AI extraction response and map it to ClassifiedSuggestion
// objects — the EXACT shape the deterministic extractors produce, so AI output
// flows through runIngest → pending suggested_actions → existing approval/apply
// paths unchanged. Returns null when the response is structurally invalid
// (the caller then falls back to regex). No I/O.

import { aiExtractionSchema, type AiSuggestion } from "@/lib/ai/schema"
import type { ClassifiedSuggestion } from "@/lib/messages/classify"

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/** Build the per-action `details` payload, or null if required fields missing. */
function detailsFor(
  s: AiSuggestion,
  meta: Record<string, unknown>
): Record<string, unknown> | null {
  const f = s.fields
  const put = (obj: Record<string, unknown>, k: string, v: number | null) => {
    if (v != null) obj[k] = v
  }
  switch (s.action) {
    case "create_weight_log": {
      const entries = (f.entries ?? []).filter((e) => typeof e.weightLbs === "number")
      if (entries.length === 0) return null
      return { action: "create_weight_log", context: "body", entries, ...meta }
    }
    case "body_composition_update": {
      const d: Record<string, unknown> = { action: "body_composition_update", ...meta }
      put(d, "body_fat_percentage", f.body_fat_percentage)
      put(d, "skeletal_muscle_mass_lbs", f.skeletal_muscle_mass_lbs)
      put(d, "body_fat_mass_lbs", f.body_fat_mass_lbs)
      put(d, "total_body_water_lbs", f.total_body_water_lbs)
      put(d, "bmr", f.bmr)
      put(d, "weight_lbs", f.weight_lbs)
      return Object.keys(d).length > 2 ? d : null
    }
    case "metabolic_assessment": {
      const d: Record<string, unknown> = { action: "metabolic_assessment", ...meta }
      put(d, "vo2_max", f.vo2_max)
      put(d, "mep_bpm", f.mep_bpm)
      put(d, "aerobic_threshold_bpm", f.aerobic_threshold_bpm)
      put(d, "max_hr_bpm", f.max_hr_bpm)
      return Object.keys(d).length > 2 ? d : null
    }
    case "nutrition_prescription": {
      const d: Record<string, unknown> = { action: "nutrition_prescription", ...meta }
      put(d, "calories", f.calories)
      put(d, "protein_g", f.protein_g)
      put(d, "carbs_g", f.carbs_g)
      put(d, "fat_g", f.fat_g)
      return Object.keys(d).length > 2 ? d : null
    }
    case "low_base_prescription": {
      const d: Record<string, unknown> = { action: "low_base_prescription", ...meta }
      put(d, "minutes_per_session", f.minutes_per_session)
      put(d, "frequency_per_week", f.frequency_per_week)
      return Object.keys(d).length > 2 ? d : null
    }
    case "observation":
      return { kind: "observation", ...meta }
  }
}

/**
 * Parse + map. `opts.incoming` tags coach vs athlete provenance (outbound coach
 * messages get author_type:"coach", matching the deterministic extractors).
 */
export function parseAiSuggestions(
  raw: unknown,
  opts: { incoming: boolean } = { incoming: true }
): ClassifiedSuggestion[] | null {
  const parsed = aiExtractionSchema.safeParse(raw)
  if (!parsed.success) return null

  const meta: Record<string, unknown> = { source: "ai" }
  if (!opts.incoming) meta.author_type = "coach"

  const out: ClassifiedSuggestion[] = []
  for (const s of parsed.data.suggestions) {
    const details = detailsFor(s, meta)
    if (details === null) continue // structured action with no usable fields
    out.push({
      domain: s.domain,
      intent: s.intent,
      suggestedProtocol: s.protocol,
      confidence: clamp01(s.confidence),
      sensitive: !!s.sensitive,
      details,
    })
  }
  return out
}
