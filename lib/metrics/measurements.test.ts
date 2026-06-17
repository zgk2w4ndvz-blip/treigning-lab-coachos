// Measurement-derived ratio tests. Run: `npm run test:measurements`.
// Covers Hip/Waist and Waist/Height ratios, rounding, and null-safety.

import assert from "node:assert/strict"

import { hipWaistRatio, waistHeightRatio } from "@/lib/metrics/measurements"

// ---- Hip / Waist -----------------------------------------------------------
assert.equal(hipWaistRatio({ hips_in: 40, waist_in: 32 }), 1.25)
assert.equal(hipWaistRatio({ hips_in: 38, waist_in: 30 }), 1.27) // rounds to 2dp
assert.equal(hipWaistRatio({ hips_in: 30, waist_in: 30 }), 1)

// null-safety: missing either side → null
assert.equal(hipWaistRatio({ hips_in: null, waist_in: 32 }), null)
assert.equal(hipWaistRatio({ hips_in: 40, waist_in: null }), null)
// zero / negative denominator → null (no divide-by-zero)
assert.equal(hipWaistRatio({ hips_in: 40, waist_in: 0 }), null)

// ---- Waist / Height --------------------------------------------------------
assert.equal(waistHeightRatio({ waist_in: 34, height_in: 68 }), 0.5)
assert.equal(waistHeightRatio({ waist_in: 32, height_in: 70 }), 0.46) // rounds to 2dp

assert.equal(waistHeightRatio({ waist_in: null, height_in: 68 }), null)
assert.equal(waistHeightRatio({ waist_in: 34, height_in: null }), null)
assert.equal(waistHeightRatio({ waist_in: 34, height_in: 0 }), null)

console.log("measurements ratio tests passed")
