// Agenda mapper/bucketing tests. Run: `npm run test:agenda`.
// Pure aggregation only — recurrence expansion is tested in the calendar suite.

import assert from "node:assert/strict"

import {
  bucketDay,
  byStartsAt,
  calendarPriority,
  competitionToItem,
  occurrenceToItem,
  overdueTaskToItem,
  weightPlanBehind,
} from "@/lib/agenda/build"
import type { AgendaItem, CalendarOccurrence } from "@/types/models"

// ---- bucketDay --------------------------------------------------------------
assert.equal(bucketDay("2026-06-23", "2026-06-23", "2026-06-30"), "today")
assert.equal(bucketDay("2026-06-25", "2026-06-23", "2026-06-30"), "upcoming")
assert.equal(bucketDay("2026-06-30", "2026-06-23", "2026-06-30"), "upcoming") // inclusive horizon
assert.equal(bucketDay("2026-07-01", "2026-06-23", "2026-06-30"), "other") // past horizon
assert.equal(bucketDay("2026-06-22", "2026-06-23", "2026-06-30"), "other") // before today

// ---- calendarPriority -------------------------------------------------------
assert.equal(calendarPriority("competition"), "high")
assert.equal(calendarPriority("weigh_in"), "high")
assert.equal(calendarPriority("strength"), "medium")
assert.equal(calendarPriority("recovery"), "medium")

// ---- weightPlanBehind (direction-aware, 1 lb threshold) --------------------
assert.equal(weightPlanBehind({ latest: 183, target: 180, direction: "cut" }), true) // 3 over
assert.equal(weightPlanBehind({ latest: 180.5, target: 180, direction: "cut" }), false) // within threshold
assert.equal(weightPlanBehind({ latest: 175, target: 180, direction: "gain" }), true) // 5 under
assert.equal(weightPlanBehind({ latest: 180, target: 180, direction: "maintain" }), false)
assert.equal(weightPlanBehind({ latest: 183, target: 180, direction: "maintain" }), true)
assert.equal(weightPlanBehind({ latest: null, target: 180, direction: "cut" }), false) // no data
assert.equal(weightPlanBehind({ latest: 183, target: null, direction: "cut" }), false)

// ---- occurrence → item ------------------------------------------------------
const occ: CalendarOccurrence = {
  key: "evt1@2026-06-23",
  event: {
    id: "evt1", coach_id: "co", client_id: "cl1", category: "strength", title: "Lift",
    description: null, starts_at: "2026-06-23T21:00:00.000Z", ends_at: null, all_day: false,
    status: "planned", recurrence: "weekly", recurrence_until: null, prescription_id: null,
    details: null, created_at: "", updated_at: "",
  },
  date: "2026-06-23",
  start: "2026-06-23T21:00:00.000Z",
  end: null,
  status: "planned",
  override: null,
}
const calItem = occurrenceToItem(occ, "Nick Boykin")
assert.equal(calItem.type, "calendar")
assert.equal(calItem.title, "Lift")
assert.equal(calItem.athleteName, "Nick Boykin")
assert.equal(calItem.startsAt, "2026-06-23T21:00:00.000Z")
assert.equal(calItem.priority, "medium")
assert.equal(calItem.href, "/clients/cl1/calendar")

// ---- competition → item -----------------------------------------------------
const compItem = competitionToItem(
  { id: "c1", client_id: "cl1", coach_id: "co", name: "Regionals", federation: null, location: null, competition_date: "2026-06-28", weight_class: "65kg", divisions: [], status: "planned", result: null, placement: null, peak_weight: null, weigh_in_weight: null, notes: null, created_at: "" },
  "Nick Boykin"
)
assert.equal(compItem.type, "competition")
assert.equal(compItem.priority, "high")
assert.equal(compItem.startsAt, "2026-06-28T00:00:00")

// ---- overdue task → item ----------------------------------------------------
const taskItem = overdueTaskToItem(
  { id: "t1", coach_id: "co", client_id: "cl1", title: "Send macros", description: null, status: "open", priority: "high", due_date: "2026-06-20", completed_at: null, created_at: "", updated_at: "" },
  "Nick Boykin"
)
assert.equal(taskItem.type, "task")
assert.equal(taskItem.detail, "Overdue")
assert.equal(taskItem.href, "/tasks")

// ---- byStartsAt: timed first, untimed last ----------------------------------
const sorted = [
  { startsAt: undefined } as AgendaItem,
  { startsAt: "2026-06-23T18:00:00Z" } as AgendaItem,
  { startsAt: "2026-06-23T06:00:00Z" } as AgendaItem,
].sort(byStartsAt)
assert.equal(sorted[0].startsAt, "2026-06-23T06:00:00Z")
assert.equal(sorted[1].startsAt, "2026-06-23T18:00:00Z")
assert.equal(sorted[2].startsAt, undefined)

console.log("agenda build tests passed")
