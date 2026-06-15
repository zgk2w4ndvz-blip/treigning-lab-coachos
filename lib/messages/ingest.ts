// ============================================================================
// Shared ingest core — match → classify → persist. Used by every source
// (manual CSV/JSON paste, Gmail, future SMS/WhatsApp adapters) so they all
// produce the same pending suggestions. Server-only.
// ============================================================================

import "server-only"

import { randomUUID } from "node:crypto"

import { requireCoach } from "@/lib/auth"
import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { getBypassClients } from "@/lib/dev-roster-store"
import { addCreatedSuggestions } from "@/lib/dev-inbox-store"
import { classifyMessage } from "@/lib/messages/classify"
import { matchAthlete, type MatchClient } from "@/lib/messages/match"
import type { ParsedMessage } from "@/lib/messages/parse"
import { fullName } from "@/lib/utils/format"
import type { ReviewQueueItem } from "@/types/models"

export interface IngestSummary {
  messageCount: number
  suggestionCount: number
  matched: number
  errors: string[]
}

async function loadRoster(): Promise<MatchClient[]> {
  if (DEV_AUTH_BYPASS) {
    return getBypassClients().map((c) => ({
      id: c.id, first_name: c.first_name, last_name: c.last_name, email: c.email, phone: c.phone,
    }))
  }
  const coach = await requireCoach()
  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from("clients")
    .select("id, first_name, last_name, email, phone")
    .eq("coach_id", coach.id)
  return (data ?? []) as MatchClient[]
}

/** Match, classify, and persist a batch of normalized messages. Never throws. */
export async function runIngest(
  messages: ParsedMessage[],
  priorErrors: string[] = []
): Promise<IngestSummary> {
  const errors = [...priorErrors]
  const roster = await loadRoster()
  const nameById = new Map(roster.map((c) => [c.id, fullName(c.first_name, c.last_name)]))
  let matched = 0
  let suggestionCount = 0

  if (DEV_AUTH_BYPASS) {
    const created: ReviewQueueItem[] = []
    for (const m of messages) {
      const match = matchAthlete(
        { name: m.senderName, phone: m.senderPhone, email: m.senderEmail },
        roster
      )
      if (match.clientId) matched++
      for (const s of classifyMessage(m.body)) {
        created.push({
          id: randomUUID(),
          domain: s.domain, intent: s.intent, suggestedProtocol: s.suggestedProtocol,
          confidence: s.confidence, sensitive: s.sensitive, status: "pending",
          clientId: match.clientId,
          athleteName: match.clientId ? nameById.get(match.clientId) ?? null : null,
          matchMethod: match.method, matchConfidence: match.confidence,
          source: m.source, senderLabel: m.senderPhone ?? m.senderEmail ?? m.senderName ?? null,
          messageSnippet: m.body.slice(0, 280), receivedAt: m.receivedAt, createdAt: new Date().toISOString(),
        })
      }
    }
    addCreatedSuggestions(created)
    suggestionCount = created.length
  } else {
    const coach = await requireCoach()
    const supabase = await createServerSupabase()
    for (const m of messages) {
      const match = matchAthlete(
        { name: m.senderName, phone: m.senderPhone, email: m.senderEmail },
        roster
      )
      if (match.clientId) matched++
      const { data: msg, error: msgErr } = await supabase
        .from("message_ingest")
        .insert({
          coach_id: coach.id, client_id: match.clientId, source: m.source,
          external_id: m.externalId, sender_name: m.senderName, sender_phone: m.senderPhone,
          sender_email: m.senderEmail, body: m.body, received_at: m.receivedAt,
          match_method: match.method, match_confidence: match.confidence,
        })
        .select("id").single()
      if (msgErr || !msg) { errors.push(`Message skipped: ${msgErr?.message ?? "insert failed"}`); continue }
      const suggestions = classifyMessage(m.body)
      if (suggestions.length) {
        const { error: sErr } = await supabase.from("suggested_actions").insert(
          suggestions.map((s) => ({
            coach_id: coach.id, client_id: match.clientId, message_id: msg.id,
            domain: s.domain, intent: s.intent, suggested_protocol: s.suggestedProtocol,
            confidence: s.confidence, sensitive: s.sensitive, status: "pending" as const,
          }))
        )
        if (sErr) errors.push(`Suggestions skipped: ${sErr.message}`)
        else suggestionCount += suggestions.length
      }
    }
  }

  return { messageCount: messages.length, suggestionCount, matched, errors }
}
