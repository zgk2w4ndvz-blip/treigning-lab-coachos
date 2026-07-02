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
export type WeightContext = "body" | "competition"

export interface WeightEntry {
  label: TimeOfDay
  weightLbs: number
  /** Ordinary daily body weight vs an official competition / weigh-in number. */
  context: WeightContext
  /** Set when the value was inferred from a shorthand number (29.7 → 129.7). */
  shorthandFrom?: number
}

/** Optional athlete weight context used to disambiguate shorthand weights.
 *  All fields optional — the extractor stays pure and degrades gracefully when
 *  a caller can't supply context. */
export interface AthleteWeightContext {
  currentWeightLbs?: number | null
  goalWeightLbs?: number | null
  /** Numeric weight-class limit (parsed from e.g. "133", "133 lbs"). */
  weightClassLbs?: number | null
  /** A few recent body-weight readings, most-recent first. */
  recentWeightsLbs?: number[]
}

// A number only counts as a body weight when the message is clearly about
// weight (avoids grabbing reps, prices, times, dates, etc.).
const WEIGHT_CONTEXT =
  /\b(weight|weighed|weigh[-\s]?in|weighing|body\s?weight|lbs?|pounds|\bkg\b|\bbw\b|scale)\b/i
const MORNING = /(morning|a\.?m\.?|wake|woke|fasted|first thing)/
const EVENING = /(evening|night|p\.?m\.?|bed|tonight|before bed)/
// Competition / official weigh-in cues near a weight number.
const COMPETITION =
  /(weigh[-\s]?in|weighed in|made weight|official|competition|comp\b|meet|match|on the scale|scale at|class limit|made the cut)/

const round1 = (n: number) => Math.round(n * 10) / 10

/** Pull morning/evening/general weight readings, tagged body vs competition.
 *
 *  A message qualifies as "about weight" in two ways:
 *   1. it contains an explicit weight keyword/unit (WEIGHT_CONTEXT) — then every
 *      plausible in-range number is read as a weight (existing behavior), or
 *   2. an individual number carries its own weight signal — a unit (172 lb) or a
 *      time-of-day cue (172 for bed, 169.8 in the morning, 165 am, 168 pm).
 *
 *  Case 2 is what lets athletes log AM/PM and multiple weights without ever
 *  typing "weight" — e.g. "172 for bed. 169.8 in the morning" yields two
 *  entries — while stray numbers (reps, times, prices) in non-weight messages
 *  are still ignored because they have neither a unit nor a time cue. */
export function extractWeights(text: string): WeightEntry[] {
  const hasWeightKeyword = WEIGHT_CONTEXT.test(text)
  const lower = text.toLowerCase()
  const entries: WeightEntry[] = []
  const seen = new Set<string>()

  // A plausible body-weight number (50–500), optionally followed by a unit.
  const numRe = /(\d{2,3}(?:\.\d{1,2})?)\s*(lbs?|pounds|kg|kgs)?/gi
  let m: RegExpExecArray | null
  while ((m = numRe.exec(text))) {
    const val = parseFloat(m[1])
    if (val < 50 || val > 500) continue
    const hasUnit = !!m[2]
    const before = lower.slice(Math.max(0, m.index - 28), m.index)
    const after = lower.slice(m.index + m[0].length, m.index + m[0].length + 28)
    const win = `${before} ${after}`
    let label: TimeOfDay = "general"
    if (MORNING.test(win)) label = "morning"
    else if (EVENING.test(win)) label = "evening"
    // Without a message-level weight keyword, only accept numbers that carry
    // their own weight signal (a unit or a time-of-day cue). This keeps reps,
    // clock times, and prices in ordinary messages from being read as weights.
    if (!hasWeightKeyword && !hasUnit && label === "general") continue
    // Competition cues reliably precede the number ("official weigh-in 124",
    // "made weight at 125") — checking only the before-window avoids a later
    // clause bleeding its context onto an earlier body-weight number.
    const context: WeightContext = COMPETITION.test(before) ? "competition" : "body"

    const key = `${context}:${label}:${val}`
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({ label, weightLbs: round1(val), context })
    if (entries.length >= 6) break // sanity cap
  }
  return entries
}

