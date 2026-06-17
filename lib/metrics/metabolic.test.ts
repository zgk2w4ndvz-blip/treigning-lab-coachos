// Metabolic zone-calculation tests. Run: `npm run test:metabolic`.
// Covers HR zone bpm ranges, boundary behavior, and null-safety.

import assert from "node:assert/strict"

import { heartRateZones, zoneForBpm } from "@/lib/metrics/metabolic"

// ---- heartRateZones --------------------------------------------------------
const z = heartRateZones(200)
assert.equal(z.length, 5)
// Z1 50–60% of 200 → 100–120; Z5 90–100% → 180–200
assert.deepEqual(
  z.map((x) => [x.zone, x.minBpm, x.maxBpm]),
  [
    [1, 100, 120],
    [2, 120, 140],
    [3, 140, 160],
    [4, 160, 180],
    [5, 180, 200],
  ]
)
assert.equal(z[0].label, "Recovery")
assert.equal(z[4].label, "VO2 Max")

// rounding: max HR 185 → Z4 80–90% = 148–166.5 → 148–167
const z185 = heartRateZones(185)
assert.deepEqual([z185[3].minBpm, z185[3].maxBpm], [148, 167])

// null / non-positive → empty
assert.deepEqual(heartRateZones(null), [])
assert.deepEqual(heartRateZones(0), [])

// ---- zoneForBpm ------------------------------------------------------------
assert.equal(zoneForBpm(200, 130), 2) // 65% → Zone 2
assert.equal(zoneForBpm(200, 140), 3) // exactly 70% favors higher zone
assert.equal(zoneForBpm(200, 200), 5) // 100% → top zone
assert.equal(zoneForBpm(200, 90), null) // 45% below Z1 floor
assert.equal(zoneForBpm(null, 140), null)
assert.equal(zoneForBpm(200, null), null)

console.log("metabolic zone tests passed")
