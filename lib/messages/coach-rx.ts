// ============================================================================
// Coach prescription extraction — runs on OUTBOUND (coach→athlete) messages.
// Recognizes nutrition macros, Low Base doses, metabolic biometrics (VO2max,
// crossover/MEP, lactate/aerobic threshold, max HR), and InBody body-comp a
// coach texts, and turns them into structured suggested actions. Pure (no I/O).
//
// Nothing is applied automatically — these become PENDING suggestions the coach
// still approves. Every suggestion is tagged author_type:"coach".
// ============================================================================

import type { ClassifiedSuggestion } from "@/lib/messages/classify"
import { extractBodyComp, type BodyCompFields } from "@/lib/messages/extract"

const COACH_META = { author_type: "coach", source: "imessage" } as const

function findNumber(text: string, res: RegExp[], min: number, max: number): number | undefined {
  for (const re of res) {
    const m = text.match(re)
    if (m) {
      const v = parseFloat(m[1])
      if (v >= min && v <= max) return v
    }
  }
  return undefined
}

// ---- Nutrition --------------------------------------------------------------
export interface NutritionRx {
  calories?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
}

function extractNutrition(text: string): NutritionRx | null {
  const out: NutritionRx = {}
  const cal = findNumber(
    text,
    [/\b(\d{3,5})\s*(?:kcal|cals?|calories)\b/i, /\b(?:calories|cals|kcal|macros)\b\s*(?:to|:|=|at|of)?\s*(\d{3,5})\b/i],
    800,
    8000
  )
  if (cal != null) out.calories = cal
  const protein = findNumber(
    text,
    [/\b(\d{1,4})\s*(?:g\s*)?(?:protein(?:\s*grams)?)\b/i, /\bprotein(?:\s*grams)?\b\s*[:=]?\s*(\d{1,4})\b/i],
    1,
    2000
  )
  if (protein != null) out.protein_g = protein
  const carbs = findNumber(
    text,
    [/\b(\d{1,4})\s*(?:g\s*)?(?:carbs?|carbohydrates?)\b/i, /\bcarb(?:s|ohydrates?)?\b\s*[:=]?\s*(\d{1,4})\b/i],
    1,
    2000
  )
  if (carbs != null) out.carbs_g = carbs
  const fat = findNumber(
    text,
    [/\b(\d{1,4})\s*(?:g\s*)?(?:fats?)\b/i, /\bfats?\b\s*[:=]?\s*(\d{1,4})\b/i],
    1,
    2000
  )
  if (fat != null) out.fat_g = fat
  return Object.keys(out).length > 0 ? out : null
}

function nutritionSuggestion(rx: NutritionRx): ClassifiedSuggestion {
  const parts = [
    rx.calories != null ? `${rx.calories} kcal` : null,
    rx.protein_g != null ? `${rx.protein_g}g protein` : null,
    rx.carbs_g != null ? `${rx.carbs_g}g carbs` : null,
    rx.fat_g != null ? `${rx.fat_g}g fat` : null,
  ].filter(Boolean)
  return {
    domain: "diet",
    intent: "Nutrition prescription",
    suggestedProtocol: `Set nutrition — ${parts.join(", ")}`,
    confidence: 0.8,
    sensitive: false,
    details: { action: "nutrition_prescription", ...COACH_META, ...rx },
  }
}

// ---- Low Base ---------------------------------------------------------------
export interface LowBaseRx {
  minutes_per_session?: number
  frequency_per_week?: number
}

const LOW_BASE = /\blow\s*base\b/i

function extractLowBase(text: string): LowBaseRx | null {
  if (!LOW_BASE.test(text)) return null
  const out: LowBaseRx = {}
  const mins = findNumber(text, [/\b(\d{1,3})\s*(?:min|mins|minutes)\b/i], 1, 300)
  if (mins != null) out.minutes_per_session = mins
  // 3x/week · 3 x week · 3 times per week · 3 times a week · 3 sessions per week
  const freq = findNumber(
    text,
    [/\b(\d{1,2})\s*(?:x|times?|sessions?)\b\s*(?:per\s+|a\s+|\/\s*)?(?:wk|week)\b/i],
    1,
    14
  )
  if (freq != null) out.frequency_per_week = freq
  return Object.keys(out).length > 0 ? out : null
}

function lowBaseSuggestion(rx: LowBaseRx): ClassifiedSuggestion {
  const parts = [
    rx.minutes_per_session != null ? `${rx.minutes_per_session} min/session` : null,
    rx.frequency_per_week != null ? `${rx.frequency_per_week}×/week` : null,
  ].filter(Boolean)
  return {
    domain: "low_base",
    intent: "Low Base prescription",
    suggestedProtocol: `Set Low Base — ${parts.join(", ")}`,
    confidence: 0.8,
    sensitive: false,
    details: { action: "low_base_prescription", ...COACH_META, ...rx },
  }
}

