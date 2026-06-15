import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { requireCoach } from "@/lib/auth"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import {
  getCreatedSuggestions,
  getSuggestionOverrides,
} from "@/lib/dev-inbox-store"
import { mockReviewQueue } from "@/lib/mock/inbox"
import { fullName } from "@/lib/utils/format"
import type { InboxData, InboxStats, ReviewQueueItem } from "@/types/models"

function computeStats(items: ReviewQueueItem[]): InboxStats {
  return {
    pending: items.filter((i) => i.status === "pending").length,
    sensitive: items.filter((i) => i.sensitive && i.status === "pending").length,
    unmatched: items.filter((i) => i.matchMethod === "unmatched" && i.status === "pending").length,
    approved: items.filter((i) => i.status === "approved" || i.status === "edited").length,
    rejected: items.filter((i) => i.status === "rejected").length,
  }
}

function bypass(): InboxData {
  const overrides = getSuggestionOverrides()
  const base = [...getCreatedSuggestions(), ...mockReviewQueue()]
  const items = base.map((s) => {
    const o = overrides[s.id]
    return o
      ? { ...s, status: o.status, suggestedProtocol: o.editedProtocol ?? s.suggestedProtocol }
      : s
  })
  return { items, stats: computeStats(items) }
}

async function real(): Promise<InboxData> {
  const coach = await requireCoach()
  const supabase = await createServerSupabase()
  const { data: suggestions } = await supabase
    .from("suggested_actions")
    .select("*")
    .eq("coach_id", coach.id)
    .order("created_at", { ascending: false })

  const rows = suggestions ?? []
  const messageIds = [...new Set(rows.map((r) => r.message_id))]
  const clientIds = [...new Set(rows.map((r) => r.client_id).filter(Boolean))] as string[]

  const [{ data: messages }, { data: clients }] = await Promise.all([
    messageIds.length
      ? supabase.from("message_ingest").select("*").in("id", messageIds)
      : Promise.resolve({ data: [] as never[] }),
    clientIds.length
      ? supabase.from("clients").select("id, first_name, last_name").in("id", clientIds)
      : Promise.resolve({ data: [] as never[] }),
  ])
  const msgById = new Map((messages ?? []).map((m) => [m.id, m]))
  const nameById = new Map((clients ?? []).map((c) => [c.id, fullName(c.first_name, c.last_name)]))

  const items: ReviewQueueItem[] = rows.map((r) => {
    const m = msgById.get(r.message_id)
    return {
      id: r.id,
      domain: r.domain,
      intent: r.intent,
      suggestedProtocol: r.suggested_protocol,
      confidence: r.confidence,
      sensitive: r.sensitive,
      status: r.status,
      clientId: r.client_id,
      athleteName: r.client_id ? nameById.get(r.client_id) ?? null : null,
      matchMethod: m?.match_method ?? "unmatched",
      matchConfidence: m?.match_confidence ?? 0,
      source: m?.source ?? "manual",
      senderLabel: m?.sender_phone ?? m?.sender_email ?? m?.sender_name ?? null,
      messageSnippet: m?.body ?? "",
      receivedAt: m?.received_at ?? null,
      createdAt: r.created_at,
    }
  })
  return { items, stats: computeStats(items) }
}

/** The coach's message-ingestion review queue + summary stats. */
export async function getInbox(): Promise<InboxData> {
  return DEV_AUTH_BYPASS ? bypass() : real()
}

/** Just the pending count — for the sidebar badge (cheap). */
export async function getInboxPendingCount(): Promise<number> {
  if (DEV_AUTH_BYPASS) return bypass().stats.pending
  const coach = await requireCoach()
  const supabase = await createServerSupabase()
  const { count } = await supabase
    .from("suggested_actions")
    .select("id", { count: "exact", head: true })
    .eq("coach_id", coach.id)
    .eq("status", "pending")
  return count ?? 0
}
