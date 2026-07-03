import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { aiStructuredJson } from "@/lib/ai/call"
import {
  DRAFT_SYSTEM,
  DRAFT_JSON_SCHEMA,
  buildDraftUserPrompt,
  draftReplyTemplate,
  type DraftPromptContext,
} from "@/lib/ai/prompts/draft"

// Re-export the pure fallback so server callers can import it from here too.
export { draftReplyTemplate }

export interface CoachDraftContext extends DraftPromptContext {
  coachId: string | null
}

export interface CoachDraft {
  text: string
  /** "ai" when the model produced it, "template" for the deterministic fallback. */
  source: "ai" | "template"
}

/**
 * Generate a coach reply DRAFT. Tries the AI path (reusing the shared cost
 * controls — kill switch, per-day cap, timeout/retry, usage logging in
 * aiStructuredJson), and falls back to a deterministic template on any
 * disabled/capped/failed/invalid result. NEVER sends and NEVER writes athlete
 * data — it only returns text for the coach to edit.
 */
export async function generateCoachDraft(
  supabase: SupabaseClient,
  ctx: CoachDraftContext
): Promise<CoachDraft> {
  const raw = await aiStructuredJson({
    supabase,
    coachId: ctx.coachId,
    task: "coach_draft",
    system: DRAFT_SYSTEM,
    userPrompt: buildDraftUserPrompt(ctx),
    schemaName: "coach_draft",
    jsonSchema: DRAFT_JSON_SCHEMA,
  })
  const reply = (raw as { reply?: unknown } | null)?.reply
  if (typeof reply === "string" && reply.trim()) {
    return { text: reply.trim(), source: "ai" }
  }
  return { text: draftReplyTemplate(ctx), source: "template" }
}
