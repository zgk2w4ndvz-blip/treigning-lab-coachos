import "server-only"

// Provider abstraction for the AI extraction layer. The rest of the app calls
// `aiStructuredJson` (lib/ai/call.ts) and never imports a vendor SDK directly —
// swapping providers means adding one module here, nothing downstream changes.

import { getAiConfig } from "@/lib/ai/config"
import { getAnthropicProvider } from "@/lib/ai/anthropic"

/** A single structured-JSON request, provider-agnostic. */
export interface StructuredJsonArgs {
  model: string
  system: string
  userPrompt: string
  /** Tool/schema name surfaced to the model. */
  schemaName: string
  /** JSON Schema describing the expected object (used to constrain output). */
  jsonSchema: Record<string, unknown>
  maxOutputTokens: number
  timeoutMs: number
  maxRetries: number
}

export interface StructuredJsonResult {
  /** The parsed JSON object the model returned, or null when none/invalid. */
  parsed: unknown | null
  promptTokens: number
  completionTokens: number
}

export interface AiProvider {
  /** Short identifier for logging (e.g. "anthropic"). */
  readonly name: string
  /** Make ONE structured-JSON call. Implementations may throw — call.ts catches
   *  and falls back to the deterministic path. */
  structuredJson(args: StructuredJsonArgs): Promise<StructuredJsonResult>
}

/**
 * The configured provider, or null when no API key is present. The kill switch
 * (AI_ENABLED) is enforced separately in call.ts, before this is consulted.
 */
export function getProvider(): AiProvider | null {
  const cfg = getAiConfig()
  if (!cfg.apiKey) return null
  return getAnthropicProvider(cfg.apiKey)
}
