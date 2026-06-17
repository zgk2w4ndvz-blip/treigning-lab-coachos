// Coach prescription extraction tests. Run: `npm run test:coachrx`.
// Covers nutrition + low-base extraction, combined messages, aliases, mixed
// caps, extra text, and no-duplicate-prescriptions.

import assert from "node:assert/strict"

import { extractCoachPrescriptions } from "@/lib/messages/coach-rx"

type D = Record<string, unknown>
function byAction(body: string, action: string): D | undefined {
  return extractCoachPrescriptions(body).find((s) => (s.details as D).action === action)?.details as D | undefined
}

// ---- Nutrition -------------------------------------------------------------
assert.deepEqual(byAction("2500 calories 156 protein 313 carbs 69 fat", "nutrition_prescription"), {
  action: "nutrition_prescription",
  author_type: "coach",
  source: "imessage",
  calories: 2500,
  protein_g: 156,
  carbs_g: 313,
  fat_g: 69,
})

// nutrition aliases
assert.equal(byAction("2500 kcal", "nutrition_prescription")?.calories, 2500)
assert.equal(byAction("carbohydrates 313", "nutrition_prescription")?.carbs_g, 313)
assert.equal(byAction("protein grams 156", "nutrition_prescription")?.protein_g, 156)
assert.equal(byAction("fats 69", "nutrition_prescription")?.fat_g, 69)

// ---- Low Base --------------------------------------------------------------
assert.deepEqual(byAction("Low base 45 minutes 3x per week", "low_base_prescription"), {
  action: "low_base_prescription",
  author_type: "coach",
  source: "imessage",
  minutes_per_session: 45,
  frequency_per_week: 3,
})

// frequency aliases all resolve to 3
for (const f of ["3x/week", "3 x week", "3 times per week", "3 times a week", "3 sessions per week"]) {
  assert.equal(
    byAction(`low base 45 min ${f}`, "low_base_prescription")?.frequency_per_week,
    3,
    `freq alias: ${f}`
  )
}

// low base requires the "low base" keyword — bare "45 minutes" is not a low-base Rx
assert.equal(byAction("let's do 45 minutes today", "low_base_prescription"), undefined)

// ---- Combined message → two suggestions ------------------------------------
const combined = extractCoachPrescriptions(
  "Drop macros to 2500. 156 protein. 313 carbs. 69 fat. Increase low base to 45 minutes 3x/week."
)
assert.equal(combined.length, 2, "combined message → exactly two suggestions")
const actions = combined.map((s) => (s.details as D).action).sort()
assert.deepEqual(actions, ["low_base_prescription", "nutrition_prescription"])

// ---- Mixed caps ------------------------------------------------------------
assert.deepEqual(byAction("LOW BASE 45 MIN, 3 SESSIONS PER WEEK", "low_base_prescription"), {
  action: "low_base_prescription",
  author_type: "coach",
  source: "imessage",
  minutes_per_session: 45,
  frequency_per_week: 3,
})

// ---- Extra text before/after -----------------------------------------------
const extra = byAction("Hey nice session today — 2500 calories, 156 protein. talk soon!", "nutrition_prescription")
assert.equal(extra?.calories, 2500)
assert.equal(extra?.protein_g, 156)

// ---- No duplicate prescriptions --------------------------------------------
// One message yields at most one nutrition + one low_base suggestion.
const dup = extractCoachPrescriptions(
  "2500 calories 156 protein 313 carbs 69 fat. low base 45 minutes 3x/week"
)
assert.equal(dup.filter((s) => (s.details as D).action === "nutrition_prescription").length, 1)
assert.equal(dup.filter((s) => (s.details as D).action === "low_base_prescription").length, 1)

// ---- Coach metadata --------------------------------------------------------
for (const s of combined) {
  assert.equal((s.details as D).author_type, "coach")
}

// ---- Non-prescription ignored ----------------------------------------------
assert.deepEqual(extractCoachPrescriptions("nice work today, proud of you"), [])

console.log("✓ coach-rx suite: nutrition + low-base + combined + aliases + no-duplicate assertions passed")
