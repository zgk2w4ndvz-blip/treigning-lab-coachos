// L2 dual-write unit tests — PURE (no DB, no network). Run: `npm run test:observations`.
//
// Covers: flag off = no-op · recovery row → expected observations · shared
// reading_group_id · per-metric idempotent source_ref · duplicate insert skipped
// · insert failure never fails the approval path · invalid metric rejected.

import assert from "node:assert/strict"
import type { SupabaseClient } from "@supabase/supabase-js"

import { insertObservationsIfAbsent, type ObservationInsert } from "@/lib/observations/store"
import {
  observationsFromRecoveryApproval,
  validateObservationMetrics,
  type RecoveryApprovalInput,
} from "@/lib/observations/project"
import { commitRecoveryObservations } from "@/lib/observations/commit"

// ---- fake Supabase ---------------------------------------------------------
// Supports the store's chain: from().select().eq().eq().in()  → {data,error}
//                       and: from().insert(rows)              → {error}
function fakeSupabase(opts: { existingRefs?: string[]; insertError?: string; selectError?: string } = {}) {
  const inserted: ObservationInsert[] = []
  let insertCalls = 0
  const client = {
    from() {
      const api: Record<string, unknown> = {}
      api.select = () => api
      api.eq = () => api
      api.in = () =>
        Promise.resolve(
          opts.selectError
            ? { data: null, error: { message: opts.selectError } }
            : { data: (opts.existingRefs ?? []).map((r) => ({ source_ref: r })), error: null }
        )
      api.insert = (rows: ObservationInsert[]) => {
        insertCalls++
        if (opts.insertError) return Promise.resolve({ error: { message: opts.insertError } })
        inserted.push(...rows)
        return Promise.resolve({ error: null })
      }
      return api
    },
  }
  return { client: client as unknown as SupabaseClient, inserted: () => inserted, insertCalls: () => insertCalls }
}

function baseInput(over: Partial<RecoveryApprovalInput> = {}): RecoveryApprovalInput {
  return {
    coachId: "coach-1",
    clientId: "client-1",
    suggestedActionId: "sa-1",
    source: "treigninglab",
    sourceRefBase: "recovery:treigninglab:ext-9:2026-06-26",
    observedAt: "2026-06-26T00:00:00Z",
    committedAt: "2026-06-27T10:00:00Z",
    sensitive: false,
    readingGroupId: "group-1",
    values: { hrvRmssd: 84, restingHr: 48, recoveryScore: 91, hydration: 76 },
    ...over,
  }
}

