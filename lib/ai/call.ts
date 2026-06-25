import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { getAiConfig } from "@/lib/ai/config"
import { getProvider } from "@/lib/ai/provider"
import { estimateCostUsd, withinDailyCap } from "@/lib/ai/pricing"
import { getTodaySpendUsd, logUsage, type RoutingMeta } from "@/lib/ai/usage"

interface AiCallArgs {
  supabase: SupabaseClient
  coachId: string | null
  task: string
  system: string
  userPrompt: string
  schemaName: string
  jsonSchema: Record<string, unknown>
  /** Router metadata to record on the logged ai_usage row (e.g. confidence,
   *  reason, message_hash). The call is always a fresh Claude call here, so
   *  routedToClaude is forced true. */
  routing?: RoutingMeta
}

/**
 * Run one structured AI call. Enforces the kill switch, the per-day USD cap, a
 * timeout + single retry, logs token usage, and returns the parsed JSON object —
 * or null on ANY problem (disabled / capped / timeout / invalid). Callers treat
 * null as "fall back to the deterministic path". Never throws. Provider-agnostic:
 * the actual vendor call lives behind getProvider() (lib/ai/provider.ts).
 */
export async function aiStructuredJson(args: AiCallArgs): Promise<unknown | null> {
  const cfg = getAiConfig()
  if (!cfg.enabled) return null
  const provider = getProvider()
  if (!provider) return null

  // Per-day cap: refuse if already at/over, or if a conservative projection of
  // this call would exceed the cap.
  const todaySpend = await getTodaySpendUsd(args.supabase, args.coachId)
  const projected = estimateCostUsd(cfg.extractModel, 1500, cfg.maxOutputTokens)
  if (!withinDailyCap(todaySpend, projected, cfg.dailyUsdCap)) {
    return null
  }

  try {
    const { parsed, promptTokens, completionTokens } = await provider.structuredJson({
      model: cfg.extractModel,
      system: args.system,
      userPrompt: args.userPrompt,
      schemaName: args.schemaName,
      jsonSchema: args.jsonSchema,
      maxOutputTokens: cfg.maxOutputTokens,
      timeoutMs: 15_000,
      maxRetries: 1,
    })

    if (cfg.logUsage) {
      const cost = await logUsage(args.supabase, {
        coachId: args.coachId,
        task: args.task,
        model: cfg.extractModel,
        promptTokens,
        completionTokens,
        ok: parsed !== null,
        ...args.routing,
        routedToClaude: true,
      })
      console.log(
        `[ai] ${args.task} provider=${provider.name} model=${cfg.extractModel} in=${promptTokens} out=${completionTokens} ~$${cost.toFixed(6)}`
      )
    }

    return parsed
  } catch (e) {
    console.warn(`[ai] ${args.task} call failed:`, e instanceof Error ? e.message : e)
    if (cfg.logUsage) {
      await logUsage(args.supabase, {
        coachId: args.coachId,
        task: args.task,
        model: cfg.extractModel,
        promptTokens: 0,
        completionTokens: 0,
        ok: false,
        ...args.routing,
        routedToClaude: true,
      })
    }
    return null
  }
}
