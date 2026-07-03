// Context-aware extraction tests. Run: `npm run test:extractcontext`.
//   • Griffin-style shorthand body weight (29.7 → 129.7)
//   • "only body fat when explicitly stated"
//   • upcoming-competition detection → pending suggestion (never a calendar write)

import assert from "node:assert/strict"

import {
  extractSignals,
  extractShorthandWeights,
  extractCompetitionEvent,
  extractCalendarSuggestions,
} from "@/lib/messages/extract"
import { analyzeMessage } from "@/lib/messages/analyze"
import { buildExtractionUserPrompt } from "@/lib/ai/prompts/extraction"

type WeightDetails = {
  action: string
  context: string
  inferred?: boolean
  entries: { label: string; weightLbs: number }[]
}

const weightSug = (body: string, opts: Parameters<typeof extractSignals>[1] = {}) =>
  extractSignals(body, opts).find(
    (s) => (s.details as { action?: string } | undefined)?.action === "create_weight_log"
  )

// ── 1. Griffin: "This morning I was 29.7" → 129.7 lb (no athlete context) ─────
{
  const s = weightSug("This morning I was 29.7", { matched: true })
  assert.ok(s, "shorthand should produce a weight suggestion")
  const d = s!.details as unknown as WeightDetails
  assert.deepEqual(
    d.entries.map((e) => ({ label: e.label, weightLbs: e.weightLbs })),
    [{ label: "morning", weightLbs: 129.7 }]
  )
  assert.equal(d.inferred, true, "shorthand weight is flagged inferred")
  assert.ok(/shorthand/i.test(s!.intent ?? ""), "intent notes the inference")
  assert.ok(s!.confidence < 0.85, "inferred weight is lower-confidence")
}

// ── 2. Athlete context picks the hundreds digit (current_weight ≈ 141) ────────
{
  const s = weightSug("I was 41.2", { matched: true, athlete: { currentWeightLbs: 141 } })
  const d = s!.details as unknown as WeightDetails
  assert.equal(d.entries[0].weightLbs, 141.2)
}

// ── 3. Bare shorthand anchored on weight class (157) → 157.8 ──────────────────
{
  const s = weightSug("57.8", { matched: true, athlete: { weightClassLbs: 157 } })
  assert.ok(s, "context-anchored shorthand should fire even without a cue word")
  assert.equal((s!.details as unknown as WeightDetails).entries[0].weightLbs, 157.8)
}

// ── 4. Direct helper: shorthand list ──────────────────────────────────────────
assert.deepEqual(
  extractShorthandWeights("this morning I was 29.7", {}, true).map((e) => e.weightLbs),
  [129.7]
)

// ── 5. Explicit body fat is NEVER a weight ────────────────────────────────────
{
  const sigs = extractSignals("body fat 29.7%", { matched: true })
  const actions = sigs.map((s) => (s.details as { action?: string } | undefined)?.action)
  assert.ok(!actions.includes("create_weight_log"), "explicit body fat must not become a weight")
  assert.ok(actions.includes("body_composition_update"), "…it is a body-composition reading")
}
assert.deepEqual(extractShorthandWeights("I'm at 12% bf", {}, true), [], "bf/percent blocks shorthand")

// ── 6. Non-weight numbers are not grabbed ─────────────────────────────────────
assert.equal(weightSug("I was 45 minutes late", { matched: true }), undefined, "45 minutes ≠ weight")
assert.deepEqual(extractShorthandWeights("this morning I was 29.7", {}, false), [], "unmatched → no shorthand")

// ── 7. A full weight is not shifted ───────────────────────────────────────────
{
  const s = weightSug("155 this morning", { matched: true })
  const d = s!.details as unknown as WeightDetails
  assert.equal(d.entries[0].weightLbs, 155, "already-full weights stay put")
  assert.notEqual(d.inferred, true)
}

// ── 8. "like 30 this morning" → 130 ───────────────────────────────────────────
{
  const s = weightSug("like 30 this morning", { matched: true })
  assert.equal((s!.details as unknown as WeightDetails).entries[0].weightLbs, 130)
}

console.log("✓ shorthand weight: 8 groups passed")

// ── Competition detection ─────────────────────────────────────────────────────
{
  const s = extractCompetitionEvent("Trent and I discussed an upcoming competition")
  assert.ok(s, "'upcoming competition' should be detected")
  assert.equal(s!.domain, "training")
  assert.equal(s!.intent, "Upcoming competition")
  assert.equal((s!.details as { kind?: string }).kind, "competition_event")
}
{
  const s = extractCompetitionEvent("the match is this Saturday")
  assert.ok(s, "match + date should fire")
  assert.ok((s!.details as { when?: string | null }).when, "captures the date cue")
}
assert.equal(extractCompetitionEvent("nice to meet you"), null, "'meet' without a date must not fire")
assert.equal(extractCompetitionEvent("let's match the intensity today"), null, "'match' without a date must not fire")
assert.ok(extractCompetitionEvent("weigh-in is on 07/18"), "strong cue fires alone")

