// Calendar timezone + recurrence tests. Run: `npm run test:calendar`.
// Operating timezone = America/Chicago (the gym). Proves:
//  1. Tue 4 PM stores as 21:00Z during CDT
//  2. Tue 4 PM stores as 22:00Z during CST
//  3. Weekly recurrence stays Tuesday 4 PM (local) across the DST boundary
//  4. Server and browser expansion produce identical occurrence dates (run under
//     two different ambient TZs via child processes)
//  5. recurrence_until ends on the correct LOCAL day

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import {
  dayKeyInZone,
  wallClockToUtc,
  weekdayInZone,
} from "@/lib/calendar/timezone"
import { expandOccurrences } from "@/lib/calendar/recurrence"
import type { AthleteCalendarEvent } from "@/types/models"

const TZ = "America/Chicago"

function ev(partial: Partial<AthleteCalendarEvent>): AthleteCalendarEvent {
  return {
    id: "evt-1",
    coach_id: "coach",
    client_id: "client",
    category: "strength",
    title: "Lift",
    description: null,
    starts_at: "2026-06-23T21:00:00.000Z",
    ends_at: null,
    all_day: false,
    status: "planned",
    recurrence: "weekly",
    recurrence_until: null,
    prescription_id: null,
    details: null,
    created_at: "",
    updated_at: "",
    ...partial,
  }
}

const localTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

// ── 1. CDT: Tuesday 2026-06-23 16:00 America/Chicago → 21:00Z ───────────────
assert.equal(
  wallClockToUtc("2026-06-23T16:00", TZ)?.toISOString(),
  "2026-06-23T21:00:00.000Z"
)

// ── 2. CST: Tuesday 2026-01-06 16:00 America/Chicago → 22:00Z ───────────────
assert.equal(
  wallClockToUtc("2026-01-06T16:00", TZ)?.toISOString(),
  "2026-01-06T22:00:00.000Z"
)

// ── 3. Weekly stays Tuesday 4 PM across DST (US fall-back is 2026-11-01) ─────
const base = wallClockToUtc("2026-10-27T16:00", TZ)! // Tue, CDT → 21:00Z
const weekly = ev({ starts_at: base.toISOString(), recurrence: "weekly" })
const occ = expandOccurrences(
  [weekly],
  new Date("2026-10-20T00:00:00Z"),
  new Date("2026-11-17T00:00:00Z"),
  [],
  TZ
)
assert.deepEqual(occ.map((o) => o.date), ["2026-10-27", "2026-11-03", "2026-11-10"])
for (const o of occ) {
  assert.equal(weekdayInZone(new Date(o.start), TZ), 2, "every occurrence is a Tuesday")
  assert.equal(localTime(o.start), "16:00", "local time stays 4 PM across DST")
}
// The stored instant shifts offset across the boundary (CDT 21:00Z → CST 22:00Z):
assert.equal(new Date(occ[0].start).toISOString(), "2026-10-27T21:00:00.000Z")
assert.equal(new Date(occ[1].start).toISOString(), "2026-11-03T22:00:00.000Z")

// ── 5. recurrence_until ends on the correct LOCAL day ───────────────────────
const bounded = ev({
  starts_at: base.toISOString(),
  recurrence: "weekly",
  recurrence_until: "2026-11-03", // inclusive of the 11-03 occurrence, excludes 11-10
})
const occ2 = expandOccurrences(
  [bounded],
  new Date("2026-10-20T00:00:00Z"),
  new Date("2026-12-01T00:00:00Z"),
  [],
  TZ
)
assert.deepEqual(occ2.map((o) => o.date), ["2026-10-27", "2026-11-03"])

// ── 4. Server vs browser: identical occurrence dates under different ambient TZ ─
// dayKeyInZone uses Intl with an explicit timeZone, so it must not depend on the
// host zone. Prove it by expanding the same series in child processes whose
// ambient TZ differs wildly, and comparing to the in-process result.
const inProcess = expandOccurrences(
  [ev({ starts_at: "2026-06-23T21:00:00.000Z", recurrence: "weekly" })],
  new Date("2026-06-01T00:00:00Z"),
  new Date("2026-07-15T00:00:00Z"),
  [],
  TZ
).map((o) => o.date)

const probe = path.join(process.cwd(), "_tz_xcheck.tmp.ts")
fs.writeFileSync(
  probe,
  `import { expandOccurrences } from "@/lib/calendar/recurrence"
const e = { id:"x", coach_id:"c", client_id:"cl", category:"strength", title:"L", description:null, starts_at:"2026-06-23T21:00:00.000Z", ends_at:null, all_day:false, status:"planned", recurrence:"weekly", recurrence_until:null, prescription_id:null, details:null, created_at:"", updated_at:"" }
const occ = expandOccurrences([e as any], new Date("2026-06-01T00:00:00Z"), new Date("2026-07-15T00:00:00Z"), [], "America/Chicago")
process.stdout.write(JSON.stringify(occ.map((o) => o.date)))
`
)
try {
  const run = (tz: string) =>
    execFileSync("npx", ["tsx", probe], {
      env: { ...process.env, TZ: tz },
      encoding: "utf8",
    }).trim()
  const underUtc = run("UTC")
  const underTokyo = run("Asia/Tokyo")
  assert.equal(underUtc, underTokyo, "occurrence dates identical across ambient TZ")
  assert.equal(underUtc, JSON.stringify(inProcess), "child output matches in-process")
} finally {
  fs.rmSync(probe, { force: true })
}

// dayKeyInZone groups an evening instant on the Central day, not the UTC day:
assert.equal(dayKeyInZone(new Date("2026-06-23T02:00:00Z"), TZ), "2026-06-22")

console.log("calendar timezone tests passed")
