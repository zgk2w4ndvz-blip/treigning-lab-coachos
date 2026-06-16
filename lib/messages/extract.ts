// ============================================================================
// Structured signal extractor — pure, deterministic, no external calls.
//
// Where classify.ts maps a message to a coarse coaching *domain*, this module
// pulls out concrete, structured signals an athlete reports in a text:
//   • morning / evening / body weight  → suggested weight-log entries
//   • supplement compliance            → typed observation
//   • hydration                        → typed observation
//   • AltoLab usage                    → typed observation
//   • Low Base completion              → typed observation
//   • recovery notes                   → typed observation
//   • injury / pain                    → typed observation (sensitive)
//   • nutrition update                 → typed observation
//
// Nothing here writes to athlete records. Each item becomes a *pending*
// suggested_action; a coach approves it (and only then does the weight-log /
// prescription get created). See lib/actions/inbox.ts.
// ============================================================================

import type { ClassifiedSuggestion } from "@/lib/messages/classify"

export type TimeOfDay = "morning" | "evening" | "general"

export interface WeightEntry {
  label: TimeOfDay
  weightLbs: number
}

// A number only counts as a body weight when the message is clearly about
// weight (avoids grabbing reps, prices, times, dates, etc.).
const WEIGHT_CONTEXT =
  /\b(weight|weighed|weigh[-\s]?in|weighing|body\s?weight|lbs?|pounds|\bkg\b|\bbw\b|scale)\b/i
const MORNING = /(morning|a\.?m\.?|wake|woke|fasted|first thing)/
const EVENING = /(evening|night|p\.?m\.?|bed|tonight|before bed)/

const round1 = (n: number) => Math.round(n * 10) / 10

/** Pull morning/evening/general body-weight readings from a message. */
export function extractWeights(text: string): WeightEntry[] {
  if (!WEIGHT_CONTEXT.test(text)) return []
  const lower = text.toLowerCase()
  const entries: WeightEntry[] = []
  const seen = new Set<string>()

  // A plausible body-weight number (50–500), optionally followed by a unit.
  const numRe = /(\d{2,3}(?:\.\d{1,2})?)\s*(lbs?|pounds|kg|kgs)?/gi
  let m: RegExpExecArray | null
  while ((m = numRe.exec(text))) {
    const val = parseFloat(m[1])
    if (val < 50 || val > 500) continue
    const before = lower.slice(Math.max(0, m.index - 22), m.index)
    const after = lower.slice(m.index + m[0].length, m.index + m[0].length + 22)
    let label: TimeOfDay = "general"
    if (MORNING.test(before) || MORNING.test(after)) label = "morning"
    else if (EVENING.test(before) || EVENING.test(after)) label = "evening"

    const key = `${label}:${val}`
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({ label, weightLbs: round1(val) })
    if (entries.length >= 6) break // sanity cap
  }
  return entries
}

function weightSuggestion(entries: WeightEntry[]): ClassifiedSuggestion {
  const parts = entries.map(
    (e) => `${e.label === "general" ? "" : e.label + " "}${e.weightLbs} lb`.trim()
  )
  return {
    domain: "body_composition",
    intent: "Body weight report",
    suggestedProtocol: `Log weight — ${parts.join(", ")}`,
    confidence: 0.85,
    sensitive: false,
    details: { action: "create_weight_log", entries },
  }
}

// ---- Lighter typed-observation detectors -----------------------------------
// These don't write a record on approval (they flow through the normal
// prescription/task path) but give the coach a precise, pre-labelled item.

interface ObservationRule {
  kind: string
  domain: ClassifiedSuggestion["domain"]
  intent: string
  protocol: string
  test: RegExp
  sensitive?: boolean
  confidence?: number
}

const OBSERVATIONS: ObservationRule[] = [
  {
    kind: "supplement_compliance",
    domain: "supplementation",
    intent: "Supplement compliance",
    protocol: "Confirm supplement compliance and adjust protocol if needed.",
    test: /\b(took|taking|missed|forgot|skipped|ran out|out of)\b.{0,30}\b(creatine|magnesium|zinc|vitamin|d3|omega|fish oil|supplement|pre[-\s]?workout|electrolyte)\b/i,
    sensitive: true,
    confidence: 0.7,
  },
  {
    kind: "hydration",
    domain: "hydration",
    intent: "Hydration report",
    protocol: "Review fluid + electrolyte intake against target.",
    test: /\b(hydrat|water intake|drank|drinking|electrolyte|sodium|cramp|dehydrat)\w*/i,
    confidence: 0.6,
  },
  {
    kind: "altolab_usage",
    domain: "altolab",
    intent: "AltoLab usage",
    protocol: "Confirm AltoLab / altitude session logged against the plan.",
    test: /\b(altolab|altitude|hypoxic|ipc|altitude tent|breathing mask)\b/i,
    confidence: 0.7,
  },
  {
    kind: "low_base_completion",
    domain: "low_base",
    intent: "Low Base completion",
    protocol: "Mark Low Base / zone-2 session complete and review volume.",
    test: /\b(low base|zone\s?2|zone two|aerobic base)\b.{0,30}\b(done|complete|completed|finished|did|logged)\b|\b(done|complete|completed|finished|did)\b.{0,30}\b(low base|zone\s?2|zone two|aerobic base)\b/i,
    confidence: 0.65,
  },
  {
    kind: "recovery",
    domain: "recovery",
    intent: "Recovery note",
    protocol: "Review recovery markers; consider rest/deload.",
    test: /\b(slept|sleep|soreness|so sore|fatigue|exhausted|tired|hrv|rest day|deload|run down|burnt out)\b/i,
    confidence: 0.6,
  },
  {
    kind: "injury",
    domain: "recovery",
    intent: "Injury / pain report",
    protocol: "Injury/pain reported — clinical review before any change.",
    test: /\b(injur\w*|pain|hurts?|tweaked|strain\w*|sprain\w*|pulled|sore knee|sore back|tendon|sharp pain|swollen|swelling)\b/i,
    sensitive: true,
    confidence: 0.75,
  },
  {
    kind: "nutrition_update",
    domain: "diet",
    intent: "Nutrition update",
    protocol: "Review nutrition update; adjust calories/macros if needed.",
    test: /\b(ate|eating|meal|meals|calorie\w*|macro\w*|protein|carb\w*|appetite|hungry|fasted|cheat meal|diet)\b/i,
    confidence: 0.55,
  },
]

/** Extract structured signals from a message body as pending suggestions. */
export function extractSignals(body: string): ClassifiedSuggestion[] {
  const text = (body ?? "").trim()
  if (!text) return []
  const out: ClassifiedSuggestion[] = []

  const weights = extractWeights(text)
  if (weights.length) out.push(weightSuggestion(weights))

  for (const rule of OBSERVATIONS) {
    if (rule.test.test(text)) {
      out.push({
        domain: rule.domain,
        intent: rule.intent,
        suggestedProtocol: rule.protocol,
        confidence: rule.confidence ?? 0.6,
        sensitive: !!rule.sensitive,
        details: { kind: rule.kind },
      })
    }
  }
  return out
}
