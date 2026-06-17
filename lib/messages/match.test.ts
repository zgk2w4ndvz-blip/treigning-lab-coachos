// Athlete-matching hardening tests. Run: `npm run test:match`.
// Covers phone normalization equivalence, handle-only matching (name never
// overrides a handle), and the bridge's single-athlete / ambiguous resolver.

import assert from "node:assert/strict"

import { matchAthlete, normalizePhone, normalizeHandle, type MatchClient } from "@/lib/messages/match"
import { buildAthleteIndex, resolveAthlete, type AthleteRef } from "../../tools/imessage-bridge/filter"
import type { Handle } from "../../tools/imessage-bridge/api"

// ---- Phone normalization equivalence (point 3) -----------------------------
const forms = ["4055551234", "+14055551234", "(405) 555-1234", "405-555-1234"]
for (const f of forms) assert.equal(normalizePhone(f), "+14055551234", `normalize ${f}`)
assert.equal(normalizePhone("123"), null) // too short
assert.equal(normalizeHandle({ phone: null, email: "Foo@Bar.com" }), "foo@bar.com")
assert.equal(normalizeHandle({ phone: "(405) 555-1234", email: "x@y.z" }), "+14055551234")

// ---- Server matchAthlete: handle-only (point 2) ----------------------------
const clients: MatchClient[] = [
  { id: "brady", first_name: "Brady", last_name: "Koontz", phone: "(715) 498-7632", email: "bradykoontz11@gmail.com" },
  { id: "julian", first_name: "Julian", last_name: "Ramirez", phone: "(786) 262-2180", email: "julianramirez1181@gmail.com" },
]
// phone matches across formats
assert.equal(matchAthlete({ name: null, phone: "+17154987632", email: null }, clients).clientId, "brady")
// a NAME in the message must NOT override the phone handle
assert.equal(
  matchAthlete({ name: "Julian Ramirez", phone: "715-498-7632", email: null }, clients).clientId,
  "brady",
  "phone handle wins over a conflicting name"
)
// a phone that matches no athlete must NOT fall back to a name match
assert.equal(
  matchAthlete({ name: "Brady Koontz", phone: "+19998887777", email: null }, clients).clientId,
  null,
  "unmatched handle never rescued by name"
)
// name-only fallback still works when there is no handle at all
assert.equal(matchAthlete({ name: "Brady Koontz", phone: null, email: null }, clients).clientId, "brady")

// ---- Bridge resolver: single / none / ambiguous (point 7) ------------------
const handles: Handle[] = [
  { clientId: "brady", name: "Brady Koontz", phone: "(715) 498-7632", phoneLast10: "7154987632", email: "bradykoontz11@gmail.com" },
  { clientId: "julian", name: "Julian Ramirez", phone: "(786) 262-2180", phoneLast10: "7862622180", email: "julianramirez1181@gmail.com" },
]
const index = buildAthleteIndex(handles)
const brady = resolveAthlete("+17154987632", index)
assert.equal(brady.status, "matched")
assert.equal(brady.status === "matched" && brady.clientId, "brady")
assert.equal(brady.status === "matched" && brady.normalized, "+17154987632")
assert.equal(resolveAthlete("(786) 262-2180", index).status, "matched")
assert.equal(resolveAthlete("+19998887777", index).status, "none")

// two athletes sharing one phone → ambiguous (skip, never silently pick one)
const shared: Handle[] = [
  { clientId: "a", name: "Ann", phone: null, phoneLast10: "5550001111", email: null },
  { clientId: "b", name: "Bob", phone: null, phoneLast10: "5550001111", email: null },
]
const sharedIndex = buildAthleteIndex(shared)
assert.equal(resolveAthlete("555-000-1111", sharedIndex).status, "ambiguous")

const _ref: AthleteRef = { clientId: "x", name: "X" } // type export sanity
void _ref

console.log("✓ match suite: normalization + handle-only matching + resolver (single/none/ambiguous) passed")