function weightSuggestion(entries: WeightEntry[], context: WeightContext): ClassifiedSuggestion {
  const inferred = entries.some((e) => e.shorthandFrom != null)
  const parts = entries.map((e) => {
    const base = `${e.label === "general" ? "" : e.label + " "}${e.weightLbs} lb`.trim()
    return e.shorthandFrom != null ? `${base} (from “${e.shorthandFrom}”)` : base
  })
  const isComp = context === "competition"
  // Strip the internal shorthandFrom marker from the approval payload; the
  // weight-log writer only reads label + weightLbs.
  const cleanEntries = entries.map(({ label, weightLbs, context: c }) => ({ label, weightLbs, context: c }))
  return {
    domain: "body_composition",
    intent: isComp ? "Competition weigh-in" : inferred ? "Body weight (shorthand inferred)" : "Body weight report",
    suggestedProtocol: `Log ${isComp ? "competition weigh-in" : "weight"} — ${parts.join(", ")}`,
    // Inferred shorthand is lower-confidence so the coach double-checks before approving.
    confidence: isComp ? 0.85 : inferred ? 0.7 : 0.85,
    sensitive: false,
    details: { action: "create_weight_log", context, entries: cleanEntries, ...(inferred ? { inferred: true } : {}) },
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

// ---- Bare-number body weight (matched athletes only) -----------------------
// When a message is already matched to an athlete, a message that is essentially
// just a number in a plausible body-weight range is treated as a weight report
// (e.g. an athlete who texts "173.4"). Gated on `matched` so we never guess a
// stray number is a weight for an unknown sender.

const BARE_MIN = 70
const BARE_MAX = 400

// Money / payment / non-weight contexts that disqualify the whole message.
const MONEY =
  /[$£€]|\b(paid|pay|owe|owes|cost|costs|venmo|zelle|cash|price|priced|bucks|dollars?|tip|refund|invoice|charge|charged|spent)\b/i

// Non-numeric tokens allowed in a "bare weight" message (everything else means
// it's a sentence, not a bare weight).
const ALLOWED_BARE = new Set([
  "lb", "lbs", "pound", "pounds", "kg", "kgs", "kilo", "kilos",
  "weight", "wt", "bw", "weighed", "weigh", "in",
  "this", "today", "now", "ish", "at", "around", "about",
  "morning", "am", "a.m", "a.m.", "evening", "pm", "p.m", "p.m.", "night", "tonight",
])

/** A bare numeric body weight from an athlete message, or null. */
export function extractBareWeight(text: string): WeightEntry | null {
  const t = text.trim()
  if (!t) return null
  if (MONEY.test(t)) return null
  if (/\d\s*:\s*\d/.test(t)) return null // times like 8:30
  if (/\d\s*[/-]\s*\d/.test(t)) return null // dates / phone-ish / ranges

  const nums = t.match(/\d+(?:\.\d+)?/g) ?? []
  if (nums.length !== 1) return null // exactly one number
  const val = parseFloat(nums[0])
  if (!(val >= BARE_MIN && val <= BARE_MAX)) return null

  // Everything that isn't the number or an allowed qualifier word → not bare.
  const residue = t
    .toLowerCase()
    .replace(/\d+(?:\.\d+)?/g, " ")
    .split(/[^a-z.]+/)
    .filter(Boolean)
    .filter((w) => !ALLOWED_BARE.has(w))
  if (residue.length > 0) return null

  let label: TimeOfDay = "general"
  if (MORNING.test(t)) label = "morning"
  else if (EVENING.test(t)) label = "evening"
  return { label, weightLbs: round1(val), context: "body" }
}

// ---- Shorthand body weight (wrestlers / combat athletes) -------------------
// Athletes routinely drop the leading hundreds digit: "this morning I was 29.7"
// means 129.7 lb, not 29.7% body fat. We expand a sub-100 number to a plausible
// body weight ONLY when the message reads like a body-weight report and never
// when body fat is explicitly named. Gated on a matched athlete (like the bare
// rule) so we never invent a weight for an unknown sender. Every shorthand entry
// is tagged (`shorthandFrom`) and lands in the coach's approval queue — never an
// auto-write.

// Message-level signal that a number is a BODY WEIGHT.
const WEIGHT_INTENT =
  /\b(weight|weighed|weighing|weigh[-\s]?in|body\s?weight|\bbw\b|scale|this morning|i\s*was|i['’]?m\b|i\s*am\b|woke up|first thing|fasted|like\s+\d)\b/i
// Explicit body-fat naming — the ONLY thing that makes a number a percentage.
const BODY_FAT_EXPLICIT = /\b(body\s?fat|\bbf\b|\bpbf\b|percent(?:age)?)\b|%/i
// A unit/word right after the number that means it is NOT a bare body weight
// (times, durations, reps, ordinals, distances, an explicit weight unit, …).
const NONWEIGHT_AFTER =
  /^\s*(?:%|am|pm|a\.m|p\.m|min|mins|minute|minutes|hr|hrs|hour|hours|sec|secs|second|seconds|rep|reps|set|sets|round|rounds|mi|mile|miles|km|k|oz|cup|cups|lbs?|kgs?|pound|pounds|day|days|week|weeks|month|months|x|:|st|nd|rd|th)\b/i

const SHORT_MIN = 10
const SHORT_MAX = 99.9
const EXPANDED_MIN = 90 // lightest realistic combat-athlete body weight
const EXPANDED_MAX = 285

function referenceWeights(ctx: AthleteWeightContext): number[] {
  return [ctx.currentWeightLbs, ctx.goalWeightLbs, ctx.weightClassLbs, ...(ctx.recentWeightsLbs ?? [])]
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n))
}

/** Expand a shorthand number (e.g. 29.7) to a full body weight (129.7), using
 *  athlete context to pick the hundreds digit when available. */
function expandShorthand(raw: number, refs: number[]): number | null {
  const candidates = [raw + 100, raw + 200]
  if (refs.length) {
    let best: number | null = null
    let bestD = Infinity
    for (const c of candidates) {
      for (const r of refs) {
        const d = Math.abs(c - r)
        if (d <= 20 && d < bestD) {
          best = c
          bestD = d
        }
      }
    }
    return best
  }
  // No context: default to +100 (the common case) if it's a plausible weight.
  const c = raw + 100
  return c >= EXPANDED_MIN && c <= EXPANDED_MAX ? c : null
}

/** Shorthand body-weight readings from a message, or []. Requires a matched
 *  athlete and either an explicit weight cue or athlete context to anchor on. */
export function extractShorthandWeights(
  text: string,
  ctx: AthleteWeightContext = {},
  matched = false
): WeightEntry[] {
  if (!matched) return []
  if (BODY_FAT_EXPLICIT.test(text)) return [] // explicit body fat is never a weight
  const refs = referenceWeights(ctx)
  const hasIntent = WEIGHT_INTENT.test(text)
  if (!hasIntent && refs.length === 0) return []

  const lower = text.toLowerCase()
  const entries: WeightEntry[] = []
  const seen = new Set<string>()
  const re = /\d{1,2}(?:\.\d{1,2})?/g // 1–2 leading digits → strictly sub-100
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const raw = parseFloat(m[0])
    if (!(raw >= SHORT_MIN && raw <= SHORT_MAX)) continue
    const after = text.slice(m.index + m[0].length)
    if (NONWEIGHT_AFTER.test(after)) continue // 45 minutes, 30%, 18th, 45 lbs…
    const around = text.slice(Math.max(0, m.index - 2), m.index + m[0].length + 3)
    if (/\d\s*[:/\-]\s*\d/.test(around)) continue // times / dates / ranges
    const expanded = expandShorthand(raw, refs)
    if (expanded == null) continue

    const before = lower.slice(Math.max(0, m.index - 28), m.index)
    const win = `${before} ${lower.slice(m.index)}`
    let label: TimeOfDay = "general"
    if (MORNING.test(win)) label = "morning"
    else if (EVENING.test(win)) label = "evening"

    const key = `${label}:${expanded}`
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({ label, weightLbs: round1(expanded), context: "body", shorthandFrom: raw })
    if (entries.length >= 4) break
  }
  return entries
}

// ---- Upcoming competition / travel (calendar suggestion) -------------------
// Detects competition/tournament/weigh-in/match/travel/date language and emits
// a PENDING suggestion the coach reviews. It never creates a calendar event —
// approval routing is unchanged; this only surfaces the item for scheduling.

// Strong cues fire on their own.
const COMP_STRONG =
  /\b(competition|tournament|tourney|championships?|nationals?|regionals?|sectionals?|qualifier|weigh[-\s]?in|dual\s*meet|open\s*mat|wrestle[-\s]?offs?|invitational|scrimmage|districts?)\b/i
// Event-ish cues need a date/travel cue to fire (avoids "nice to meet you").
const COMP_EVENTISH =
  /\b(match|bout|fight|meet|compete|competing|travel|traveling|travelling|flight|flying|hotel)\b/i
const DATE_CUE =
  /\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}|(?:this|next)\s+(?:week|weekend|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:mon|tues|wednes|thurs|fri|satur|sun)day|weekend|on\s+the\s+\d{1,2}(?:st|nd|rd|th))\b/i

