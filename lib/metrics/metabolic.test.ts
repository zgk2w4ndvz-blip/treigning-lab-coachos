// Stat Tracker zone tests. Run: `npm run test:metabolic`.
// The Zone is Set Point (MEP) ± 10, rounded — verified against real app values.

import assert from "node:assert/strict"

import { setPointZone } from "@/lib/metrics/metabolic"

// Verified against the Stat Tracker screenshots:
//   Brady  Set Point 170.58 → Zone 161–181
assert.deepEqual(setPointZone(170.58), { low: 161, high: 181 })
//   Julian Set Point 153.00 → Zone 143–163
assert.deepEqual(setPointZone(153), { low: 143, high: 163 })
//   Wiley  Set Point 170.61 → Zone 161–181
assert.deepEqual(setPointZone(170.61), { low: 161, high: 181 })

// rounding at the .5 boundary (banker-agnostic: Math.round rounds half up)
assert.deepEqual(setPointZone(140.5), { low: 131, high: 151 }) // 130.5→131, 150.5→151

// null Set Point → no zone
assert.equal(setPointZone(null), null)

console.log("metabolic zone tests passed")
