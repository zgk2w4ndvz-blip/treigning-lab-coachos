import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { aiStructuredJson } from "@/lib/ai/call"
import { parseAiSuggestions } from "@/lib/ai/parse"
import { AI_EXTRACTION_JSON_SCHEMA } from "@/lib/ai/schema"
import { EXTRACTION_SYSTEM, buildExtractionUserPrompt } from "@/lib/ai/prompts/extraction"
import type { ClassifiedSuggestion } from "@/lib/messages/classify"

export interface AiExtractContext {
  coachId: string | null
  direction: "incoming" | "outgoing"
  athleteFirstName?: string | null
}

/**
 * AI message extraction → ClassifiedSuggestion[] (same shape as the regex
 * extractors). Returns null when AI is disabled / capped / fails / returns an
 * invalid response, so the caller falls back to the deterministic path. Output
 * still becomes PENDING suggested_actions — never auto-applied.
 */
export async function aiExtractSuggestions(
  supabase: SupabaseClient,
  body: string,
  ctx: AiExtractContext
): Promise<ClassifiedSuggestion[] | null> {
  const text = (body ?? "").trim()
  if (!text) return null

  const raw = await aiStructuredJson({
    supabase,
    coachId: ctx.coachId,
    task: "message_extraction",
    system: EXTRACTION_SYSTEM,
    userPrompt: buildExtractionUserPrompt(text, {
      direction: ctx.direction,
      athleteFirstName: ctx.athleteFirstName,
    }),
    schemaName: "message_extraction",
    jsonSchema: AI_EXTRACTION_JSON_SCHEMA,
  })
  if (raw === null) return null

  return parseAiSuggestions(raw, { incoming: ctx.direction === "incoming" })
}