/** A pending "upcoming competition" suggestion, or null. Mapped to the existing
 *  `training` domain (no schema change); the competition intent lives in the
 *  label + details.kind. */
export function extractCompetitionEvent(text: string): ClassifiedSuggestion | null {
  const strong = COMP_STRONG.test(text)
  const dateMatch = DATE_CUE.exec(text)
  const eventish = COMP_EVENTISH.test(text)
  if (!strong && !(eventish && dateMatch)) return null
  const when = dateMatch ? dateMatch[0].trim() : null
  return {
    domain: "training",
    intent: "Upcoming competition",
    suggestedProtocol: `Add competition to the calendar${when ? ` — ${when}` : ""}. Review the date and details, then approve.`,
    confidence: strong ? 0.7 : 0.6,
    sensitive: false,
    details: { kind: "competition_event", when },
  }
}

// ---- Body composition update (InBody-style readings) -----------------------
// Recognizes labeled body-composition fields an athlete texts (PBF, SMM, fat
// mass, TBW, BMR). Each field needs a label followed by a number — so bare
// numbers or label-only mentions ("BMR is probably higher now") are ignored.

export interface BodyCompFields {
  body_fat_percentage?: number
  skeletal_muscle_mass_lbs?: number
  body_fat_mass_lbs?: number
  total_body_water_lbs?: number
  bmr?: number
}

