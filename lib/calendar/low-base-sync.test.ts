// Tests for the Low Base → calendar reconciler. Run: `npm run test:lowbasesync`.

import assert from "node:assert/strict"

import {
  planLowBaseSync,
  slotKeyOf,
  firstOnOrAfter,
  lowBaseEventLabel,
  lowBaseEventDescription,
  lowBaseManagedEventFields,
  isManagedLowBaseEvent,
  LOW_BASE_SOURCE,
  type ExistingManagedEvent,
  type LowBaseScheduleInput,
} from "@/lib/calendar/low-base-sync"

const TODAY = "2026-06-22" // a Monday
const RX = "rx-1"

function input(over: Partial<LowBaseScheduleInput> = {}): LowBaseScheduleInput {
  return {
    prescriptionId: RX,
    mepBpm: 145,
    minutesPerSession: 45,
    startDate: "2026-06-22",
    endDate: null,
    slots: [
      { dayOfWeek: 1, time: "08:00" }, // Mon
      { dayOfWeek: 4, time: "08:00" }, // Thu
      { dayOfWeek: 5, time: "08:00" }, // Fri
    ],
    ...over,
  }
}

function managed(over: Partial<ExistingManagedEvent>): ExistingManagedEvent {
  return {
    id: "e-?",
    slotKey: slotKeyOf(1, "08:00"),
    firstOccurrenceDay: "2026-06-15",
    mepBpm: 145,
    minutesPerSession: 45,
    recurrenceUntil: null,
    lastHistoryDay: null,
    ...over,
  }
}

// --- label / description helpers --------------------------------------------
assert.equal(lowBaseEventLabel(45, 145), "Low Base – 45 min @ 145 bpm")
assert.equal(lowBaseEventLabel(30, null), "Low Base – 30 min")
assert.equal(lowBaseEventLabel(45, 144.6), "Low Base – 45 min @ 145 bpm") // rounded
assert.equal(
  lowBaseEventDescription(145, 45, RX),
  "MEP: 145\nDuration: 45\nPrescription ID: rx-1"
)

// --- firstOnOrAfter ----------------------------------------------------------
assert.equal(firstOnOrAfter("2026-06-22", 1), "2026-06-22") // Mon -> same day
assert.equal(firstOnOrAfter("2026-06-22", 4), "2026-06-25") // Mon -> Thu
assert.equal(firstOnOrAfter("2026-06-22", 0), "2026-06-28") // Mon -> next Sun

// 1. Fresh schedule, no existing events → three creates anchored correctly.
{
  const ops = planLowBaseSync(input(), [], TODAY)
  assert.equal(ops.length, 3, "creates one event per slot")
  assert.ok(ops.every((o) => o.type === "create"))
  const created = ops as Extract<(typeof ops)[number], { type: "create" }>[]
  assert.deepEqual(
    created.map((o) => o.anchorDate).sort(),
    ["2026-06-22", "2026-06-25", "2026-06-26"]
  )
}

// 2. Idempotent: same schedule already present → zero ops (no duplicates).
{
  const existing: ExistingManagedEvent[] = [
    managed({ id: "e1", slotKey: slotKeyOf(1, "08:00"), firstOccurrenceDay: "2026-06-15" }),
    managed({ id: "e2", slotKey: slotKeyOf(4, "08:00"), firstOccurrenceDay: "2026-06-18" }),
    managed({ id: "e3", slotKey: slotKeyOf(5, "08:00"), firstOccurrenceDay: "2026-06-19" }),
  ]
  const ops = planLowBaseSync(input(), existing, TODAY)
  assert.equal(ops.length, 0, "no changes → no operations")
}

// 3. MEP change on an event WITH past occurrences → forward split (truncate + create).
{
  const existing = [managed({ id: "e1", slotKey: slotKeyOf(1, "08:00"), firstOccurrenceDay: "2026-06-15", mepBpm: 140 })]
  const ops = planLowBaseSync(
    input({ mepBpm: 150, slots: [{ dayOfWeek: 1, time: "08:00" }] }),
    existing,
    TODAY
  )
  assert.equal(ops.length, 2)
  assert.deepEqual(ops[0], { type: "truncate", eventId: "e1", recurrenceUntil: "2026-06-21" })
  assert.equal(ops[1].type, "create")
  const c = ops[1] as Extract<(typeof ops)[number], { type: "create" }>
  assert.equal(c.anchorDate, "2026-06-22") // first Mon >= today
  assert.equal(c.mepBpm, 150)
}

// 4. Minutes change on a FUTURE-only event → in-place update (no split, no history).
{
  const existing = [managed({ id: "e1", slotKey: slotKeyOf(1, "08:00"), firstOccurrenceDay: "2026-06-29", minutesPerSession: 30 })]
  const ops = planLowBaseSync(
    input({ minutesPerSession: 60, slots: [{ dayOfWeek: 1, time: "08:00" }] }),
    existing,
    TODAY
  )
  assert.equal(ops.length, 1)
  assert.deepEqual(ops[0], { type: "update", eventId: "e1", minutesPerSession: 60, mepBpm: 145, recurrenceUntil: null })
}

