// AI Router unit tests — PURE (no DB, no AI). Run: `npm run test:router`.
// Covers the deterministic complexity engine, the routing decision, and the
// message hash. Integration cases run the REAL regex extractor through the
// router so the assertions reflect production behavior.

import assert from "node:assert/strict"

import { analyzeMessage } from "@/lib/messages/analyze"
import {
  analyzeComplexity,
  routeMessage,
  DEFAULT_ROUTER_THRESHOLDS,
  type RouterThresholds,
} from "@/lib/ai/router"
import { messageHash } from "@/lib/ai/hash"
import type { ClassifiedSuggestion } from "@/lib/messages/classify"

// ---- helpers ---------------------------------------------------------------
function sugg(domain: string, confidence = 0.9): ClassifiedSuggestion {
  return {
    domain: domain as ClassifiedSuggestion["domain"],
    intent: "x",
    suggestedProtocol: "y",
    confidence,
    sensitive: false,
  }
}
const route = (body: string, t?: RouterThresholds) =>
  routeMessage(body, analyzeMessage(body, { matched: true }), t).decision.target

// ---- simple messages stay on regex (spec examples) -------------------------
assert.equal(route("171.6"), "regex", "bare weight → regex")
assert.equal(route("170 this morning"), "regex", "weight + time → regex")
assert.equal(route("3L water"), "regex", "hydration → regex")
assert.equal(route("172 for bed. 169.8 in the morning"), "regex", "multi-weight, single domain → regex")

// ---- complex messages route to Claude --------------------------------------
assert.equal(
  route("170 this morning after eating late.\n\nSlept terrible.\n\nLeft knee still sore after practice."),
  "claude",
  "multi-domain narrative → claude"
)
assert.equal(route("bumped creatine to 10g and added magnesium at night"), "claude", "supplement change → claude")
assert.equal(route("vo2 max went from 63 to 67.5"), "claude", "value transition → claude")
assert.equal(route("weight 170 and drank 3L water"), "claude", "weight + hydration (2 domains) → claude")

// ---- chit-chat with no extractable signal stays on regex (no Claude) -------
assert.equal(route("thanks coach!"), "regex", "no signal → regex, never Claude")
assert.equal(route("see you tomorrow"), "regex", "no signal → regex")

// ---- complexity flags are deterministic ------------------------------------
const narrative = analyzeComplexity(
  "I weighed 170 this morning and honestly I felt pretty rough and tired all day long",
  [sugg("body_composition")]
)
assert.equal(narrative.narrative, true, "long sentence (16 words) → narrative")
// a two-sentence message is narrative regardless of length
assert.equal(analyzeComplexity("Weighed 170. Felt good.", [sugg("body_composition")]).narrative, true)

const change = analyzeComplexity("threshold moved from 178 to 182", [sugg("labs")])
assert.equal(change.conflictingNumbers, true, "from X to Y → conflictingNumbers")

const hedge = analyzeComplexity("around 170 i think", [sugg("body_composition")])
assert.equal(hedge.ambiguity, true, "hedge words → ambiguity")

const mixed = analyzeComplexity("170 and 3L", [sugg("body_composition"), sugg("hydration")])
assert.equal(mixed.requiresReasoning, true, "multi-domain → requiresReasoning")
assert.ok(mixed.confidence < DEFAULT_ROUTER_THRESHOLDS.minConfidence, "multi-domain confidence below gate")

// ---- confidence gate: a clean single-domain extraction scores 1.0 ----------
const clean = analyzeComplexity("170", [sugg("body_composition")])
assert.equal(clean.confidence, 1, "clean single-domain → 1.0")
assert.ok(clean.confidence >= DEFAULT_ROUTER_THRESHOLDS.minConfidence)

// regex that found nothing but the message has a number → low confidence → claude
const emptyWithNumber = routeMessage("99999 abcdef", [])
assert.equal(emptyWithNumber.decision.target, "claude")
assert.equal(emptyWithNumber.decision.reason, "regex_empty_with_signal")

// ---- rollback switch: disabled router → legacy AI-first --------------------
const off: RouterThresholds = { ...DEFAULT_ROUTER_THRESHOLDS, enabled: false }
assert.equal(route("171.6", off), "claude", "router off → simple message also goes to Claude")
assert.equal(route("thanks coach!", off), "regex", "router off still skips no-signal messages")

// ---- threshold is honored --------------------------------------------------
const strict: RouterThresholds = { ...DEFAULT_ROUTER_THRESHOLDS, minConfidence: 1.01 }
assert.equal(route("171.6", strict), "claude", "unreachable threshold → everything to Claude")

// ---- message hash is deterministic + sensitive to each field ---------------
const base = { clientId: "c1", timestamp: "2026-06-25T10:00:00Z", body: "170" }
assert.equal(messageHash(base), messageHash({ ...base }), "same input → same hash")
assert.notEqual(messageHash(base), messageHash({ ...base, body: "171" }), "body change → different hash")
assert.notEqual(messageHash(base), messageHash({ ...base, clientId: "c2" }), "client change → different hash")
assert.notEqual(messageHash(base), messageHash({ ...base, timestamp: "2026-06-25T10:00:01Z" }), "timestamp change → different hash")
assert.match(messageHash(base), /^[0-9a-f]{64}$/, "sha256 hex")

console.log("✓ ai-router suite: complexity + routing(simple/complex/no-signal/disabled/threshold) + hash passed")
