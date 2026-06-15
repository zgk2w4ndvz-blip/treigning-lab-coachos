"use server"

import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"

import { requireCoach } from "@/lib/auth"
import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { getBypassClients } from "@/lib/dev-roster-store"
import {
  addCreatedSuggestions,
  setSuggestionOverride,
} from "@/lib/dev-inbox-store"
import { classifyMessage } from "@/lib/messages/classify"
import { matchAthlete, type MatchClient } from "@/lib/messages/match"
import { parseMessages } from "@/lib/messages/parse"
import { fullName } from "@/lib/utils/format"
import type { ActionState } from "@/lib/actions/types"
import type { ReviewQueueItem } from "@/types/models"

export interface IngestResult extends ActionState {
  messageCount?: number
  suggestionCount?: number
  matched?: number
  rowErrors?: string[]
}

const AFFECTED = ["/inbox", "/dashboard"]
function revalidate() {
  for (const p of AFFECTED) revalidatePath(p)
}

/** Parse imported messages → match athlete → classify → pending suggestions. */
export async function ingestMessagesAction(
  text: string,
  formatHint?: "csv" | "json"
): Promise<IngestResult> {
  const { messages, errors } = parseMessages(text ?? "", formatHint)
  if (messages.length === 0) {
    return { ok: false, error: errors[0] ?? "No messages found.", rowErrors: errors }
  }

  // Roster for matching.
  let roster: MatchClient[]
  if (DEV_AUTH_BYPASS) {
    roster = getBypassClients().map((c) => ({
      id: c.id, first_name: c.first_name, last_name: c.last_name, email: c.email, phone: c.phone,
    }))
  } else {
    const supabase = await createServerSupabase()
    const coach = await requireCoach()
    const { data } = await supabase
      .from("clients").select("id, first_name, last_name, email, phone").eq("coach_id", coach.id)
    roster = (data ?? []) as MatchClient[]
  }
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
    const supabase = await createServerSupabase()
    const coach = await requireCoach()
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

  revalidate()
  return { ok: true, messageCount: messages.length, suggestionCount, matched, rowErrors: errors }
}

/** Approve (optionally edited) or reject a suggestion. Approval → prescription. */
export async function reviewSuggestionAction(
  id: string,
  decision: "approve" | "reject",
  editedProtocol?: string
): Promise<ActionState> {
  const now = new Date().toISOString()
  const edited = editedProtocol != null && editedProtocol.trim().length > 0

  try {
    if (DEV_AUTH_BYPASS) {
      setSuggestionOverride(id, {
        status: decision === "reject" ? "rejected" : edited ? "edited" : "approved",
        reviewedAt: now,
        editedProtocol: edited ? editedProtocol!.trim() : undefined,
      })
    } else {
      const coach = await requireCoach()
      const supabase = await createServerSupabase()
      if (decision === "reject") {
        const { error } = await supabase
          .from("suggested_actions")
          .update({ status: "rejected", reviewed_by: coach.id, reviewed_at: now })
          .eq("id", id)
        if (error) return { ok: false, error: error.message }
      } else {
        const { data: s, error: sErr } = await supabase
          .from("suggested_actions").select("*").eq("id", id).single()
        if (sErr || !s) return { ok: false, error: sErr?.message ?? "Suggestion not found." }
        if (!s.client_id) return { ok: false, error: "Match this message to an athlete before approving." }
        const protocol = edited ? editedProtocol!.trim() : s.suggested_protocol
        const { data: presc, error: pErr } = await supabase
          .from("prescriptions")
          .insert({
            coach_id: coach.id, client_id: s.client_id, domain: s.domain,
            title: s.intent ?? s.domain, protocol, source_suggestion_id: s.id, status: "active",
          })
          .select("id").single()
        if (pErr || !presc) return { ok: false, error: pErr?.message ?? "Could not create prescription." }
        const { error: uErr } = await supabase
          .from("suggested_actions")
          .update({
            status: edited ? "edited" : "approved", reviewed_by: coach.id,
            reviewed_at: now, prescription_id: presc.id, suggested_protocol: protocol,
          })
          .eq("id", id)
        if (uErr) return { ok: false, error: uErr.message }
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Review failed." }
  }

  revalidate()
  return { ok: true }
}
