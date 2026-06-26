// Recovery sync unit tests — PURE (no DB, no network). Run: `npm run test:recovery`.

import assert from "node:assert/strict"

import { matchRecoveryAthlete } from "@/lib/recovery/match"
import { recoverySampleToSuggestion, recoverySourceKey } from "@/lib/recovery/to-suggestions"
import type { MatchClient } from "@/lib/messages/match"
import type { RecoverySample } from "@/lib/recovery/types"

const roster: MatchClient[] = [
  { id: "c-jordan", first_name: "Jordan", last_name: "Vance", email: "jordan.vance@example.com", phone: "+14055550101" },
  { id: "c-maya", first_name: "Maya", last_name: "Okafor", email: "maya.okafor@example.com", phone: "405-555-0102" },
  { id: "c-twin-a", first_name: "Sam", last_name: "Nguyen", email: null, phone: null },
  { id: "c-twin-b", first_name: "Sam", last_name: "Nguyen", email: null, phone: null },
]
const noMap = new Map<string, string>()

// ---- matching priority ------------------------------------------------------
assert.equal(matchRecoveryAthlete({ email: "JORDAN.VANCE@example.com" }, roster, noMap).method, "email")
assert.equal(matchRecoveryAthlete({ email: "jordan.vance@example.com" }, roster, noMap).clientId, "c-jordan")
assert.equal(matchRecoveryAthlete({ phone: "(405) 555-0102" }, roster, noMap).clientId, "c-maya", "phone normalizes")
assert.equal(matchRecoveryAthlete({ name: "Jordan  Vance" }, roster, noMap).method, "name", "exact name, whitespace-insensitive")
// ambiguous exact name → unmatched (never guess, never duplicate)
assert.equal(matchRecoveryAthlete({ name: "Sam Nguyen" }, roster, noMap).method, "unmatched")
// no identifiers → unmatched
assert.equal(matchRecoveryAthlete({}, roster, noMap).method, "unmatched")
// established map wins over everything (manual override / prior match)
const mapped = matchRecoveryAthlete(
  { id: "ext-99", email: "jordan.vance@example.com" },
  roster,
  new Map([["ext-99", "c-maya"]])
)
assert.equal(mapped.clientId, "c-maya")
assert.equal(mapped.method, "map")

// ---- sample → pending suggestion -------------------------------------------
const sample: RecoverySample = {
  connector: "treigninglab",
  external: { id: "ext-1", name: "Jordan Vance" },
  date: "2026-06-25",
  metrics: { recoveryScore: 82, hrvRmssd: 72, restingHr: 48, hydration: null, hrvAnomaly: true },
  notes: "felt strong",
  measuredAt: "2026-06-25T06:00:00Z",
}
const s = recoverySampleToSuggestion(sample)!
assert.equal(s.domain, "recovery")
assert.equal(s.confidence, 1)
assert.equal(s.sensitive, false)
const d = s.details as Record<string, unknown>
assert.equal(d.action, "recovery_import")
assert.equal(d.connector, "treigninglab")
assert.equal(d.recovery_score, 82)
assert.equal(d.hrv_rmssd, 72)
assert.equal(d.resting_hr, 48)
assert.equal(d.hrv_anomaly, true)
assert.equal(d.notes, "felt strong")
assert.equal(d.measured_at, "2026-06-25T06:00:00Z")
assert.ok(!("hydration" in d), "null metric is omitted")
assert.ok(String(s.suggestedProtocol).includes("HRV 72"))

// empty sample (no metrics, no notes) → null (nothing to review)
assert.equal(
  recoverySampleToSuggestion({ connector: "x", external: { id: "e" }, date: "2026-06-25", metrics: {} }),
  null
)

// ---- source key is deterministic + per athlete-day -------------------------
assert.equal(recoverySourceKey(sample), "recovery:treigninglab:ext-1:2026-06-25")
assert.notEqual(
  recoverySourceKey(sample),
  recoverySourceKey({ ...sample, date: "2026-06-26" }),
  "different day → different key"
)

console.log("✓ recovery suite: matching(priority/ambiguous/map) + sample→suggestion(map/drop/key) passed")
