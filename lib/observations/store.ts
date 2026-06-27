// ============================================================================
// lib/observations/store.ts — the ONLY module that writes the L2 `observations`
// table. Server-side only (imported solely by the approval gate); no
// `import "server-only"` directive so it stays unit-testable under tsx, mirroring
// lib/recovery/apply.ts. Never throws to the caller — returns a summary.
//
// Idempotency note: the unique index `observations_idem_uq` is PARTIAL
// (`where source_ref is not null`), so it CANNOT be used as an ON CONFLICT target
// (Postgres can't infer a partial index). We therefore check-then-insert — the
// same find-or-create pattern recovery sync uses for message_ingest. The partial
// unique index remains the hard backstop against a concurrent double-insert.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js"

/** Insert shape for one `observations` row (snake_case = DB columns). */
export interface ObservationInsert {
  coach_id: string
  client_id: string
  domain: string
  metric: string
  value_num: number | null
  value_text: string | null
  value_json: unknown | null
  unit: string
  observed_at: string
  committed_at: string
  source: string
  ingested_via: string
  created_by_type: string
  created_by: string | null
  source_ref: string | null
  reading_group_id: string | null
  suggested_action_id: string | null
  confidence: number
  sensitive: boolean
}

export interface InsertObservationsResult {
  inserted: number
  skipped: number
  error: string | null
}

/**
 * Idempotently insert observations. Rows carrying a `source_ref` are deduped on
 * `(coach_id, source, source_ref)` (the partial unique index); rows already
 * present are skipped. Rows with `source_ref = null` are always inserted (cannot
 * be deduped — matches manual recovery_logs). Never throws.
 *
 * Contract: all `source_ref`-bearing rows in one call share `coach_id` + `source`
 * (true for one reading group / one approval). The existence probe uses the first
 * such row's coach/source.
 */
export async function insertObservationsIfAbsent(
  supabase: SupabaseClient,
  rows: ObservationInsert[]
): Promise<InsertObservationsResult> {
  if (rows.length === 0) return { inserted: 0, skipped: 0, error: null }

  try {
    const keyed = rows.filter((r) => r.source_ref != null)
    const unkeyed = rows.filter((r) => r.source_ref == null)

    const existing = new Set<string>()
    if (keyed.length > 0) {
      const { coach_id, source } = keyed[0]
      const refs = keyed.map((r) => r.source_ref as string)
      const { data, error } = await supabase
        .from("observations")
        .select("source_ref")
        .eq("coach_id", coach_id)
        .eq("source", source)
        .in("source_ref", refs)
      if (error) return { inserted: 0, skipped: 0, error: error.message }
      for (const d of data ?? []) existing.add(d.source_ref as string)
    }

    const toInsert = [
      ...unkeyed,
      ...keyed.filter((r) => !existing.has(r.source_ref as string)),
    ]
    const skipped = rows.length - toInsert.length
    if (toInsert.length === 0) return { inserted: 0, skipped, error: null }

    const { error } = await supabase.from("observations").insert(toInsert)
    if (error) return { inserted: 0, skipped, error: error.message }
    return { inserted: toInsert.length, skipped, error: null }
  } catch (e) {
    return {
      inserted: 0,
      skipped: 0,
      error: e instanceof Error ? e.message : "observation insert failed",
    }
  }
}
