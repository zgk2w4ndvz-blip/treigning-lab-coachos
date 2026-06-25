// ============================================================================
// AI Router — deterministic confidence/complexity analysis + routing decision.
//
// Decides whether a message can be handled by the (free, deterministic) regex
// extractors or should be sent to Claude. Pure: no I/O, no AI, no randomness —
// the SAME input always yields the SAME decision. The router NEVER changes what
// the extractors produce; it only chooses which extractor's output to use.
//
// Goal: keep simple/high-confidence single-domain messages on regex (cheap) and
// reserve Claude for complex, ambiguous, narrative, or mixed messages — where it
// is likely to improve extraction.
// ============================================================================

import type { ClassifiedSuggestion } from "@/lib/messages/classify"

/** Deterministic metadata about a regex extraction, used to route. */
export interface RegexAnalysis {
  suggestions: ClassifiedSuggestion[]
  /** 0..1 summary score (1.0 = clean single-domain extraction, no complexity). */
  confidence: number
  /** Distinct domains the regex extractor produced. */
  domains: string[]
  ambiguity: boolean
  narrative: boolean
  conflictingNumbers: boolean
  /** Umbrella: mixed domains, protocol/med/supplement changes, back-references. */
  requiresReasoning: boolean
}

export type RouteTarget = "regex" | "claude"

/** Why a message was routed to Claude (logged as ai_usage.reason_for_ai). */
export type RouteReason =
  | "regex_empty_with_signal"
  | "low_confidence"
  | "multi_domain"
  | "ambiguous"
  | "narrative"
  | "conflicting_numbers"
  | "requires_reasoning"

export interface RouteDecision {
  target: RouteTarget
  /** null when target === "regex". */
  reason: RouteReason | null
  confidence: number
}

/** Centralized, configurable thresholds (populated from env in config.ts). */
export interface RouterThresholds {
  /** When false, the router is bypassed and every message with a signal goes to
   *  Claude — i.e. the legacy AI-first behavior (the rollback switch). */
  enabled: boolean
  /** Regex-only requires confidence ≥ this (spec: 0.95). */
  minConfidence: number
  /** A message with at least this many words counts as narrative. */
  narrativeWords: number
}

export const DEFAULT_ROUTER_THRESHOLDS: RouterThresholds = {
  enabled: true,
  minConfidence: 0.95,
  narrativeWords: 14,
}

// ---- Deterministic signal patterns -----------------------------------------

/** "from 63 to 67.5", "170 -> 168", "63.2 → 67.52": a value transition that
 *  needs reasoning about which number to take. */
const CHANGE_PATTERN =
  /\b\d+(?:\.\d+)?\s*(?:->|–>|→|=>|to)\s*\d+(?:\.\d+)?/i

/** Hedging / uncertainty — the athlete is unsure, so let Claude judge. */
const HEDGE_WORDS = [
  "maybe", "not sure", "i think", "around ", "roughly", "approx", "ish ",
  "guess", "probably", "kinda", "sorta", "about ",
]

/** Explicit references to prior conversation / implied context. */
const BACKREF_PATTERNS = [
  /\b(?:as|like)\s+(?:we|you)\s+(?:discussed|said|talked|agreed|mentioned)\b/,
  /\bper\s+your\b/,
  /\byou\s+told\s+me\b/,
  /\blast\s+(?:week|time|message|night|session)\b/,
  /\bprevious(?:ly)?\b/,
  /\bearlier\b/,
  /\byesterday\b/,
]

/** Protocol / prescription modifications. */
const PROTOCOL_WORDS = [
  "protocol", "switch to", "change to", "instead of", "move to", "adjust",
  "increase", "decrease", "bump ", "taper", "ramp", "drop to", "cut to",
  "lower to", "raise to",
]

/** Medication / supplement changes (sensitive — always reason). */
const SUPPLEMENT_MED_WORDS = [
  "creatine", "magnesium", "supplement", "dosage", "vitamin", "medication",
  "caffeine", "pre-workout", "omega", "zinc", "electrolyte capsule",
]

/** Non-numeric domain signals that mean "there is something to extract" even
 *  when the regex extractor produced nothing (so Claude should look). */
const SIGNAL_KEYWORDS = [
  "sore", "soreness", "pain", "ache", "injur", "tweak", "strain", "cramp",
  "sick", "ill", "fatigue", "exhausted", "slept", "sleep", "stress",
  "hydrat", "supplement", "creatine", "magnesium", "protein", "calorie",
]

