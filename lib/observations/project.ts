// ============================================================================
// lib/observations/project.ts — PURE mapping from an approved recovery import to
// canonical observation drafts (the P1b first vertical). No I/O. The registry is
// the vocabulary: each draft's domain/unit come from getMetric(), and any value
// whose metric isn't in the registry is rejected (validateObservationMetrics).
//
// One approved recovery import → up to FOUR observations (HRV, resting HR,
// recovery score, hydration), all sharing ONE reading_group_id [D3], each with a
// per-metric source_ref suffix for idempotency.
// ============================================================================

import { getMetric } from "@/lib/observations/registry"
import type { ObservationInsert } from "@/lib/observations/store"

/** Everything project.ts needs from the approval site to build drafts. */
export interface RecoveryApprovalInput {
  coachId: string
  clientId: string
  /** The approved suggestion id → observations.suggested_action_id (FK). */
  suggestedActionId: string | null
  /** Connector id, e.g. "treigninglab" → observations.source. */
  source: string
  /** The recovery_logs source_ref; per-metric suffix is appended. */
  sourceRefBase: string
  /** ISO instant the metrics pertain to (measured_at ?? source_date@00:00Z). */
  observedAt: string
  /** ISO approval/commit instant. */
  committedAt: string
  sensitive: boolean
  /** One shared id for all metrics from this import [D3]. */
  readingGroupId: string
  values: {
    hrvRmssd?: number | null
    restingHr?: number | null
    recoveryScore?: number | null
    hydration?: number | null
  }
}

/** Registry key ↔ the value field on the approved recovery row. */
const RECOVERY_METRICS: { key: string; field: keyof RecoveryApprovalInput["values"] }[] = [
  { key: "hrv_rmssd_ms", field: "hrvRmssd" },
  { key: "resting_hr_bpm", field: "restingHr" },
  { key: "recovery_score", field: "recoveryScore" },
  { key: "recovery_hydration_pct", field: "hydration" },
]

/**
 * Map one approved recovery import → observation drafts. Null / non-finite values
 * are skipped (no row). Domain + unit are taken from the registry, so the drafts
 * can never disagree with the canonical vocabulary.
 */
export function observationsFromRecoveryApproval(
  input: RecoveryApprovalInput
): ObservationInsert[] {
  const out: ObservationInsert[] = []
  for (const { key, field } of RECOVERY_METRICS) {
    const v = input.values[field]
    if (v == null || !Number.isFinite(v)) continue
    const def = getMetric(key)
    if (!def) continue // registry is the source of truth; unknown key → never written
    out.push({
      coach_id: input.coachId,
      client_id: input.clientId,
      domain: def.domain,
      metric: def.key,
      value_num: v,
      value_text: null,
      value_json: null,
      unit: def.unit,
      observed_at: input.observedAt,
      committed_at: input.committedAt,
      source: input.source,
      ingested_via: "connector",
      created_by_type: "coach",
      created_by: input.coachId,
      source_ref: `${input.sourceRefBase}:${def.key}`,
      reading_group_id: input.readingGroupId,
      suggested_action_id: input.suggestedActionId,
      confidence: 1,
      sensitive: input.sensitive,
    })
  }
  return out
}

/**
 * Registry validation guard: partition drafts into those whose `metric` is a
 * known registry key and those that are not. The commit layer drops + logs the
 * invalid set so an unregistered metric can never reach the store.
 */
export function validateObservationMetrics(rows: ObservationInsert[]): {
  valid: ObservationInsert[]
  invalid: ObservationInsert[]
} {
  const valid: ObservationInsert[] = []
  const invalid: ObservationInsert[] = []
  for (const r of rows) (getMetric(r.metric) ? valid : invalid).push(r)
  return { valid, invalid }
}
