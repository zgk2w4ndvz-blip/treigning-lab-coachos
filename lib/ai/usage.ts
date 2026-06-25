import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { estimateCostUsd } from "@/lib/ai/pricing"

// The supabase client is passed in by the caller (runIngest already holds the
// right one — RLS client for interactive coaches, service-role for the bridge),
// so we never reach for the admin client in a user-facing path.
type Supa = SupabaseClient

export interface UsageRecord {
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

/** Log one AI call to the ai_usage ledger. Never throws (best-effort). */
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
    })
  } catch {
    // best-effort; logging failures must never break ingestion
  }
  return estCost
}
