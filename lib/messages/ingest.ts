// ============================================================================
// Shared ingest core — match → classify → persist. Used by every source
// (manual CSV/JSON paste, Gmail, future SMS/WhatsApp adapters) so they all
// produce the same pending suggestions. Server-only.
// ============================================================================

import "server-only"

import { randomUUID } from "node:crypto"

import { requireCoach } from "@/lib/auth"
import { createServerSupabase } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { getBypassClients } from "@/lib/dev-roster-store"
import { addCreatedSuggestions } from "@/lib/dev-inbox-store"
import { analyzeMessage } from "@/lib/messages/analyze"
import { matchAthlete, type MatchClient } from "@/lib/messages/match"
import type { ParsedMessage } from "@/lib/messages/parse"
import { fullName } from "@/lib/utils/format"
import type { ReviewQueueItem } from "@/types/models"
import type { Json } from "@/types/database"

/** A non-persisting preview of what one message would produce (dry-run). */
export interface IngestPreviewItem {
  senderLabel: string | null
  clientId: string | null
  matched: boolean
  suggestions: { domain: string; intent: string | null }[]
}

export interface IngestSummary {
  messageCount: number
  suggestionCount: number
  matched: number
  errors: string[]
  /** Present only when opts.dryRun — nothing was written. */
  dryRun?: boolean
  preview?: IngestPreviewItem[]
}

export interface IngestOptions {
  /**
   * System-context coach id (cron/webhook/bridge). When set, the service-role
   * client is used and Clerk is not consulted — appropriate only for trusted
   * callers (e.g. the Gmail cron, the iMessage bridge) that have already
   * authenticated and resolved which coach they act for.
   */
  coachId?: string
  /**
   * Analyze + match but persist nothing. Returns the would-be suggestion counts
   * and a per-message preview. Athlete data is never written either way — this
   * just skips even the pending-suggestion inserts.
   */
  dryRun?: boolean
}

function ingestBypass(messages: ParsedMessage[], dryRun = false): IngestSummary {
  const roster: MatchClient[] = getBypassClients().map((c) => ({
    id: c.id, first_name: c.first_name, last_name: c.last_name, email: c.email, phone: c.phone,
  }))
  const nameById = new Map(roster.map((c) => [c.id, fullName(c.first_name, c.last_name)]))
  let matched = 0
  const preview: IngestPreviewItem[] = []
  const created: ReviewQueueItem[] = []
  for (const m of messages) {
    const match = matchAthlete({ name: m.senderName, phone: m.senderPhone, email: m.senderEmail }, roster)
    if (match.clientId) matched++
    const analyzed = analyzeMessage(m.body, { matched: !!match.clientId })
    if (dryRun) {
      preview.push({
        senderLabel: m.senderPhone ?? m.senderEmail ?? m.senderName ?? null,
        clientId: match.clientId, matched: !!match.clientId,
        suggestions: analyzed.map((s) => ({ domain: s.domain, intent: s.intent })),
      })
      continue
    }
    for (const s of analyzed) {
      created.push({
        id: randomUUID(),
        domain: s.domain, intent: s.intent, suggestedProtocol: s.suggestedProtocol,
        confidence: s.confidence, sensitive: s.sensitive, status: "pending",
        details: s.details ?? null,
        clientId: match.clientId,
        athleteName: match.clientId ? nameById.get(match.clientId) ?? null : null,
        matchMethod: match.method, matchConfidence: match.confidence,
        source: m.source, senderLabel: m.senderPhone ?? m.senderEmail ?? m.senderName ?? null,
        messageSnippet: m.body.slice(0, 280), receivedAt: m.receivedAt, createdAt: new Date().toISOString(),
      })
    }
  }
  if (dryRun) {
    const suggestionCount = preview.reduce((n, p) => n + p.suggestions.length, 0)
    return { messageCount: messages.length, suggestionCount, matched, errors: [], dryRun: true, preview }
  }
  addCreatedSuggestions(created)
  return { messageCount: messages.length, suggestionCount: created.length, matched, errors: [] }
}

/** Match, classify, and persist a batch of normalized messages. Never throws. */
export async function runIngest(
  messages: ParsedMessage[],
  priorErrors: string[] = [],
  opts: IngestOptions = {}
): Promise<IngestSummary> {
  const dryRun = !!opts.dryRun
  if (DEV_AUTH_BYPASS) {
    const r = ingestBypass(messages, dryRun)
    return { ...r, errors: [...priorErrors, ...r.errors] }
  }

  const errors = [...priorErrors]
  // Interactive callers resolve identity via Clerk (RLS client). Trusted system
  // callers pass coachId and use the service-role client.
  const { coachId, supabase } = opts.coachId
    ? { coachId: opts.coachId, supabase: createAdminSupabase() }
    : { coachId: (await requireCoach()).id, supabase: await createServerSupabase() }

  const { data: clients } = await supabase
    .from("clients").select("id, first_name, last_name, email, phone").eq("coach_id", coachId)
  const roster = (clients ?? []) as MatchClient[]
  let matched = 0
  let suggestionCount = 0
  const preview: IngestPreviewItem[] = []

  for (const m of messages) {
    const match = matchAthlete({ name: m.senderName, phone: m.senderPhone, email: m.senderEmail }, roster)
    if (match.clientId) matched++
    const sourceHandle = m.senderPhone ?? m.senderEmail ?? null

    // Dry-run: analyze + match only, persist nothing (not even pending rows).
    if (dryRun) {
      const analyzed = analyzeMessage(m.body, { matched: !!match.clientId })
      suggestionCount += analyzed.length
      preview.push({
        senderLabel: sourceHandle ?? m.senderName ?? null,
        clientId: match.clientId, matched: !!match.clientId,
        suggestions: analyzed.map((s) => ({ domain: s.domain, intent: s.intent })),
      })
      continue
    }

    const { data: msg, error: msgErr } = await supabase
      .from("message_ingest")
      .insert({
        coach_id: coachId, client_id: match.clientId, source: m.source,
        external_id: m.externalId, sender_name: m.senderName, sender_phone: m.senderPhone,
        sender_email: m.senderEmail, body: m.body, received_at: m.receivedAt,
        match_method: match.method, match_confidence: match.confidence,
      })
      .select("id").single()
    if (msgErr || !msg) { errors.push(`Message skipped: ${msgErr?.message ?? "insert failed"}`); continue }
    const suggestions = analyzeMessage(m.body, { matched: !!match.clientId })
    if (suggestions.length) {
      const { error: sErr } = await supabase.from("suggested_actions").insert(
        suggestions.map((s) => ({
          coach_id: coachId, client_id: match.clientId, message_id: msg.id,
          domain: s.domain, intent: s.intent, suggested_protocol: s.suggestedProtocol,
          confidence: s.confidence, sensitive: s.sensitive, status: "pending" as const,
          details: (s.details ?? null) as Json,
          source_message_id: m.externalId, source_timestamp: m.receivedAt, source_handle: sourceHandle,
        }))
      )
      if (sErr) errors.push(`Suggestions skipped: ${sErr.message}`)
      else suggestionCount += suggestions.length
    }
  }

  if (dryRun) {
    return { messageCount: messages.length, suggestionCount, matched, errors, dryRun: true, preview }
  }
  return { messageCount: messages.length, suggestionCount, matched, errors }
}
