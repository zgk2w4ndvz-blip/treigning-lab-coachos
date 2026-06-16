// ============================================================================
// Rule-based message classifier — pure, deterministic, no external calls.
// Maps an athlete message to zero-or-more suggested actions across the coaching
// domains. Suggestions are NEVER auto-applied; a coach approves them.
// ============================================================================

import type { SuggestionDomain } from "@/types/database"

export interface ClassifiedSuggestion {
  domain: SuggestionDomain
  intent: string
  suggestedProtocol: string
  confidence: number
  sensitive: boolean
  /**
   * Structured payload for suggestions that map to a concrete record on
   * approval (e.g. { action: "create_weight_log", entries: [...] }). Plain
   * domain suggestions leave this undefined and approve into a prescription.
   */
  details?: Record<string, unknown>
}

interface DomainRule {
  domain: SuggestionDomain
  keywords: string[]
  intent: string
  protocol: string
  /** Always treat this domain as sensitive (medical/supplement). */
  alwaysSensitive?: boolean
}

const RULES: DomainRule[] = [
  {
    domain: "diet",
    keywords: ["meal", "diet", "calorie", "calories", "macro", "protein", "carb", "carbs", "food", "eating", "appetite", "cutting", "bulk", "weight loss"],
    intent: "Nutrition question / diet adjustment",
    protocol: "Review nutrition plan and propose calorie/macro adjustment.",
  },
  {
    domain: "supplementation",
    keywords: ["supplement", "creatine", "protein powder", "vitamin", "magnesium", "zinc", "omega", "fish oil", "pre-workout", "caffeine", "dose", "dosage", "mg"],
    intent: "Supplement question / change",
    protocol: "Propose supplement protocol change — verify dosing and interactions.",
    alwaysSensitive: true,
  },
  {
    domain: "altolab",
    keywords: ["altolab", "altitude", "hypoxic", "altitude tent", "ipc", "intermittent hypoxic", "mask"],
    intent: "AltoLab / altitude protocol",
    protocol: "Review AltoLab altitude exposure schedule.",
  },
  {
    domain: "low_base",
    keywords: ["low base", "base phase", "aerobic base", "zone 2", "zone two", "low intensity", "easy miles", "base building"],
    intent: "Low-base / aerobic base training",
    protocol: "Adjust low-base aerobic volume / zone-2 prescription.",
  },
  {
    domain: "hydration",
    keywords: ["hydration", "hydrate", "water", "electrolyte", "electrolytes", "dehydrated", "sodium", "fluids", "cramping"],
    intent: "Hydration question / adjustment",
    protocol: "Review hydration + electrolyte targets.",
  },
  {
    domain: "recovery",
    keywords: ["recovery", "sleep", "soreness", "sore", "rest", "fatigue", "tired", "hrv", "stress", "overtrained", "deload"],
    intent: "Recovery / fatigue concern",
    protocol: "Review recovery markers; consider rest/deload.",
  },
  {
    domain: "labs",
    keywords: ["blood work", "bloodwork", "labs", "ferritin", "vitamin d", "testosterone", "panel", "biomarker", "htma", "cortisol", "thyroid", "tsh"],
    intent: "Lab / biomarker discussion",
    protocol: "Review lab panel; flag out-of-range markers (clinical review).",
    alwaysSensitive: true,
  },
  {
    domain: "training",
    keywords: ["training", "workout", "session", "lift", "lifting", "run", "running", "wod", "rpe", "program", "sets", "reps", "pr", "technique"],
    intent: "Training question / program tweak",
    protocol: "Review training block; adjust session/load.",
  },
]

// Medical-sensitivity terms make any suggestion require manual review.
const MEDICAL_KEYWORDS = [
  "injury", "injured", "pain", "doctor", "physician", "medication", "meds",
  "prescription", "symptom", "symptoms", "sick", "illness", "blood", "dizzy",
  "chest", "concussion", "menstrual", "period", "pregnan", "heart", "fainted",
]

const hasKeyword = (text: string, kw: string) => text.includes(kw)

/** Classify a message body into 0..n suggested actions. */
export function classifyMessage(body: string): ClassifiedSuggestion[] {
  const text = (body ?? "").toLowerCase()
  if (!text.trim()) return []
  const medicalHit = MEDICAL_KEYWORDS.some((kw) => text.includes(kw))

  const out: ClassifiedSuggestion[] = []
  for (const rule of RULES) {
    const matches = rule.keywords.filter((kw) => hasKeyword(text, kw)).length
    if (matches === 0) continue
    out.push({
      domain: rule.domain,
      intent: rule.intent,
      suggestedProtocol: rule.protocol,
      confidence: Math.min(0.9, Math.round((0.4 + 0.12 * matches) * 1000) / 1000),
      sensitive: !!rule.alwaysSensitive || medicalHit,
    })
  }
  // Highest-confidence first.
  return out.sort((a, b) => b.confidence - a.confidence)
}
