"use server"

import { requireCoach } from "@/lib/auth"
import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { generateCoachDraft, draftReplyTemplate } from "@/lib/ai/draft"

export interface DraftReplyInput {
  messageBody: string
  athleteFirstName?: string | null
  /** Short labels of what the message contains (from the suggestion cards). */
  suggestionSummaries?: string[]
}

export type DraftReplyResult =
  | { ok: true; draft: string; source: "ai" | "template" }
  | { ok: false; error: string }

/**
 * Generate a DRAFT reply in the coach's voice for an inbound athlete message.
 * Draft only — it is never sent and never writes athlete data. AI is gated by
 * the shared cost controls; a deterministic template is used when AI is
 * off/capped/unavailable.
 */
export async function draftReplyAction(input: DraftReplyInput): Promise<DraftReplyResult> {
  const body = (input.messageBody ?? "").trim()
  if (!body) return { ok: false, error: "No message to reply to." }

  const ctx = {
    athleteFirstName: input.athleteFirstName ?? null,
    messageBody: body,
    suggestionSummaries: input.suggestionSummaries ?? [],
  }

  try {
    // Dev bypass has no live DB / auth; AI is off anyway → deterministic template.
    if (DEV_AUTH_BYPASS) {
      return { ok: true, draft: draftReplyTemplate(ctx), source: "template" }
    }

    const coach = await requireCoach()
    const supabase = await createServerSupabase()

    // Coach voice examples: their own recent outbound messages (style only).
    const { data: outbound } = await supabase
      .from("message_ingest")
      .select("body, received_at, direction")
      .eq("coach_id", coach.id)
      .eq("direction", "outgoing")
      .order("received_at", { ascending: false })
      .limit(5)
    const voiceExamples = (outbound ?? []).map((r) => r.body as string).filter((b) => b && b.trim())

    const draft = await generateCoachDraft(supabase, {
      coachId: coach.id,
      ...ctx,
      voiceExamples,
    })
    return { ok: true, draft: draft.text, source: draft.source }
  } catch {
    // Never fail hard — fall back to the deterministic template.
    return { ok: true, draft: draftReplyTemplate(ctx), source: "template" }
  }
}
