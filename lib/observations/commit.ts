// ============================================================================
// lib/observations/commit.ts — the DARK dual-write entry point (P1b).
//
// Called by the recovery_import approval branch AFTER recovery_logs has been
// written. It is:
//   • FLAG-GATED by OBS_DUAL_WRITE (default off → no-op);
//   • BEST-EFFORT — a failure is logged, never thrown, and never blocks approval;
//   • registry-validated — unregistered metrics are dropped before the store.
//
// recovery_logs remains the authoritative source of truth; observations are a
// canonical shadow that nothing reads yet (reads stay dark until P4).
//
// No `import "server-only"` directive (mirrors lib/recovery/apply.ts) so the
// module stays unit-testable under tsx; it is only ever imported by the server
// action lib/actions/inbox.ts.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js"

import { insertObservationsIfAbsent } from "@/lib/observations/store"
import {
  observationsFromRecoveryApproval,
  validateObservationMetrics,
  type RecoveryApprovalInput,
} from "@/lib/observations/project"

/** The single kill switch for the L2 dual-write. Default OFF. */
export function isDualWriteEnabled(): boolean {
  return process.env.OBS_DUAL_WRITE === "true"
}

export interface CommitResult {
  /** false when the flag was off (no work attempted). */
  attempted: boolean
  inserted: number
  skipped: number
  /** drafts dropped because their metric isn't in the registry. */
  rejected: number
  /** non-null when the insert failed — surfaced for logging, never thrown. */
  error: string | null
}

const NOOP: CommitResult = { attempted: false, inserted: 0, skipped: 0, rejected: 0, error: null }

/**
 * Dual-write the four recovery metrics into the observation store. NEVER throws —
 * callers (the approval gate) treat any outcome as advisory. Returns a summary
 * for logging/observability.
 */
export async function commitRecoveryObservations(
  supabase: SupabaseClient,
  input: RecoveryApprovalInput
): Promise<CommitResult> {
  if (!isDualWriteEnabled()) return NOOP

  try {
    const drafts = observationsFromRecoveryApproval(input)
    const { valid, invalid } = validateObservationMetrics(drafts)
    if (invalid.length > 0) {
      console.warn(
        `[observations] dropped ${invalid.length} draft(s) with unregistered metric(s): ` +
          invalid.map((r) => r.metric).join(", ")
      )
    }

    const res = await insertObservationsIfAbsent(supabase, valid)
    if (res.error) {
      console.error(
        `[observations] dual-write insert FAILED (approval unaffected): ${res.error}`
      )
    } else {
      console.log(
        `[observations] dual-write ok: inserted=${res.inserted} skipped=${res.skipped} ` +
          `rejected=${invalid.length} reading_group=${input.readingGroupId}`
      )
    }
    return {
      attempted: true,
      inserted: res.inserted,
      skipped: res.skipped,
      rejected: invalid.length,
      error: res.error,
    }
  } catch (e) {
    // Defense in depth: nothing in here should throw, but if it does, swallow it.
    const msg = e instanceof Error ? e.message : "observation commit failed"
    console.error(`[observations] dual-write THREW (swallowed; approval unaffected): ${msg}`)
    return { attempted: true, inserted: 0, skipped: 0, rejected: 0, error: msg }
  }
}
