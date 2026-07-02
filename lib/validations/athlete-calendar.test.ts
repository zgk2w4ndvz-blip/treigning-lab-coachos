// Calendar event validation tests. Run: `npm run test:calvalidation`.
// Regression coverage for the timed-vs-all-day save bug: an unchecked "all-day"
// checkbox is omitted from FormData entirely, so the `all_day` key is ABSENT.
// Both createCalendarEventAction and updateCalendarEventAction validate through
// this same schema, so these cover create and edit alike.

import assert from "node:assert/strict"

import { calendarEventSchema } from "@/lib/validations/athlete-calendar"

// A minimal valid submission. Text/number inputs always submit (empty → ""),
// so only the checkbox key can be absent — omit `all_day` to simulate unchecked.
const base = {
  scope: "series",
  occurrence_date: "",
  title: "RAF",
  category: "competition",
  status: "planned",
  starts_at: "2026-07-18T20:00",
  ends_at: "",
  recurrence: "none",
  recurrence_until: "",
  description: "",
} as const

// ── 1. Timed event (all-day UNCHECKED → key absent) must save ────────────────
{
  const r = calendarEventSchema.safeParse({ ...base })
  assert.ok(r.success, "timed event (all_day omitted) should validate")
  assert.equal(r.data.all_day, false, "omitted checkbox → all_day false")
  assert.equal(r.data.starts_at, "2026-07-18T20:00")
  assert.equal(r.data.category, "competition")
  assert.equal(r.data.title, "RAF")
}

// ── 2. All-day event (checkbox CHECKED → "on") must still save ───────────────
{
  const r = calendarEventSchema.safeParse({ ...base, all_day: "on" })
  assert.ok(r.success, "all-day event should validate")
  assert.equal(r.data.all_day, true, "checked checkbox → all_day true")
}

// ── 3. Empty-string all_day (defensive) → false ──────────────────────────────
{
  const r = calendarEventSchema.safeParse({ ...base, all_day: "" })
  assert.ok(r.success, "empty all_day should validate")
  assert.equal(r.data.all_day, false)
}

// ── 4. Timed event with an explicit end time parses and keeps the wall clock ──
{
  const r = calendarEventSchema.safeParse({ ...base, ends_at: "2026-07-18T21:30" })
  assert.ok(r.success, "timed event with ends_at should validate")
  assert.equal(r.data.ends_at, "2026-07-18T21:30")
}

// ── 5. Missing start date/time still fails (validation preserved) ────────────
{
  const r = calendarEventSchema.safeParse({ ...base, starts_at: "" })
  assert.ok(!r.success, "missing starts_at must fail")
  assert.ok(
    r.error.flatten().fieldErrors.starts_at,
    "starts_at should carry the field error"
  )
}

// ── 6. Malformed start (date only, no time) fails the wall-clock refine ───────
{
  const r = calendarEventSchema.safeParse({ ...base, starts_at: "2026-07-18" })
  assert.ok(!r.success, "date-only starts_at must fail the wall-clock check")
}

// ── 7. Missing title still fails ─────────────────────────────────────────────
{
  const r = calendarEventSchema.safeParse({ ...base, title: "" })
  assert.ok(!r.success, "empty title must fail")
}

console.log("athlete-calendar validation tests passed ✓")
