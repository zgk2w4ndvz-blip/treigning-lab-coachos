import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { getAiConfig } from "@/lib/ai/config"
import { getOpenAi } from "@/lib/ai/client"
import { estimateCostUsd, withinDailyCap } from "@/lib/ai/pricing"
import { getTodaySpendUsd, logUsage } from "@/lib/ai/usage"

interface AiCallArgs {
  supabase: SupabaseClient
  coachId: string | null
  task: string
  system: string
  userPrompt: string
  schemaName: string
  jsonSchema: Record<string, unknown>
}

/**
 * Run one structured AI call. Enforces the kill switch, the per-day USD cap, a
 * timeout + single retry, logs token usage, and returns the parsed JSON object —
 * or null on ANY problem (disabled / capped / timeout / invalid). Callers treat
 * null as "fall back to the deterministic path". Never throws.
 */
export async function aiStructuredJson(args: AiCallArgs): Promise<unknown | null> {
  const cfg = getAiConfig()
  if (!cfg.enabled) return null
  const client = getOpenAi()
  if (!client) return null

  // Per-day cap: refuse if already at/over, or if a conservative projection of
  // this call would exceed the cap.
  const todaySpend = await getTodaySpendUsd(args.supabase, args.coachId)
  const projected = estimateCostUsd(cfg.extractModel, 1500, cfg.maxOutputTokens)
  if (!withinDailyCap(todaySpend, projected, cfg.dailyUsdCap)) {
    return null
  }

  try {
    const res = await client.responses.create(
      {
        model: cfg.extractModel,
        input: [
          { role: "system", content: args.system },
          { role: "user", content: args.userPrompt },
        ],
        text: {
          format: {
            type: "json_schema",
            name: args.schemaName,
            strict: true,
            schema: args.jsonSchema,
          },
        },
        max_output_tokens: cfg.maxOutputTokens,
      },
      { timeout: 15_000, maxRetries: 1 }
    )

    const promptTokens = res.usage?.input_tokens ?? 0
    const completionTokens = res.usage?.output_tokens ?? 0

    let parsed: unknown = null
    const text = res.output_text
    if (text) {
      try {
        parsed = JSON.parse(text)
      } catch {
        parsed = null
      }
    }

    if (cfg.logUsage) {
      const cost = await logUsage(args.supabase, {
        coachId: args.coachId,
        task: args.task,
        model: cfg.extractModel,
        promptTokens,
        completionTokens,
        ok: parsed !== null,
      })
      console.log(
        `[ai] ${args.task} model=${cfg.extractModel} in=${promptTokens} out=${completionTokens} ~$${cost.toFixed(6)}`
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
      })
    }
    return null
  }
}