// ---- Metabolic biometrics ---------------------------------------------------
// VO2max, crossover point (≈ MEP), lactate/aerobic threshold, max HR. Each needs
// its own keyword, so stray numbers in ordinary messages are never captured.
export interface MetabolicRx {
  vo2_max?: number
  /** Crossover / fat-max point. */
  mep_bpm?: number
  /** Lactate / aerobic threshold heart rate. */
  aerobic_threshold_bpm?: number
  max_hr_bpm?: number
}

function extractMetabolic(text: string): MetabolicRx | null {
  const out: MetabolicRx = {}

  // "Vo2 max went from 63.22 to 67.52" → take the NEW value (after "to").
  const vo2FromTo = text.match(/\bvo2\s*max\b[^0-9]*\d{1,3}(?:\.\d+)?\s*to\s*(\d{1,3}(?:\.\d+)?)/i)
  const vo2One = text.match(/\bvo2\s*max\b\D*(\d{1,3}(?:\.\d+)?)/i)
  const vo2 = vo2FromTo ? parseFloat(vo2FromTo[1]) : vo2One ? parseFloat(vo2One[1]) : undefined
  if (vo2 != null && vo2 >= 10 && vo2 <= 100) out.vo2_max = vo2

  const cross = text.match(/\bcross\s*over\s*point\b\D*(\d{2,3})/i)
  if (cross) { const v = +cross[1]; if (v >= 60 && v <= 230) out.mep_bpm = v }

  const thr = text.match(/\b(?:lactate|aerobic|anaerobic)\s*threshold\b\D*(\d{2,3})/i)
  if (thr) { const v = +thr[1]; if (v >= 60 && v <= 230) out.aerobic_threshold_bpm = v }

  const maxhr = text.match(/\bmax\s*(?:hr|heart\s*rate)\b\D*(\d{2,3})/i)
  if (maxhr) { const v = +maxhr[1]; if (v >= 120 && v <= 230) out.max_hr_bpm = v }

  return Object.keys(out).length > 0 ? out : null
}

function metabolicSuggestion(rx: MetabolicRx): ClassifiedSuggestion {
  const parts = [
    rx.vo2_max != null ? `VO₂max ${rx.vo2_max}` : null,
    rx.mep_bpm != null ? `Crossover ${rx.mep_bpm} bpm` : null,
    rx.aerobic_threshold_bpm != null ? `Threshold ${rx.aerobic_threshold_bpm} bpm` : null,
    rx.max_hr_bpm != null ? `Max HR ${rx.max_hr_bpm} bpm` : null,
  ].filter(Boolean)
  return {
    domain: "labs",
    intent: "Metabolic assessment",
    suggestedProtocol: `Log metabolic assessment — ${parts.join(", ")}`,
    confidence: 0.75,
    sensitive: false,
    details: { action: "metabolic_assessment", ...COACH_META, ...rx },
  }
}

// ---- Body composition (InBody) — reuse the inbound extractor ----------------
const BODY_COMP_LABEL: { key: keyof BodyCompFields; label: string; unit: string }[] = [
  { key: "body_fat_percentage", label: "PBF", unit: "%" },
  { key: "skeletal_muscle_mass_lbs", label: "SMM", unit: " lb" },
  { key: "body_fat_mass_lbs", label: "Body Fat Mass", unit: " lb" },
  { key: "total_body_water_lbs", label: "Total Body Water", unit: " lb" },
  { key: "bmr", label: "BMR", unit: " kcal" },
]

function coachBodyCompSuggestion(fields: BodyCompFields): ClassifiedSuggestion {
  const parts = BODY_COMP_LABEL.filter((f) => fields[f.key] != null).map(
    (f) => `${f.label} ${fields[f.key]}${f.unit}`
  )
  return {
    domain: "body_composition",
    intent: "Body composition update",
    suggestedProtocol: `Update body composition — ${parts.join(", ")}`,
    confidence: 0.8,
    sensitive: false,
    details: { action: "body_composition_update", ...COACH_META, ...fields },
  }
}

/** Extract coach prescription suggestions from an outbound message. */
export function extractCoachPrescriptions(body: string): ClassifiedSuggestion[] {
  const text = (body ?? "").trim()
  if (!text) return []
  const out: ClassifiedSuggestion[] = []
  const nutrition = extractNutrition(text)
  if (nutrition) out.push(nutritionSuggestion(nutrition))
  const lowBase = extractLowBase(text)
  if (lowBase) out.push(lowBaseSuggestion(lowBase))
  const metabolic = extractMetabolic(text)
  if (metabolic) out.push(metabolicSuggestion(metabolic))
  const bodyComp = extractBodyComp(text)
  if (bodyComp) out.push(coachBodyCompSuggestion(bodyComp))
  return out
}