const NUM = "(\\d+(?:\\.\\d+)?)"
const UNIT = "\\s*(?:%|lbs?|kcal)?" // trailing unit is consumed (then stripped)
// Order matters: more specific labels first, and matched spans are consumed so
// a shorter label (e.g. "Body Fat") can't re-read a longer one's number
// (e.g. "Body Fat Mass 19.7").
const BODY_COMP_MATCHERS: { key: keyof BodyCompFields; re: RegExp }[] = [
  { key: "body_fat_mass_lbs", re: new RegExp(`\\b(?:body\\s*fat\\s*mass|fat\\s*mass)\\b\\s*[:=]?\\s*${NUM}${UNIT}`, "i") },
  { key: "skeletal_muscle_mass_lbs", re: new RegExp(`\\b(?:smm|skeletal\\s*muscle\\s*mass)\\b\\s*[:=]?\\s*${NUM}${UNIT}`, "i") },
  { key: "total_body_water_lbs", re: new RegExp(`\\b(?:tbw|total\\s*body\\s*water)\\b\\s*[:=]?\\s*${NUM}${UNIT}`, "i") },
  { key: "bmr", re: new RegExp(`\\b(?:bmr|basal\\s*met(?:abolic)?\\s*rate|basal\\s*metabolism)\\b\\s*[:=]?\\s*${NUM}${UNIT}`, "i") },
  { key: "body_fat_percentage", re: new RegExp(`\\b(?:pbf|percent\\s*body\\s*fat|body\\s*fat\\s*percentage|body\\s*fat)\\b\\s*%?\\s*[:=]?\\s*${NUM}${UNIT}`, "i") },
]

