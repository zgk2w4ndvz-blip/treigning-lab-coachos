// Examples / assertions for the structured extractor's bare-number weight rule.
// Run: `npm run test:extract` (tsx). No test framework needed.

import assert from "node:assert/strict"

import { extractSignals } from "@/lib/messages/extract"

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

console.log(`✓ extract bare-weight: ${passed} cases + 3 time-of-day assertions passed`)
