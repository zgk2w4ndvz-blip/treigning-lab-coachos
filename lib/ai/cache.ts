import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { ClassifiedSuggestion } from "@/lib/messages/classify"
import type { Json } from "@/types/database"

// Content-hash extraction cache (ai_extraction_cache). Keyed by (message_hash,
// model). Best-effort: ANY error — including the table not existing before
// migration 0023 is applied — is treated as a cache miss, so routing keeps
// working and simply doesn't cache.

type Supa = SupabaseClient

/** Cached suggestions for (hash, model), or null on miss/error. */
export async function getCachedExtraction(
  supabase: Supa,
  messageHash: string,
  model: string
): Promise<ClassifiedSuggestion[] | null> {
  try {
    const { data, error } = await supabase
      .from("ai_extraction_cache")
      .select("suggestions")
      .eq("message_hash", messageHash)
      .eq("model", model)
      .maybeSingle()
    if (error || !data) return null
    return (data.suggestions as unknown as ClassifiedSuggestion[]) ?? null
  } catch {
    return null
  }
}

/** Store an extraction result. Idempotent (does nothing on conflict). Never
 *  throws. */
export async function putCachedExtraction(
  supabase: Supa,
  args: {
    messageHash: string
    model: string
    coachId: string | null
    suggestions: ClassifiedSuggestion[]
  }
): Promise<void> {
  try {
    await supabase.from("ai_extraction_cache").upsert(
      {
        message_hash: args.messageHash,
        model: args.model,
        coach_id: args.coachId,
        suggestions: args.suggestions as unknown as Json,
      },
      { onConflict: "message_hash,model", ignoreDuplicates: true }
    )
  } catch {
    // best-effort; caching failures must never break ingestion
  }
}