function countSentences(body: string): number {
  return (body.match(/[.!?](?:\s|$)/g) ?? []).length
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Deterministic confidence score for a regex extraction. 1.0 means a clean,
 * single-domain extraction with no complexity signals; each signal subtracts a
 * fixed penalty. An empty extraction (regex found nothing) scores low so a
 * message that clearly carries data still reaches Claude.
 */
function computeConfidence(
  suggestionCount: number,
  domainCount: number,
  flags: Pick<RegexAnalysis, "ambiguity" | "narrative" | "conflictingNumbers" | "requiresReasoning">
): number {
  if (suggestionCount === 0) return 0.3
  let c = 1.0
  if (domainCount > 1) c -= 0.3
  if (flags.ambiguity) c -= 0.25
  if (flags.narrative) c -= 0.2
  if (flags.conflictingNumbers) c -= 0.25
  if (flags.requiresReasoning) c -= 0.25
  return Math.max(0, Math.min(1, round2(c)))
}

/** Pure, deterministic complexity analysis of a message + its regex output. */
export function analyzeComplexity(
  body: string,
  suggestions: ClassifiedSuggestion[],
  thresholds: RouterThresholds = DEFAULT_ROUTER_THRESHOLDS
): RegexAnalysis {
  const text = body.toLowerCase()
  const domains = [...new Set(suggestions.map((s) => String(s.domain)))]
  const words = body.trim().split(/\s+/).filter(Boolean)
  const lines = body.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const sentences = countSentences(body)

  const narrative =
    sentences >= 2 || lines.length >= 2 || words.length >= thresholds.narrativeWords
  const conflictingNumbers = CHANGE_PATTERN.test(body)
  const ambiguity = HEDGE_WORDS.some((w) => text.includes(w)) || /\d\s*\?/.test(body)
  const requiresReasoning =
    domains.length > 1 ||
    BACKREF_PATTERNS.some((re) => re.test(text)) ||
    PROTOCOL_WORDS.some((w) => text.includes(w)) ||
    SUPPLEMENT_MED_WORDS.some((w) => text.includes(w))

  const confidence = computeConfidence(suggestions.length, domains.length, {
    ambiguity,
    narrative,
    conflictingNumbers,
    requiresReasoning,
  })

  return { suggestions, confidence, domains, ambiguity, narrative, conflictingNumbers, requiresReasoning }
}

/** True when the message plausibly contains something to extract — a number, a
 *  regex suggestion, or a domain keyword. Pure chit-chat has no signal, so we
 *  never spend a Claude call on it. */
function hasExtractableSignal(body: string, suggestions: ClassifiedSuggestion[]): boolean {
  if (suggestions.length > 0) return true
  if (/\d/.test(body)) return true
  const text = body.toLowerCase()
  return SIGNAL_KEYWORDS.some((k) => text.includes(k))
}

/** The first failing regex-only condition, used as ai_usage.reason_for_ai. */
function reasonFor(analysis: RegexAnalysis): RouteReason {
  if (analysis.suggestions.length === 0) return "regex_empty_with_signal"
  if (analysis.domains.length > 1) return "multi_domain"
  if (analysis.ambiguity) return "ambiguous"
  if (analysis.narrative) return "narrative"
  if (analysis.conflictingNumbers) return "conflicting_numbers"
  if (analysis.requiresReasoning) return "requires_reasoning"
  return "low_confidence"
}

/**
 * Decide where a message goes. Pure + deterministic.
 *
 * Regex-only when ALL hold: regex produced ≥1 suggestion, exactly one domain,
 * no ambiguity, no narrative structure, no conflicting numbers, no
 * reasoning-required signal, and confidence ≥ minConfidence. Otherwise Claude —
 * UNLESS the message has no extractable signal at all, in which case regex's
 * (empty) result stands and no Claude call is made.
 */
export function routeMessage(
  body: string,
  suggestions: ClassifiedSuggestion[],
  thresholds: RouterThresholds = DEFAULT_ROUTER_THRESHOLDS
): { analysis: RegexAnalysis; decision: RouteDecision } {
  const analysis = analyzeComplexity(body, suggestions, thresholds)
  const signal = hasExtractableSignal(body, suggestions)

  // No data worth extracting → keep regex's empty result, never call Claude.
  if (!signal) {
    return { analysis, decision: { target: "regex", reason: null, confidence: analysis.confidence } }
  }

  // Rollback switch: router off → legacy AI-first (every signal-bearing message).
  if (!thresholds.enabled) {
    return { analysis, decision: { target: "claude", reason: reasonFor(analysis), confidence: analysis.confidence } }
  }

  const simple =
    analysis.suggestions.length > 0 &&
    analysis.domains.length === 1 &&
    !analysis.ambiguity &&
    !analysis.narrative &&
    !analysis.conflictingNumbers &&
    !analysis.requiresReasoning &&
    analysis.confidence >= thresholds.minConfidence

  if (simple) {
    return { analysis, decision: { target: "regex", reason: null, confidence: analysis.confidence } }
  }
  return { analysis, decision: { target: "claude", reason: reasonFor(analysis), confidence: analysis.confidence } }
}