/** Scan body-composition fields and return the residual text (matches blanked). */
function scanBodyComp(text: string): { fields: BodyCompFields; residual: string } {
  let work = text
  const fields: BodyCompFields = {}
  for (const m of BODY_COMP_MATCHERS) {
    const match = work.match(m.re)
    if (match && match.index != null) {
      fields[m.key] = parseFloat(match[1])
      // Blank the matched span (label + number + unit) so it can't be re-read
      // here or mistaken for a body weight downstream.
      work =
        work.slice(0, match.index) +
        " ".repeat(match[0].length) +
        work.slice(match.index + match[0].length)
    }
  }
  return { fields, residual: work }
}

/** Pull labeled body-composition fields from a message, or null if none. */
export function extractBodyComp(text: string): BodyCompFields | null {
  const { fields } = scanBodyComp(text)
  return Object.keys(fields).length > 0 ? fields : null
}

const BODY_COMP_LABEL: { key: keyof BodyCompFields; label: string; unit: string }[] = [
  { key: "body_fat_percentage", label: "PBF", unit: "%" },
  { key: "skeletal_muscle_mass_lbs", label: "SMM", unit: " lb" },
  { key: "body_fat_mass_lbs", label: "Body Fat Mass", unit: " lb" },
  { key: "total_body_water_lbs", label: "Total Body Water", unit: " lb" },
  { key: "bmr", label: "BMR", unit: " kcal" },
]

function bodyCompSuggestion(fields: BodyCompFields): ClassifiedSuggestion {
  const parts = BODY_COMP_LABEL.filter((f) => fields[f.key] != null).map(
    (f) => `${f.label} ${fields[f.key]}${f.unit}`
  )
  return {
    domain: "body_composition",
    intent: "Body composition update",
    suggestedProtocol: `Update body composition — ${parts.join(", ")}`,
    confidence: 0.85,
    sensitive: false,
    details: { action: "body_composition_update", ...fields },
  }
}

export interface ExtractOptions {
  /** True when the message already matched an athlete (enables bare-weight). */
  matched?: boolean
  /** Optional athlete weight context — anchors shorthand-weight inference. */
  athlete?: AthleteWeightContext
}

/** Extract structured signals from a message body as pending suggestions. */
export function extractSignals(body: string, opts: ExtractOptions = {}): ClassifiedSuggestion[] {
  const text = (body ?? "").trim()
  if (!text) return []
  const out: ClassifiedSuggestion[] = []

  // Labeled body-composition readings → a structured update suggestion. Strip
  // those spans first so their numbers (e.g. "Total body water 111.8lbs") are
  // never mistaken for a body weight by the weight extractor below.
  const { fields: compFields, residual } = scanBodyComp(text)
  const hasComp = Object.keys(compFields).length > 0
  const weightText = hasComp ? residual : text

  // Body weight and competition weigh-ins become separate suggestions.
  const weights = extractWeights(weightText)
  let bodyWeights = weights.filter((e) => e.context === "body")
  const compWeights = weights.filter((e) => e.context === "competition")

  // Matched-athlete fallback: a bare number with no weight keyword (only when
  // there's no body-composition reading in the message).
  if (opts.matched && !hasComp && bodyWeights.length === 0 && compWeights.length === 0) {
    const bare = extractBareWeight(text)
    if (bare) bodyWeights = [bare]
  }

  // Shorthand fallback: "this morning I was 29.7" → 129.7 lb. Only when nothing
  // else read a weight, no body-comp reading, and the message isn't about body
  // fat (guarded inside extractShorthandWeights).
  if (!hasComp && bodyWeights.length === 0 && compWeights.length === 0) {
    const shorthand = extractShorthandWeights(text, opts.athlete ?? {}, !!opts.matched)
    if (shorthand.length) bodyWeights = shorthand
  }

  if (bodyWeights.length) out.push(weightSuggestion(bodyWeights, "body"))
  if (compWeights.length) out.push(weightSuggestion(compWeights, "competition"))

  if (hasComp) out.push(bodyCompSuggestion(compFields))

  // Upcoming competition / travel → a pending scheduling suggestion.
  const comp = extractCompetitionEvent(text)
  if (comp) out.push(comp)

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
