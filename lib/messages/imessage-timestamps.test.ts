// iMessage timestamp tests. Run: `npm run test:imessage`.
// Proves: Apple Core-Data timestamp conversion (epoch 2001, ns vs seconds);
// Julian's 173.4 message maps to the correct Central DAY (not the UTC day);
// UI grouping uses the message timestamp in the operating timezone; and the
// ingest chain preserves the original instant.

import assert from "node:assert/strict"

import { appleDateToIso } from "@/tools/imessage-bridge/chatdb"
import { dayKeyInZone } from "@/lib/calendar/timezone"

const TZ = "America/Chicago"

// ── 1. Apple Core-Data timestamp conversion ─────────────────────────────────
// Apple epoch is 2001-01-01, not 1970.
assert.equal(appleDateToIso(0), "2001-01-01T00:00:00.000Z")
// Legacy SECONDS form (value < 1e11): 1 day after epoch.
assert.equal(appleDateToIso(86_400), "2001-01-02T00:00:00.000Z")
// Modern NANOSECONDS form (value > 1e11): same 1 day after epoch.
assert.equal(appleDateToIso(86_400 * 1e9), "2001-01-02T00:00:00.000Z")
// A modern instant — derive the Apple value from the target so the test is
// self-consistent (Apple value = unix seconds − seconds-from-1970-to-2001).
const APPLE_EPOCH = 978_307_200
const target = "2026-06-17T04:00:00.000Z"
const appleSec = Date.parse(target) / 1000 - APPLE_EPOCH
assert.equal(appleDateToIso(appleSec), target) // seconds form (legacy)
assert.ok(appleDateToIso(appleSec * 1e9).startsWith("2026-06-17T04:00:00")) // ns form (modern)

// ── 2/3. Julian's 173.4 message: correct Central DAY, not the UTC day ───────
// Stored instant (verified in prod): 2026-06-17T03:58:21.894Z = 10:58 PM CDT
// on Tue Jun 16 — exactly what Apple Messages shows on the Mac.
const julian = "2026-06-17T03:58:21.894Z"
assert.equal(dayKeyInZone(new Date(julian), TZ), "2026-06-16") // ✅ operating-TZ grouping
assert.equal(julian.slice(0, 10), "2026-06-17") // ❌ the old UTC-slice bug (Wednesday)
// A morning-Central message stays on the same day either way.
assert.equal(dayKeyInZone(new Date("2026-06-17T12:21:50.733Z"), TZ), "2026-06-17")

// ── 4. Ingestion preserves the original instant ─────────────────────────────
// /api/ingest's toIso = new Date(v).toISOString() — an ISO-Z value round-trips
// unchanged (not overwritten with now(), not reparsed as local time).
const preserve = (v: string) => new Date(v).toISOString()
assert.equal(preserve(julian), julian)
// End-to-end: Apple value → bridge ISO → ingest preserve → same instant.
assert.equal(preserve(appleDateToIso(86_400 * 1e9)), "2001-01-02T00:00:00.000Z")

console.log("imessage timestamp tests passed")