// End-to-end: competition language surfaces as a pending suggestion (extraction
// only ever returns suggestions — it never writes a calendar event).
{
  const sigs = extractSignals("We travel next weekend for the state tournament")
  const comp = sigs.find((s) => (s.details as { kind?: string } | undefined)?.kind === "competition_event")
  assert.ok(comp, "competition suggestion should be present end-to-end")
}

console.log("✓ competition detection: 6 assertions passed")

// ── Multi-suggestion extraction (#6) ──────────────────────────────────────────
// One inbound message → separate pending cards, none auto-written.
{
  const sigs = extractSignals("I'm 129.7 this morning. Traveling Friday. Wrestling July 18.", { matched: true })
  const kinds = sigs.map((s) => {
    const d = s.details as { action?: string; kind?: string } | undefined
    return d?.action ?? d?.kind
  })
  assert.ok(kinds.includes("create_weight_log"), "weight update present")
  assert.ok(kinds.includes("travel_event"), "travel note present")
  assert.ok(kinds.includes("competition_event"), "competition event present")

  const weight = sigs.find((s) => (s.details as { action?: string }).action === "create_weight_log")
  assert.equal((weight!.details as unknown as WeightDetails).entries[0].weightLbs, 129.7)

  const comp = sigs.find((s) => (s.details as { kind?: string }).kind === "competition_event")
  assert.ok(/jul/i.test((comp!.details as { when?: string }).when ?? ""), "competition date is July 18")
  const travel = sigs.find((s) => (s.details as { kind?: string }).kind === "travel_event")
  assert.ok(/fri/i.test((travel!.details as { when?: string }).when ?? ""), "travel date is Friday")
}

// Two calendar clauses → two calendar suggestions.
{
  const cal = extractCalendarSuggestions("Traveling Thursday. Tournament on 07/18.")
  assert.equal(cal.length, 2, "one travel + one competition")
}

// Travel-only (with a date) → a travel note, not a competition.
{
  const cal = extractCalendarSuggestions("Flying to Dallas next Saturday")
  assert.equal(cal.length, 1)
  assert.equal((cal[0].details as { kind?: string }).kind, "travel_event")
}

// Classifier word-boundary guard: "wrestling" must not match the recovery
// keyword "rest" (substring) and mint a spurious recovery card.
{
  const analyzed = analyzeMessage("I'm 129.7 this morning. Traveling Friday. Wrestling July 18.", { matched: true })
  assert.ok(!analyzed.some((s) => s.domain === "recovery"), "no spurious recovery from 'wrestling'")
  const kinds = analyzed.map((s) => {
    const d = s.details as { action?: string; kind?: string } | undefined
    return d?.action ?? d?.kind
  })
  assert.ok(kinds.includes("create_weight_log") && kinds.includes("travel_event") && kinds.includes("competition_event"))
}

console.log("✓ multi-suggestion: 3 groups passed")

// ── Stored reasoning (#5) ─────────────────────────────────────────────────────
{
  const s = weightSug("This morning I was 29.7", { matched: true })
  assert.ok(typeof (s!.details as { reason?: string }).reason === "string", "shorthand carries a reason")
  const comp = extractCompetitionEvent("upcoming tournament on 07/18")
  assert.ok(typeof (comp!.details as { reason?: string }).reason === "string", "competition carries a reason")
}

console.log("✓ reasoning present: passed")

// ── Conversation memory (#1): thread context changes interpretation ───────────
{
  // A bare shorthand number alone is NOT a weight (no cue, no athlete context).
  assert.equal(weightSug("29.7", { matched: true }), undefined, "bare shorthand alone → nothing")

  // Same message, but the recent thread is about weighing → read as 129.7 lb.
  const withThread = weightSug("29.7", {
    matched: true,
    recentTexts: ["what was your morning weight?"],
  })
  assert.ok(withThread, "recent weight-topic thread makes the reply a weight")
  assert.equal((withThread!.details as unknown as WeightDetails).entries[0].weightLbs, 129.7)

  // An unrelated thread must NOT create a weight.
  assert.equal(
    weightSug("29.7", { matched: true, recentTexts: ["see you at practice", "sounds good"] }),
    undefined,
    "unrelated thread → still nothing"
  )
}

// AI extraction prompt carries the recent thread as CONTEXT-ONLY.
{
  const p = buildExtractionUserPrompt("29.7", {
    direction: "incoming",
    recentTexts: ["what was your morning weight?"],
  })
  assert.ok(/Recent thread/.test(p), "prompt includes a recent-thread section")
  assert.ok(/morning weight/i.test(p), "prompt includes the prior message")
  assert.ok(/newest message/i.test(p), "prompt marks which message to extract")
}

console.log("✓ conversation memory: 2 groups passed")
