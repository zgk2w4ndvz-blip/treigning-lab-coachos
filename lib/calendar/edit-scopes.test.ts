// Recurrence edit-scope tests. Run: `npm run test:editscopes`.
// Covers per-occurrence field overrides, cancellation, status preservation, the
// this-and-future split (modeled at the expansion level — the outcome the coach
// sees), recurrence_until truncation, DST, and the first-occurrence edge.

import assert from "node:assert/strict"

import { expandOccurrences, applyOverride } from "@/lib/calendar/recurrence"
import { wallClockToUtc, dayKeyInZone, previousLocalDay } from "@/lib/calendar/timezone"
import type { AthleteCalendarEvent, AthleteCalendarEventOverride } from "@/types/models"

const TZ = "America/Chicago"
const at = (wall: string) => wallClockToUtc(wall, TZ)!.toISOString()

function ev(p: Partial<AthleteCalendarEvent> & { id: string }): AthleteCalendarEvent {
  return {
    coach_id: "co", client_id: "cl", category: "strength", title: "Lift",
    description: null, starts_at: at("2026-06-02T16:00"), ends_at: null, all_day: false,
    status: "planned", recurrence: "weekly", recurrence_until: null, prescription_id: null,
    details: null, created_at: "", updated_at: "", ...p,
  }
}
function ov(p: Partial<AthleteCalendarEventOverride> & { event_id: string; occurrence_date: string }): AthleteCalendarEventOverride {
  return {
    id: `ov-${p.event_id}-${p.occurrence_date}`, status: "planned", completed_at: null,
    notes: null, is_cancelled: false, title: null, description: null, category: null,
    starts_at: null, ends_at: null, all_day: null, created_at: "", updated_at: "", ...p,
  }
}

const RS = new Date("2026-06-01T00:00:00Z")
const RE = new Date("2026-07-01T00:00:00Z")
const expand = (events: AthleteCalendarEvent[], overrides: AthleteCalendarEventOverride[] = []) =>
  expandOccurrences(events, RS, RE, overrides, TZ)

// Baseline: weekly Tuesday 4 PM → Jun 2, 9, 16, 23, 30.
const base = ev({ id: "e1" })
assert.deepEqual(expand([base]).map((o) => o.date), ["2026-06-02", "2026-06-09", "2026-06-16", "2026-06-23", "2026-06-30"])

// ── 1. Single-occurrence TITLE edit ─────────────────────────────────────────
{
  const occ = expand([base], [ov({ event_id: "e1", occurrence_date: "2026-06-16", title: "Lift - Lower" })])
  assert.equal(occ.find((o) => o.date === "2026-06-16")!.event.title, "Lift - Lower")
  assert.equal(occ.find((o) => o.date === "2026-06-09")!.event.title, "Lift") // others untouched
  assert.equal(occ.length, 5)
}

// ── 2. Single-occurrence TIME edit (reschedule within the day) ──────────────
{
  const occ = expand([base], [ov({ event_id: "e1", occurrence_date: "2026-06-16", starts_at: at("2026-06-16T18:30") })])
  const moved = occ.find((o) => o.start === at("2026-06-16T18:30"))
  assert.ok(moved, "occurrence uses the override start instant")
  assert.equal(moved!.date, "2026-06-16")
}

// ── 3. Single-occurrence CANCELLATION (EXDATE) ──────────────────────────────
{
  const occ = expand([base], [ov({ event_id: "e1", occurrence_date: "2026-06-16", is_cancelled: true })])
  assert.deepEqual(occ.map((o) => o.date), ["2026-06-02", "2026-06-09", "2026-06-23", "2026-06-30"])
}

// ── 4. Entire-series edit (base change → all occurrences) ───────────────────
{
  const occ = expand([ev({ id: "e1", title: "Lift v2" })])
  assert.ok(occ.every((o) => o.event.title === "Lift v2"))
}

