// AI extraction unit tests — PURE pieces only (no live API calls).
// Run: `npm run test:ai`.

import assert from "node:assert/strict"

import { estimateCostUsd, withinDailyCap, modelPrice } from "@/lib/ai/pricing"
import { parseAiSuggestions } from "@/lib/ai/parse"
import { aiExtractionSchema, AI_EXTRACTION_JSON_SCHEMA } from "@/lib/ai/schema"
import { buildExtractionUserPrompt, EXTRACTION_SYSTEM } from "@/lib/ai/prompts/extraction"

type D = Record<string, unknown>

// ---- pricing ----------------------------------------------------------------
assert.equal(estimateCostUsd("claude-haiku-4-5", 1_000_000, 0), 1)
assert.equal(estimateCostUsd("claude-haiku-4-5", 0, 1_000_000), 5)
assert.equal(estimateCostUsd("claude-opus-4-8", 1_000_000, 1_000_000), 30)
assert.equal(estimateCostUsd("claude-haiku-4-5", 0, 0), 0)
// unknown model → default (non-zero) price, never free
assert.ok(estimateCostUsd("some-future-model", 1_000_000, 0) > 0)
assert.ok(modelPrice("totally-unknown").inputPerM > 0)

// ---- daily cap --------------------------------------------------------------
assert.equal(withinDailyCap(0, 0.001, 2), true)
assert.equal(withinDailyCap(1.999, 0.001, 2), true)
assert.equal(withinDailyCap(2.0, 0.001, 2), false) // already at cap
assert.equal(withinDailyCap(0, 0.001, 0), false) // cap 0 disables spend

// ---- parse: a full multi-signal extraction (the Wiley-style message) -------
const raw = {
  suggestions: [
    {
      domain: "labs", intent: "Metabolic assessment",
      protocol: "Log VO2max 67.52 and threshold 178", confidence: 0.9, sensitive: false,
      action: "metabolic_assessment",
      fields: emptyFields({ vo2_max: 67.52, aerobic_threshold_bpm: 178 }),
    },
    {
      domain: "low_base", intent: "Low Base prescription",
      protocol: "Set Low Base 30 min 3x/week", confidence: 0.85, sensitive: false,
      action: "low_base_prescription",
      fields: emptyFields({ minutes_per_session: 30, frequency_per_week: 3 }),
    },
    {
      domain: "recovery", intent: "Injury report",
      protocol: "Athlete reports knee pain", confidence: 0.8, sensitive: true,
      action: "observation", fields: emptyFields({}),
    },
  ],
}
const parsed = parseAiSuggestions(raw, { incoming: false })!
assert.equal(parsed.length, 3)
const metab = parsed.find((s) => (s.details as D).action === "metabolic_assessment")!
assert.equal((metab.details as D).vo2_max, 67.52)
assert.equal((metab.details as D).aerobic_threshold_bpm, 178)
assert.equal((metab.details as D).source, "ai")
assert.equal((metab.details as D).author_type, "coach") // outbound → coach
const inj = parsed.find((s) => (s.details as D).kind === "observation")!
assert.equal(inj.sensitive, true)

// ---- parse: drops a structured action with no usable fields ----------------
const empty = parseAiSuggestions(
  { suggestions: [{ domain: "diet", intent: "x", protocol: "y", confidence: 0.5, sensitive: false, action: "nutrition_prescription", fields: emptyFields({}) }] },
  { incoming: true }
)!
assert.equal(empty.length, 0, "nutrition with no macros is dropped")

// ---- parse: clamps confidence + inbound omits author_type ------------------
const clamped = parseAiSuggestions(
  { suggestions: [{ domain: "body_composition", intent: "i", protocol: "p", confidence: 5, sensitive: false, action: "body_composition_update", fields: emptyFields({ body_fat_percentage: 11.4 }) }] },
  { incoming: true }
)!
assert.equal(clamped[0].confidence, 1)
assert.equal((clamped[0].details as D).author_type, undefined, "inbound → no coach tag")

// ---- parse: invalid response → null (caller falls back to regex) -----------
assert.equal(parseAiSuggestions({ nope: true }), null)
assert.equal(parseAiSuggestions("not json"), null)
assert.equal(parseAiSuggestions({ suggestions: [{ domain: "not_a_domain" }] }), null)

// ---- schema sanity ----------------------------------------------------------
assert.equal(aiExtractionSchema.safeParse({ suggestions: [] }).success, true)
assert.equal((AI_EXTRACTION_JSON_SCHEMA as D).type, "object")

// ---- prompt builder ---------------------------------------------------------
const p = buildExtractionUserPrompt("172 this morning", { direction: "incoming", athleteFirstName: "Julian" })
assert.ok(p.includes("INBOUND"))
assert.ok(p.includes("Julian"))
assert.ok(p.includes("172 this morning"))
assert.ok(EXTRACTION_SYSTEM.includes("NEVER invent values"))

console.log("✓ ai suite: pricing + cap + parse(map/drop/clamp/invalid) + schema + prompt assertions passed")

/** All numeric fields null, with overrides applied. */
function emptyFields(over: Record<string, unknown>): Record<string, unknown> {
  const base: Record<string, unknown> = {
    entries: null, weight_lbs: null, body_fat_percentage: null, skeletal_muscle_mass_lbs: null,
    body_fat_mass_lbs: null, total_body_water_lbs: null, bmr: null, vo2_max: null, mep_bpm: null,
    aerobic_threshold_bpm: null, max_hr_bpm: null, calories: null, protein_g: null, carbs_g: null,
    fat_g: null, minutes_per_session: null, frequency_per_week: null,
  }
  return { ...base, ...over }
}