// 5. Removed slot (time changed = remove old key + add new key).
{
  const existing = [managed({ id: "e1", slotKey: slotKeyOf(1, "08:00"), firstOccurrenceDay: "2026-06-15" })]
  const ops = planLowBaseSync(
    input({ slots: [{ dayOfWeek: 1, time: "09:00" }] }), // 8:00 -> 9:00
    existing,
    TODAY
  )
  // old 08:00 truncated (has past), new 09:00 created.
  assert.ok(ops.some((o) => o.type === "truncate" && o.eventId === "e1"))
  assert.ok(ops.some((o) => o.type === "create" && o.slotKey === slotKeyOf(1, "09:00")))
}

// 6. Removed slot with NO past occurrences → delete outright.
{
  const existing = [managed({ id: "e1", slotKey: slotKeyOf(2, "08:00"), firstOccurrenceDay: "2026-07-01" })]
  const ops = planLowBaseSync(input({ slots: [] }), existing, TODAY)
  assert.deepEqual(ops, [{ type: "delete", eventId: "e1" }])
}

// 7. End-date change only → setRecurrenceUntil, clamped to protected history.
{
  const existing = [managed({ id: "e1", slotKey: slotKeyOf(1, "08:00"), firstOccurrenceDay: "2026-06-15", recurrenceUntil: null, lastHistoryDay: "2026-06-15" })]
  const ops = planLowBaseSync(
    input({ endDate: "2026-08-01", slots: [{ dayOfWeek: 1, time: "08:00" }] }),
    existing,
    TODAY
  )
  assert.deepEqual(ops, [{ type: "setRecurrenceUntil", eventId: "e1", recurrenceUntil: "2026-08-01" }])

  // shortening below a completed occurrence is clamped up to it
  const ops2 = planLowBaseSync(
    input({ endDate: "2026-06-01", slots: [{ dayOfWeek: 1, time: "08:00" }] }),
    existing,
    TODAY
  )
  assert.deepEqual(ops2, [{ type: "setRecurrenceUntil", eventId: "e1", recurrenceUntil: "2026-06-15" }])
}

// 8. Duplicate managed events for one slot → extra is removed.
{
  const existing = [
    managed({ id: "e1", slotKey: slotKeyOf(1, "08:00"), firstOccurrenceDay: "2026-06-15" }),
    managed({ id: "edup", slotKey: slotKeyOf(1, "08:00"), firstOccurrenceDay: "2026-06-15" }),
  ]
  const ops = planLowBaseSync(input({ slots: [{ dayOfWeek: 1, time: "08:00" }] }), existing, TODAY)
  assert.ok(ops.some((o) => o.type === "truncate" && o.eventId === "edup"), "duplicate event removed")
  assert.ok(!ops.some((o) => o.type === "truncate" && o.eventId === "e1"), "kept event untouched")
}

// 9. Managed event fields: prescription_id is NULL; linkage lives in details.
{
  const f = lowBaseManagedEventFields({
    prescriptionId: RX,
    slotKey: slotKeyOf(1, "08:00"),
    dayOfWeek: 1,
    time: "08:00",
    mepBpm: 145,
    minutesPerSession: 45,
  })
  assert.equal(f.prescription_id, null, "prescription_id must be null (no FK to prescriptions)")
  assert.equal(f.details.source, LOW_BASE_SOURCE)
  assert.equal(f.details.low_base_prescription_id, RX, "linkage stored in details")
  assert.equal(f.details.slot_key, "1|08:00")
  assert.equal(f.details.mep_bpm, 145)
  assert.equal(f.details.minutes, 45)
  assert.equal(f.title, "Low Base – 45 min @ 145 bpm")
}

// 10. Lookup matches by details.low_base_prescription_id; manual + other-rx events do NOT.
{
  const mine = { source: LOW_BASE_SOURCE, low_base_prescription_id: RX }
  const otherRx = { source: LOW_BASE_SOURCE, low_base_prescription_id: "rx-2" }
  const manualNoSource = { foo: "bar" }
  assert.equal(isManagedLowBaseEvent(mine, RX), true, "matches own prescription")
  assert.equal(isManagedLowBaseEvent(otherRx, RX), false, "ignores other prescription")
  assert.equal(isManagedLowBaseEvent(manualNoSource, RX), false, "ignores manual event (no source)")
  assert.equal(isManagedLowBaseEvent(null, RX), false, "ignores null details")
  // A coach-Rx-linked event with a real prescriptions FK but no low-base source is left alone.
  assert.equal(isManagedLowBaseEvent({ source: "coach_rx" }, RX), false)
}

console.log(
  "✓ low-base-sync: create / idempotent / forward-split / in-place / remove / end-date / dedup / details-linkage (prescription_id null) passed"
)
