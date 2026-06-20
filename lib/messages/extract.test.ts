// Examples / assertions for the structured extractor's bare-number weight rule.
// Run: `npm run test:extract` (tsx). No test framework needed.

import assert from "node:assert/strict"

import { extractSignals, extractBodyComp } from "@/lib/messages/extract"

type WeightDetails = {
  action: string
  context: string
  entries: { label: string; weightLbs: number }[]
}

function weightSuggestion(body: string, matched: boolean) {
  return extractSignals(body, { matched }).find((s) => s.domain === "body_composition")
}

// [body, matched, expectWeight]
const cases: [string, boolean, boolean][] = [
  ["173.4", true, true],
  ["173", true, true],
  ["173.4 lbs", true, true],
  ["173.4 this morning", true, true],
  ["weight 173.4", true, true],
  ["8:30", true, false], // a time, not a weight
  ["$173.40", true, false], // money
  ["paid 173", true, false], // payment
  ["173.4", false, false], // unmatched sender → bare rule does not apply
  ["see you at 8:30, paid 250", true, false], // sentence with stray numbers
  ["2026", true, false], // out of range (year)
  ["305 1234", true, false], // two numbers / phone-ish
  // --- multi-weight / time-of-day without a "weight" keyword (regression) ---
  ["172 for bed. 169.8 in the morning", true, true], // the Julian Ramirez case
  ["165 last night, 171 this morning", true, true], // last night + this morning
  ["168 am 170 pm", true, true], // AM/PM references
  ["169.8 in the morning", true, true], // single time-tagged, no keyword
  // guards: time word present but numbers are clearly not weights
  ["leaving in the morning, running 5 min late", true, false], // no in-range number near a cue
  ["t-bar rows 3x10 at 135, 140 this set", true, false], // reps/loads, not a body weight cue
]

let passed = 0
for (const [body, matched, expectWeight] of cases) {
  const got = !!weightSuggestion(body, matched)
  assert.equal(
    got,
    expectWeight,
    `"${body}" (matched=${matched}) → expected weight=${expectWeight}, got ${got}`
  )
  passed++
}

// time-of-day classification
const morning = weightSuggestion("173.4 this morning", true)
assert.equal((morning!.details as unknown as WeightDetails).entries[0].label, "morning")

const evening = weightSuggestion("181 tonight", true)
assert.equal((evening!.details as unknown as WeightDetails).entries[0].label, "evening")

const generic = weightSuggestion("173.4", true)
assert.equal((generic!.details as unknown as WeightDetails).entries[0].label, "general")

// Multiple time-tagged weights in one message, no "weight" keyword (the exact
// production message that produced 0 suggestions before this fix).
const multi = weightSuggestion("172 for bed. 169.8 in the morning", true)
const multiEntries = (multi!.details as unknown as WeightDetails).entries
assert.equal(multiEntries.length, 2, "expected two weight entries")
assert.deepEqual(
  multiEntries.map((e) => ({ label: e.label, weightLbs: e.weightLbs })),
  [
    { label: "evening", weightLbs: 172 },
    { label: "morning", weightLbs: 169.8 },
  ]
)

console.log(`✓ extract bare-weight: ${passed} cases + multi-weight + 3 time-of-day assertions passed`)

// ---- Body composition extraction -----------------------------------------
assert.deepEqual(
  extractBodyComp("PBF 11.4%\nSMM 88.4\nBody fat mass 19.7\nTotal body water 111.8lbs\nBasal met rate 1864kcal"),
  {
    body_fat_mass_lbs: 19.7,
    skeletal_muscle_mass_lbs: 88.4,
    total_body_water_lbs: 111.8,
    bmr: 1864,
    body_fat_percentage: 11.4,
  }
)
assert.deepEqual(
  extractBodyComp("Body Fat %: 10.8\nSkeletal Muscle Mass: 89.2\nTBW: 112.4\nBMR: 1901"),
  {
    skeletal_muscle_mass_lbs: 89.2,
    total_body_water_lbs: 112.4,
    bmr: 1901,
    body_fat_percentage: 10.8,
  }
)
assert.deepEqual(extractBodyComp("PBF 12.1\nSMM 87.5\nFat Mass 20.4"), {
  body_fat_mass_lbs: 20.4,
  skeletal_muscle_mass_lbs: 87.5,
  body_fat_percentage: 12.1,
})

// Should ignore (no labeled number)
assert.equal(extractBodyComp("I feel 11.4 out of 10 today"), null)
assert.equal(extractBodyComp("SMM wrestling tournament"), null)
assert.equal(extractBodyComp("BMR is probably higher now"), null)

// End-to-end: a body-comp message produces one body_composition_update suggestion.
const bc = extractSignals("PBF 11.4%, SMM 88.4, BMR 1864").find(
  (s) => (s.details as { action?: string } | undefined)?.action === "body_composition_update"
)
assert.ok(bc, "expected a body_composition_update suggestion")

// Regression: body-comp numbers (incl. "111.8lbs") must NOT become a weight.
const full = extractSignals(
  "PBF 11.4%\nSMM 88.4\nBody fat mass 19.7\nTotal body water 111.8lbs\nBasal met rate 1864kcal",
  { matched: true }
)
const actions = full.map((s) => (s.details as { action?: string } | undefined)?.action)
assert.ok(!actions.includes("create_weight_log"), "body-comp must not produce a weight log")
assert.deepEqual(actions, ["body_composition_update"])

console.log("✓ extract body-composition: 3 extract + 3 ignore + 1 suggestion assertions passed")
