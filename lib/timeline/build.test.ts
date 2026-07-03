// Athlete-Story timeline assembler tests. Run: `npm run test:timeline`.

import assert from "node:assert/strict"

import { buildTimeline, computeDelta } from "@/lib/timeline/build"

const day = (n: number) => new Date(Date.UTC(2026, 5, n, 12, 0, 0)).toISOString()

// ── computeDelta ──────────────────────────────────────────────────────────────
assert.equal(computeDelta([{ at: Date.parse(day(10)), v: 130 }]), null, "one point → no delta")
{
  const d = computeDelta([
    { at: Date.parse(day(18)), v: 128.5 },
    { at: Date.parse(day(11)), v: 130.0 },
  ])
  assert.deepEqual(d, { delta: -1.5, direction: "down" }, "latest 128.5 vs ~7d-ago 130 → down 1.5")
}

// ── Weight trend + per-event context, plus body-fat trend ────────────────────
{
  const { trends, events } = buildTimeline({
    now: day(18),
    weights: [
      { id: "w3", weight_lbs: 128.5, logged_at: day(18), body_fat_pct: 11.2 },
      { id: "w2", weight_lbs: 129.4, logged_at: day(15) },
      { id: "w1", weight_lbs: 130.0, logged_at: day(11), body_fat_pct: 12.0 },
    ],
  })
  const weightTrend = trends.find((t) => t.label === "Weight")
  assert.ok(weightTrend, "weight trend present")
  assert.equal(weightTrend!.value, "128.5 lb")
  assert.equal(weightTrend!.direction, "down")
  assert.ok(weightTrend!.delta?.includes("1.5 lb"), "weight delta over the window")

  const bf = trends.find((t) => t.label === "Body fat")
  assert.ok(bf, "body-fat trend present")
  assert.equal(bf!.value, "11.2%")
  assert.equal(bf!.direction, "down")

  // Latest weight event carries a since-last-reading context line.
  const latestWeightEvent = events.find((e) => e.kind === "weight")
  assert.ok(/0\.9 lb since last reading/.test(latestWeightEvent!.context ?? ""), "per-event delta context")
}

// ── Merge + ordering across domains (newest first) + competition context ─────
{
  const { events } = buildTimeline({
    now: day(18),
    weights: [{ id: "w1", weight_lbs: 130, logged_at: day(12) }],
    recoveries: [{ id: "r1", logged_date: day(17), sleep_hours: 7, energy: 6 }],
    training: [{ id: "t1", completed_at: day(16), session_type: "lift", duration_min: 60, rpe: 8 }],
    competitions: [{ id: "c1", name: "State Open", competition_date: day(25) }],
    messages: [{ id: "m1", body: "feeling good", created_at: day(14), source: "imessage" }],
  })
  const kindsInOrder = events.map((e) => e.kind)
  // day 25 comp, 17 recovery, 16 training, 14 message, 12 weight
  assert.deepEqual(kindsInOrder, ["competition", "recovery", "training", "message", "weight"])

  const comp = events.find((e) => e.kind === "competition")
  assert.ok(/in 7 days/.test(comp!.context ?? ""), "future competition shows days out")
  const training = events.find((e) => e.kind === "training")
  assert.ok(/Completed lift/.test(training!.title) && /RPE 8/.test(training!.detail ?? ""))
}

// ── Empty input → empty, no throw ────────────────────────────────────────────
{
  const r = buildTimeline({})
  assert.deepEqual(r.events, [])
  assert.deepEqual(r.trends, [])
}

console.log("✓ timeline: computeDelta + weight/body-fat trends + merge/order + competition + empty passed")