;(async () => {
// ---- 1. recovery row maps to the four expected observations ----------------
{
  const obs = observationsFromRecoveryApproval(baseInput())
  assert.equal(obs.length, 4, "four metrics → four observations")
  const byMetric = Object.fromEntries(obs.map((o) => [o.metric, o]))
  assert.deepEqual(
    obs.map((o) => o.metric).sort(),
    ["hrv_rmssd_ms", "recovery_hydration_pct", "recovery_score", "resting_hr_bpm"]
  )
  assert.equal(byMetric.hrv_rmssd_ms.value_num, 84)
  assert.equal(byMetric.hrv_rmssd_ms.unit, "ms")
  assert.equal(byMetric.resting_hr_bpm.value_num, 48)
  assert.equal(byMetric.resting_hr_bpm.unit, "bpm")
  assert.equal(byMetric.recovery_score.value_num, 91)
  assert.equal(byMetric.recovery_hydration_pct.value_num, 76)
  // provenance triad + FK + commit metadata
  for (const o of obs) {
    assert.equal(o.domain, "recovery")
    assert.equal(o.ingested_via, "connector")
    assert.equal(o.created_by_type, "coach")
    assert.equal(o.created_by, "coach-1")
    assert.equal(o.suggested_action_id, "sa-1")
    assert.equal(o.committed_at, "2026-06-27T10:00:00Z")
    assert.equal(o.confidence, 1)
    assert.equal(o.sensitive, false)
  }
}

// ---- 2. shared reading_group_id across all metrics -------------------------
{
  const obs = observationsFromRecoveryApproval(baseInput())
  const groups = new Set(obs.map((o) => o.reading_group_id))
  assert.equal(groups.size, 1, "all metrics share one reading_group_id")
  assert.equal([...groups][0], "group-1")
}

// ---- 3. per-metric idempotent source_ref (shared base + :metric suffix) ----
{
  const obs = observationsFromRecoveryApproval(baseInput())
  for (const o of obs) {
    assert.equal(
      o.source_ref,
      `recovery:treigninglab:ext-9:2026-06-26:${o.metric}`,
      `source_ref carries per-metric suffix for ${o.metric}`
    )
  }
  // all distinct, all share the same base
  assert.equal(new Set(obs.map((o) => o.source_ref)).size, 4, "per-metric source_refs are distinct")
}

// ---- 3b. null / non-finite values are skipped ------------------------------
{
  const obs = observationsFromRecoveryApproval(
    baseInput({ values: { hrvRmssd: 84, restingHr: null, recoveryScore: undefined, hydration: 76 } })
  )
  assert.deepEqual(obs.map((o) => o.metric).sort(), ["hrv_rmssd_ms", "recovery_hydration_pct"])
}

// ---- 4. duplicate insert skipped (idempotency via existence probe) ---------
{
  const drafts = observationsFromRecoveryApproval(baseInput())
  // first write: nothing exists → all four inserted
  const f1 = fakeSupabase()
  const r1 = await insertObservationsIfAbsent(f1.client, drafts)
  assert.deepEqual(
    { inserted: r1.inserted, skipped: r1.skipped, error: r1.error },
    { inserted: 4, skipped: 0, error: null }
  )
  assert.equal(f1.inserted().length, 4)

  // second write: all four source_refs already present → 0 inserted, 4 skipped
  const f2 = fakeSupabase({ existingRefs: drafts.map((d) => d.source_ref as string) })
  const r2 = await insertObservationsIfAbsent(f2.client, drafts)
  assert.deepEqual(
    { inserted: r2.inserted, skipped: r2.skipped, error: r2.error },
    { inserted: 0, skipped: 4, error: null }
  )
  assert.equal(f2.insertCalls(), 0, "no insert issued when everything already exists")
}

// ---- 5. flag OFF = no-op (no insert attempted) -----------------------------
{
  delete process.env.OBS_DUAL_WRITE
  const f = fakeSupabase()
  const res = await commitRecoveryObservations(f.client, baseInput())
  assert.deepEqual(res, { attempted: false, inserted: 0, skipped: 0, rejected: 0, error: null })
  assert.equal(f.insertCalls(), 0, "flag off → store never touched")
  assert.equal(f.inserted().length, 0)
}

// ---- 5b. flag ON = writes (sanity that the gate opens) ---------------------
{
  process.env.OBS_DUAL_WRITE = "true"
  const f = fakeSupabase()
  const res = await commitRecoveryObservations(f.client, baseInput())
  assert.equal(res.attempted, true)
  assert.equal(res.inserted, 4)
  assert.equal(f.inserted().length, 4)
  delete process.env.OBS_DUAL_WRITE
}

// ---- 6. insert failure does NOT throw / does not fail the approval path -----
{
  process.env.OBS_DUAL_WRITE = "true"
  const f = fakeSupabase({ insertError: "boom: db down" })
  let threw = false
  let res
  try {
    res = await commitRecoveryObservations(f.client, baseInput())
  } catch {
    threw = true
  }
  assert.equal(threw, false, "commit must never throw to the approval path")
  assert.equal(res!.attempted, true)
  assert.equal(res!.inserted, 0)
  assert.equal(res!.error, "boom: db down", "error surfaced for logging, not thrown")
  delete process.env.OBS_DUAL_WRITE
}

// ---- 7. invalid metric rejected by registry validation ---------------------
{
  const good = observationsFromRecoveryApproval(baseInput())
  const bogus: ObservationInsert = { ...good[0], metric: "not_a_real_metric" }
  const { valid, invalid } = validateObservationMetrics([...good, bogus])
  assert.equal(valid.length, 4, "registered metrics pass")
  assert.equal(invalid.length, 1, "unregistered metric is rejected")
  assert.equal(invalid[0].metric, "not_a_real_metric")
}

  console.log(
    "✓ observations dual-write suite: mapping + shared reading_group_id + per-metric source_ref + " +
      "idempotency + flag gate + non-throwing failure + registry validation passed"
  )
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