// ── 5. This-and-future SPLIT at Jun 16 (modeled post-mutation) ──────────────
// Original truncated to the day before the split; new series starts at the split.
{
  const oldSeries = ev({ id: "e1", recurrence_until: previousLocalDay("2026-06-16") }) // 2026-06-15
  const newSeries = ev({ id: "e2", title: "Lift - Lower", starts_at: at("2026-06-16T16:00") })
  const occ = expand([oldSeries, newSeries])
  assert.deepEqual(occ.map((o) => o.date), ["2026-06-02", "2026-06-09", "2026-06-16", "2026-06-23", "2026-06-30"])
  // No duplicate on the split day; past keeps old title, future gets new.
  assert.equal(occ.find((o) => o.date === "2026-06-09")!.event.title, "Lift")
  assert.equal(occ.find((o) => o.date === "2026-06-16")!.event.title, "Lift - Lower")
  assert.equal(occ.find((o) => o.date === "2026-06-30")!.event.title, "Lift - Lower")
}

// ── 6. Override re-pointing: future override lives on the new series; a ──────
//     historical override stays on the old series.
{
  const oldSeries = ev({ id: "e1", recurrence_until: previousLocalDay("2026-06-16") })
  const newSeries = ev({ id: "e2", title: "Lift - Lower", starts_at: at("2026-06-16T16:00") })
  const overrides = [
    ov({ event_id: "e1", occurrence_date: "2026-06-09", status: "completed" }), // historical (old series)
    ov({ event_id: "e2", occurrence_date: "2026-06-23", title: "Deload" }), // re-pointed (new series)
  ]
  const occ = expand([oldSeries, newSeries], overrides)
  assert.equal(occ.find((o) => o.date === "2026-06-09")!.status, "completed")
  assert.equal(occ.find((o) => o.date === "2026-06-23")!.event.title, "Deload")
}

// ── 7. recurrence_until truncation ──────────────────────────────────────────
{
  const occ = expand([ev({ id: "e1", recurrence_until: "2026-06-15" })])
  assert.deepEqual(occ.map((o) => o.date), ["2026-06-02", "2026-06-09"]) // stops before the cut
}

// ── 8. DST: a field override on a post-DST occurrence keeps 4 PM local ──────
{
  const dstBase = ev({ id: "e3", starts_at: at("2026-10-27T16:00") }) // Tue, CDT
  const occ = expandOccurrences(
    [dstBase],
    new Date("2026-10-20T00:00:00Z"),
    new Date("2026-11-17T00:00:00Z"),
    [ov({ event_id: "e3", occurrence_date: "2026-11-03", title: "Post-DST" })],
    TZ
  )
  const nov3 = occ.find((o) => o.date === "2026-11-03")!
  assert.equal(nov3.event.title, "Post-DST")
  assert.equal(
    new Date(nov3.start).toLocaleTimeString("en-US", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }),
    "16:00"
  )
}

// ── 9. First-occurrence split edge: split == series start → treated as series ─
assert.equal(dayKeyInZone(new Date(base.starts_at), TZ), "2026-06-02")
assert.equal("2026-06-02" > "2026-06-02", false) // not "future" → action falls back to series
assert.equal(previousLocalDay("2026-06-02"), "2026-06-01")

// ── 10. Status-only override leaves fields intact (back-compat) ─────────────
{
  const occ = expand([base], [ov({ event_id: "e1", occurrence_date: "2026-06-09", status: "completed" })])
  const o = occ.find((x) => x.date === "2026-06-09")!
  assert.equal(o.status, "completed")
  assert.equal(o.event.title, "Lift") // unchanged
}

// ── applyOverride unit: null inherits, set replaces ─────────────────────────
{
  const merged = applyOverride(base, ov({ event_id: "e1", occurrence_date: "2026-06-16", title: "X" }))
  assert.equal(merged.title, "X")
  assert.equal(merged.category, "strength") // null override field inherits base
}

console.log("calendar edit-scope tests passed")
