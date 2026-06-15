"use server"

import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"

import { requireCoach } from "@/lib/auth"
import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { getCreatedSuggestions, setSuggestionOverride } from "@/lib/dev-inbox-store"
import { addCreatedTask } from "@/lib/dev-tasks-store"
import { mockReviewQueue } from "@/lib/mock/inbox"
import { runIngest } from "@/lib/messages/ingest"
import { parseMessages, type MessageFormat } from "@/lib/messages/parse"
import { fetchGmailMessages } from "@/lib/messages/sources/gmail"
import type { ActionState } from "@/lib/actions/types"
import type { SuggestionDomain } from "@/types/database"
import type { TaskType } from "@/types/models"

const AFFECTED_REVIEW = ["/inbox", "/tasks", "/agenda", "/dashboard"]
function revalidateReview() {
  for (const p of AFFECTED_REVIEW) revalidatePath(p)
}

/** Map a suggestion domain to the closest existing coach-task type. */
const DOMAIN_TASK_TYPE: Record<SuggestionDomain, TaskType> = {
  diet: "nutrition",
  supplementation: "supplements",
  altolab: "training",
  low_base: "training",
  hydration: "hydration",
  recovery: "recovery",
  labs: "general",
  training: "training",
}

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

/** Manual import: parse CSV/JSON → match → classify → pending suggestions. */
export async function ingestMessagesAction(
  text: string,
  formatHint?: MessageFormat
): Promise<IngestResult> {
  const { messages, errors } = parseMessages(text ?? "", formatHint)
  if (messages.length === 0) {
    return { ok: false, error: errors[0] ?? "No messages found.", rowErrors: errors }
  }
  try {
    const r = await runIngest(messages, errors)
    revalidate()
    return { ok: true, messageCount: r.messageCount, suggestionCount: r.suggestionCount, matched: r.matched, rowErrors: r.errors }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ingest failed." }
  }
}

/** Gmail source: fetch recent emails → same ingest pipeline. */
export async function ingestFromGmailAction(opts?: {
  query?: string
  maxResults?: number
}): Promise<IngestResult> {
  let messages
  try {
    messages = await fetchGmailMessages(opts)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gmail fetch failed." }
  }
  if (messages.length === 0) {
    return { ok: true, messageCount: 0, suggestionCount: 0, matched: 0, error: "No new Gmail messages matched the query." }
  }
  try {
    const r = await runIngest(messages)
    revalidate()
    return { ok: true, messageCount: r.messageCount, suggestionCount: r.suggestionCount, matched: r.matched, rowErrors: r.errors }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ingest failed." }
  }
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
      // Approval mints a coach task (alongside the prescription) on the existing
      // tasks board + agenda. Look up the suggestion for its athlete + domain.
      if (decision === "approve") {
        const item = [...getCreatedSuggestions(), ...mockReviewQueue()].find((s) => s.id === id)
        if (item?.clientId) {
          const protocol = edited ? editedProtocol!.trim() : item.suggestedProtocol
          addCreatedTask({
            id: randomUUID(),
            clientId: item.clientId,
            clientName: item.athleteName,
            title: protocol,
            description: `From ${item.source} message: “${item.messageSnippet.slice(0, 140)}”`,
            type: DOMAIN_TASK_TYPE[item.domain],
            status: "open",
            priority: item.sensitive ? "high" : "medium",
            dueDate: null,
            completedAt: null,
            createdAt: now,
          })
        }
      }
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

        // Mint a coach task so the approval shows on /tasks + the agenda.
        await supabase.from("tasks").insert({
          coach_id: coach.id, client_id: s.client_id, title: protocol,
          description: `Approved from a ${s.domain} message suggestion.`,
          priority: s.sensitive ? "high" : "medium", status: "open",
        })
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Review failed." }
  }

  revalidateReview()
  return { ok: true }
}
