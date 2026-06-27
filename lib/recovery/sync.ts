import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { matchRecoveryAthlete } from "@/lib/recovery/match"
import { recoverySampleToSuggestion, recoverySourceKey } from "@/lib/recovery/to-suggestions"
import type { RecoverySample } from "@/lib/recovery/types"
import type { MatchClient } from "@/lib/messages/match"
import type { Json, MessageMatch } from "@/types/database"

// Generic recovery-sync engine. Connector-agnostic: it receives normalized
// RecoverySample[] (from any connector/producer) and turns each into a PENDING
// suggested_action via a synthetic message_ingest row, so synced recovery data
// flows through the SAME coach-approval pipeline as messages. Never auto-writes
// athlete records. Idempotent per (connector, external athlete, date) via
// recovery_sync_state. Never throws — returns a summary with any errors.

type Supa = SupabaseClient

export interface RecoverySyncOptions {
  /** Analyze + match only; persist nothing. */
  dryRun?: boolean
}

export interface RecoverySyncSummary {
  connector: string
  total: number
  matched: number
  unmatched: number
  /** Pending recovery suggestions created. */
  created: number
  /** Already synced before (idempotent skip). */
  skipped: number
  errors: string[]
  dryRun?: boolean
  preview?: { externalId: string; date: string; matched: boolean; willCreate: boolean }[]
}

/** A valid message_ingest.match_method for the synthetic row. */
function asMessageMatch(method: string): MessageMatch {
  return method === "email" || method === "phone" || method === "name"
    ? (method as MessageMatch)
    : "name" // "map" matched by a stored mapping — record as a name-like identity match
}

function extKeyOf(s: RecoverySample): string | null {
  return s.external.id ?? s.external.email ?? s.external.phone ?? s.external.name ?? null
}

export async function runRecoverySync(
  supabase: Supa,
  coachId: string,
  connector: string,
  samples: RecoverySample[],
  opts: RecoverySyncOptions = {}
): Promise<RecoverySyncSummary> {
  const dryRun = !!opts.dryRun
  const errors: string[] = []
  let matched = 0
  let unmatched = 0
  let created = 0
  let skipped = 0
  const preview: RecoverySyncSummary["preview"] = dryRun ? [] : undefined

  // Roster + established external→client map (connector-scoped).
  const { data: clients } = await supabase
    .from("clients")
    .select("id, first_name, last_name, email, phone")
    .eq("coach_id", coachId)
  const roster = (clients ?? []) as MatchClient[]

  const externalMap = new Map<string, string>()
  const { data: maps } = await supabase
    .from("external_athlete_map")
    .select("external_id, client_id")
    .eq("coach_id", coachId)
    .eq("connector", connector)
  for (const m of maps ?? []) externalMap.set(m.external_id as string, m.client_id as string)

  let maxDate: string | null = null

  for (const sample of samples) {
    const extKey = extKeyOf(sample)
    if (!extKey || !sample.date) {
      errors.push("Sample skipped: missing external id or date")
      continue
    }
    if (sample.date > (maxDate ?? "")) maxDate = sample.date

    const match = matchRecoveryAthlete(sample.external, roster, externalMap)
    if (match.clientId) matched++
    else unmatched++
    const suggestion = recoverySampleToSuggestion(sample)
    const willCreate = !!match.clientId && !!suggestion

    if (dryRun) {
      preview!.push({ externalId: extKey, date: sample.date, matched: !!match.clientId, willCreate })
      continue
    }

    // Idempotency: skip if this (connector, athlete, day) was already synced.
    const { data: existing } = await supabase
      .from("recovery_sync_state")
      .select("connector")
      .eq("coach_id", coachId)
      .eq("connector", connector)
      .eq("external_athlete_id", extKey)
      .eq("sample_date", sample.date)
      .maybeSingle()
    if (existing) {
      skipped++
      continue
    }

    let suggestedActionId: string | null = null

    if (match.clientId && suggestion) {
      // Record a newly auto-discovered mapping so future syncs are stable.
      if (match.method !== "map" && sample.external.id) {
        await supabase
          .from("external_athlete_map")
          .upsert(
            { coach_id: coachId, connector, external_id: sample.external.id, client_id: match.clientId, manual: false },
            { onConflict: "coach_id,connector,external_id", ignoreDuplicates: true }
          )
        externalMap.set(sample.external.id, match.clientId)
      }

      const srcKey = recoverySourceKey(sample)
      const receivedAt = sample.measuredAt ?? `${sample.date}T00:00:00Z`
      // Synthetic message so the suggestion uses the existing inbox/approval UI.
      const { data: msg, error: msgErr } = await supabase
        .from("message_ingest")
        .upsert(
          {
            coach_id: coachId, client_id: match.clientId, source: "json",
            external_id: srcKey, body: String(suggestion.suggestedProtocol),
            received_at: receivedAt, direction: "incoming",
            match_method: asMessageMatch(match.method), match_confidence: 1,
          },
          { onConflict: "coach_id,source,external_id", ignoreDuplicates: false }
        )
        .select("id")
        .single()
      if (msgErr || !msg) {
        errors.push(`Recovery message skipped (${extKey} ${sample.date}): ${msgErr?.message ?? "insert failed"}`)
        continue
      }

      const { data: sa, error: saErr } = await supabase
        .from("suggested_actions")
        .insert({
          coach_id: coachId, client_id: match.clientId, message_id: msg.id,
          domain: "recovery", intent: suggestion.intent,
          suggested_protocol: suggestion.suggestedProtocol,
          confidence: suggestion.confidence, sensitive: suggestion.sensitive,
          status: "pending" as const,
          details: { ...(suggestion.details ?? {}), recovery_match: match.method } as Json,
          source_message_id: srcKey, source_timestamp: receivedAt, source_handle: connector,
        })
        .select("id")
        .single()
      if (saErr || !sa) {
        errors.push(`Recovery suggestion skipped (${extKey} ${sample.date}): ${saErr?.message ?? "insert failed"}`)
        continue
      }
      suggestedActionId = sa.id
      created++
    }

    // Record sync state (idempotency + cursor) for matched, unmatched, and
    // metric-less samples alike, so none are reprocessed.
    const { error: stErr } = await supabase.from("recovery_sync_state").upsert(
      {
        coach_id: coachId, connector, external_athlete_id: extKey, sample_date: sample.date,
        client_id: match.clientId, suggested_action_id: suggestedActionId, matched: !!match.clientId,
      },
      { onConflict: "coach_id,connector,external_athlete_id,sample_date", ignoreDuplicates: true }
    )
    if (stErr) errors.push(`Sync state skipped (${extKey} ${sample.date}): ${stErr.message}`)
  }

  if (!dryRun) {
    await supabase.from("sync_connectors").upsert(
      { coach_id: coachId, connector, last_run_at: new Date().toISOString(), last_cursor: maxDate, updated_at: new Date().toISOString() },
      { onConflict: "coach_id,connector" }
    )
  }

  return {
    connector,
    total: samples.length,
    matched,
    unmatched,
    created,
    skipped,
    errors,
    ...(dryRun ? { dryRun: true, preview } : {}),
  }
}
