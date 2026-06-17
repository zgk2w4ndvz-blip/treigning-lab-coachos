// ============================================================================
// Coach prescription extraction — runs on OUTBOUND (coach→athlete) messages.
// Recognizes nutrition macro targets and Low Base dose prescriptions a coach
// texts, and turns them into structured suggested actions. Pure (no I/O).
//
// Nothing is applied automatically — these become PENDING suggestions the coach
// still approves. Every suggestion is tagged author_type:"coach".
// ============================================================================

import type { ClassifiedSuggestion } from "@/lib/messages/classify"

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

/** Extract coach prescription suggestions from an outbound message. */
export function extractCoachPrescriptions(body: string): ClassifiedSuggestion[] {
  const text = (body ?? "").trim()
  if (!text) return []
  const out: ClassifiedSuggestion[] = []
  const nutrition = extractNutrition(text)
  if (nutrition) out.push(nutritionSuggestion(nutrition))
  const lowBase = extractLowBase(text)
  if (lowBase) out.push(lowBaseSuggestion(lowBase))
  return out
}
