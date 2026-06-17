// Comprehensive body-composition test suite. Run: `npm run test:bodycomp`.
// Covers extraction, suggestion creation, the approval field-mapping, the
// weight-log write shape, no-duplicate-suggestions, and no-unintended-weight.
// (The DB-side approval write itself is integration-tested manually; the pure
// mapping it uses — bodyCompToWeightLogFields — is unit-tested here.)

import assert from "node:assert/strict"

import { extractBodyComp, extractSignals, type BodyCompFields } from "@/lib/messages/extract"
import { bodyCompToWeightLogFields } from "@/lib/messages/body-comp"

let n = 0
function check(name: string, body: string, expected: BodyCompFields | null) {
  assert.deepEqual(extractBodyComp(body), expected, name)
  n++
}

// ---- 1–12: extraction cases ----------------------------------------------
check("1 PBF only", "PBF 11.4%", { body_fat_percentage: 11.4 })
check("2 SMM only", "SMM 88.4", { skeletal_muscle_mass_lbs: 88.4 })
check("3 BMR only", "BMR 1864", { bmr: 1864 })
check(
  "4 Full InBody",
  "PBF 11.4%\nSMM 88.4\nBody fat mass 19.7\nTotal body water 111.8lbs\nBasal met rate 1864kcal",
  {
    body_fat_mass_lbs: 19.7,
    skeletal_muscle_mass_lbs: 88.4,
    total_body_water_lbs: 111.8,
    bmr: 1864,
    body_fat_percentage: 11.4,
  }
)
check("5 Mixed caps", "pbf 11.4 smM 88.4 BmR 1864", {
  skeletal_muscle_mass_lbs: 88.4,
  bmr: 1864,
  body_fat_percentage: 11.4,
})
check("6 Units present", "PBF 11.4% TBW 111.8 lbs BMR 1864 kcal", {
  total_body_water_lbs: 111.8,
  bmr: 1864,
  body_fat_percentage: 11.4,
})
check("7 Units absent", "PBF 11.4 TBW 111.8 BMR 1864", {
  total_body_water_lbs: 111.8,
  bmr: 1864,
  body_fat_percentage: 11.4,
})
check("8 Extra text before", "Just got my InBody results PBF 11.4% SMM 88.4", {
  skeletal_muscle_mass_lbs: 88.4,
  body_fat_percentage: 11.4,
})
check("9 Extra text after", "PBF 11.4% SMM 88.4 feeling strong today", {
  skeletal_muscle_mass_lbs: 88.4,
  body_fat_percentage: 11.4,
})
check("10a Invalid value → null", "PBF abc", null)
check("10b Invalid mixed → skip bad field", "PBF eleven SMM 88.4", {
  skeletal_muscle_mass_lbs: 88.4,
})
check("11 Duplicate field → first wins", "PBF 11.4% PBF 12.0%", { body_fat_percentage: 11.4 })
check("12 Partial payload", "SMM 88.4 BMR 1864", {
  skeletal_muscle_mass_lbs: 88.4,
  bmr: 1864,
})

// ---- Suggestion creation + no duplicate suggestions ----------------------
const full =
  "PBF 11.4%\nSMM 88.4\nBody fat mass 19.7\nTotal body water 111.8lbs\nBasal met rate 1864kcal"
const sugs = extractSignals(full, { matched: true })
const bcSugs = sugs.filter((s) => s.domain === "body_composition")
assert.equal(bcSugs.length, 1, "exactly one body_composition suggestion (no duplicates)")
const sug = bcSugs[0]
assert.equal(
  (sug.details as { action?: string }).action,
  "body_composition_update",
  "suggestion carries the action the approval flow branches on"
)
assert.deepEqual(sug.details, {
  action: "body_composition_update",
  body_fat_mass_lbs: 19.7,
  skeletal_muscle_mass_lbs: 88.4,
  total_body_water_lbs: 111.8,
  bmr: 1864,
  body_fat_percentage: 11.4,
})

// ---- No unintended weight update -----------------------------------------
// A body-comp message must NOT also produce a weight log suggestion, even with
// "111.8lbs" present, and even when matched (bare-weight fallback suppressed).
const actions = sugs.map((s) => (s.details as { action?: string } | undefined)?.action)
assert.ok(!actions.includes("create_weight_log"), "no weight-log suggestion from a body-comp message")

// ---- Approval mapping (weight-log write shape) ---------------------------
// body_fat_percentage → body_fat_pct; SMM mirrored to muscle_mass_lbs; NO weight.
const mapped = bodyCompToWeightLogFields(sug.details as BodyCompFields & { action: string })
assert.deepEqual(mapped, {
  body_fat_pct: 11.4,
  skeletal_muscle_mass_lbs: 88.4,
  muscle_mass_lbs: 88.4,
  body_fat_mass_lbs: 19.7,
  total_body_water_lbs: 111.8,
  bmr: 1864,
})
assert.ok(!("weight_lbs" in mapped), "approval never sets weight unless payload carries it")

// weight IS written only when the payload explicitly includes it
const withWeight = bodyCompToWeightLogFields({ body_fat_percentage: 10, weight_lbs: 172.5 })
assert.equal(withWeight.weight_lbs, 172.5)

// partial payload maps only the present fields
assert.deepEqual(bodyCompToWeightLogFields({ skeletal_muscle_mass_lbs: 88.4, bmr: 1864 }), {
  skeletal_muscle_mass_lbs: 88.4,
  muscle_mass_lbs: 88.4,
  bmr: 1864,
})

console.log(`✓ body-composition suite: ${n} extraction cases + suggestion/mapping/no-weight assertions passed`)
