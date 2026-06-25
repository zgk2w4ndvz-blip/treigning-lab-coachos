import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { estimateCostUsd } from "@/lib/ai/pricing"
import { summarizeRoutingRows, type RoutingStats } from "@/lib/ai/metrics"

// The supabase client is passed in by the caller (runIngest already holds the
// right one — RLS client for interactive coaches, service-role for the bridge),
// so we never reach for the admin client in a user-facing path.
type Supa = SupabaseClient

/** Routing metadata attached to an ai_usage row (AI Router). All optional so
 *  existing callers and the legacy path keep working unchanged. */
export interface RoutingMeta {
  routedToRegex?: boolean
  routedToClaude?: boolean
  cacheHit?: boolean
  confidence?: number | null
  reasonForAi?: string | null
  messageHash?: string | null
}

export interface UsageRecord extends RoutingMeta {
  coachId: string | null
  task: string
  model: string
  promptTokens: number
  completionTokens: number
  ok: boolean
}

/** Sum today's estimated AI spend (UTC day) for a coach. Returns 0 on error. */
export async function getTodaySpendUsd(supabase: Supa, coachId: string | null): Promise<number> {
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  let q = supabase
    .from("ai_usage")
    .select("est_cost_usd")
    .gte("created_at", startOfDay.toISOString())
  q = coachId ? q.eq("coach_id", coachId) : q.is("coach_id", null)
  const { data, error } = await q
  if (error || !data) return 0
  return data.reduce((sum, r) => sum + Number(r.est_cost_usd ?? 0), 0)
}

/** Log one ai_usage row (one per processed message: regex route, fresh Claude
 *  call, or cache hit). Returns the estimated cost. Never throws (best-effort).
 *  Regex/cache rows carry zero tokens → zero cost. */
export async function logUsage(supabase: Supa, rec: UsageRecord): Promise<number> {
  const totalTokens = rec.promptTokens + rec.completionTokens
  const estCost = estimateCostUsd(rec.model, rec.promptTokens, rec.completionTokens)
  try {
    await supabase.from("ai_usage").insert({
      coach_id: rec.coachId,
      task: rec.task,
      model: rec.model,
      prompt_tokens: rec.promptTokens,
      completion_tokens: rec.completionTokens,
      total_tokens: totalTokens,
      est_cost_usd: estCost,
      ok: rec.ok,
      routed_to_regex: rec.routedToRegex ?? false,
      routed_to_claude: rec.routedToClaude ?? false,
      cache_hit: rec.cacheHit ?? false,
      confidence: rec.confidence ?? null,
      reason_for_ai: rec.reasonForAi ?? null,
      message_hash: rec.messageHash ?? null,
    })
  } catch {
    // best-effort; logging failures must never break ingestion
  }
  return estCost
}

/**
 * Routing aggregates for the (future) dashboard — Claude%, regex%, avg
 * confidence, cache-hit rate, cost saved, messages routed. Reads ai_usage since
 * `sinceISO`. Returns zeros on error. Backend only; no UI in this change.
 */
export async function getRoutingStats(
  supabase: Supa,
  sinceISO: string,
  coachId?: string | null
): Promise<RoutingStats> {
  try {
    let q = supabase
      .from("ai_usage")
      .select("routed_to_regex, routed_to_claude, cache_hit, confidence, est_cost_usd")
      .gte("created_at", sinceISO)
    if (coachId !== undefined) {
      q = coachId ? q.eq("coach_id", coachId) : q.is("coach_id", null)
    }
    const { data, error } = await q
    if (error || !data) return summarizeRoutingRows([])
    return summarizeRoutingRows(data)
  } catch {
    return summarizeRoutingRows([])
  }
}
