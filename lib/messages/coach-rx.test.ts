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

// ---- Metabolic biometrics (the Wiley Wilson case) --------------------------
// "Vo2 max went from 63.22 to 67.52" → takes the NEW value; lactate threshold.
const vo2 = byAction("Vo2 max went from 63.22 to 67.52\n\nLactate threshold is 178bpm", "metabolic_assessment")
assert.equal(vo2?.vo2_max, 67.52, "VO2max uses the post-'to' value")
assert.equal(vo2?.aerobic_threshold_bpm, 178, "lactate threshold → aerobic_threshold_bpm")
assert.equal(vo2?.author_type, "coach")

// crossover point → mep_bpm
assert.equal(byAction("Crossover point- 141", "metabolic_assessment")?.mep_bpm, 141)
// max HR
assert.equal(byAction("max hr 192", "metabolic_assessment")?.max_hr_bpm, 192)
// single VO2max value (no "from/to")
assert.equal(byAction("VO2max 58.1 today", "metabolic_assessment")?.vo2_max, 58.1)

// ---- Body composition (InBody) on an OUTBOUND coach message ----------------
const bc = byAction("PBF 11.4%, SMM 88.4, Body fat mass 19.7", "body_composition_update")
assert.equal(bc?.body_fat_percentage, 11.4)
assert.equal(bc?.skeletal_muscle_mass_lbs, 88.4)
assert.equal(bc?.author_type, "coach")

// ---- Multiple updates in one outbound message (Wiley's full message) -------
const full = extractCoachPrescriptions(
  "Crossover point- 141\n\nLow base prescription- 3 times per week. 30 minutes each session. Monday, Thursday, Friday.\n\nNutrition prescription- 2751 calories, 178 g protein, 337g carbs, 76g fat"
)
const fullActions = full.map((s) => (s.details as D).action).sort()
assert.deepEqual(
  fullActions,
  ["low_base_prescription", "metabolic_assessment", "nutrition_prescription"],
  "one message → low base + nutrition + metabolic suggestions"
)

// ---- No false positives on stray numbers -----------------------------------
assert.deepEqual(extractCoachPrescriptions("Yes"), [])
assert.deepEqual(extractCoachPrescriptions("Sounds good, see you at 8:30"), [])
assert.deepEqual(extractCoachPrescriptions("Lock it in for 8:30"), [])
// a number near no metabolic keyword does not create a metabolic suggestion
assert.equal(byAction("you ran 141 minutes", "metabolic_assessment"), undefined)

console.log("✓ coach-rx suite: nutrition + low-base + metabolic + body-comp + multi-update + no-false-positive assertions passed")
