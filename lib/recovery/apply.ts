import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Json } from "@/types/database"

// Apply a coach-approved `recovery_import` suggestion to recovery_logs. Pure
// validation + mapping is split out so it is unit-testable; the write is
// idempotent (one row per client + source_ref). Coach approval only — never
// auto-applied. Manual recovery logs (source_ref null) are never touched.

const num = z.number().finite().nullable().optional()

export const recoveryImportSchema = z
  .object({
    action: z.literal("recovery_import"),
    connector: z.string().trim().min(1).optional(),
    source_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    recovery_score: num,
    hrv_rmssd: num,
    resting_hr: num,
    hydration: num,
    measured_at: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  // Keep extra connector fields (hydration_standard, anomalies, recovery_match)
  // so they can be preserved in recovery_logs.raw.
  .passthrough()

export type RecoveryImport = z.infer<typeof recoveryImportSchema>

export type ParseResult =
  | { ok: true; data: RecoveryImport }
  | { ok: false; error: string }

/** Validate a suggestion's `details` as a recovery_import payload. */
export function parseRecoveryImport(details: unknown): ParseResult {
  const r = recoveryImportSchema.safeParse(details)
  if (!r.success) return { ok: false, error: "Invalid recovery import payload." }
  return { ok: true, data: r.data }
}

export interface RecoveryLogContext {
  clientId: string
  loggedBy: string | null
  /** Stable idempotency key (the suggestion's source_message_id). */
  sourceRef: string
}

/** Pure: build the recovery_logs insert row from a validated payload. */
export function recoveryLogRowFromImport(data: RecoveryImport, ctx: RecoveryLogContext) {
  return {
    client_id: ctx.clientId,
    logged_by: ctx.loggedBy,
    logged_date: data.source_date,
    hrv: data.hrv_rmssd ?? null,
    resting_hr: data.resting_hr != null ? Math.round(data.resting_hr) : null,
    recovery_score: data.recovery_score ?? null,
    hydration: data.hydration ?? null,
    measured_at: data.measured_at ?? null,
    source: data.connector ?? "treigninglab",
    source_ref: ctx.sourceRef,
    notes: data.notes ?? null,
    raw: data as unknown as Json,
  }
}

export type WriteResult =
  | { ok: true; inserted: boolean }
  | { ok: false; error: string }

/**
 * Idempotently write exactly one recovery_logs row. If a row already exists for
 * (client_id, source_ref) it is left as-is (no duplicate). Never throws control
 * back to the caller via exceptions — returns a result.
 */
export async function writeRecoveryLog(
  supabase: SupabaseClient,
  row: ReturnType<typeof recoveryLogRowFromImport>
): Promise<WriteResult> {
  const { data: existing, error: qErr } = await supabase
    .from("recovery_logs")
    .select("id")
    .eq("client_id", row.client_id)
    .eq("source_ref", row.source_ref)
    .maybeSingle()
  if (qErr) return { ok: false, error: qErr.message }
  if (existing) return { ok: true, inserted: false }

  const { error } = await supabase.from("recovery_logs").insert(row)
  if (error) return { ok: false, error: error.message }
  return { ok: true, inserted: true }
}
