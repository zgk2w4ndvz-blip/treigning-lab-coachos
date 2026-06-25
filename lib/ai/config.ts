// AI configuration — read from env. The feature is OFF unless AI_ENABLED=true
// AND a key is present. All values are server-side (no NEXT_PUBLIC).

export interface AiConfig {
  enabled: boolean
  apiKey: string | null
  extractModel: string
  maxOutputTokens: number
  dailyUsdCap: number
  logUsage: boolean
}

function num(v: string | undefined, fallback: number): number {
  const n = v != null ? Number(v) : NaN
  return Number.isFinite(n) ? n : fallback
}

export function getAiConfig(): AiConfig {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim() || null
  const enabled = process.env.AI_ENABLED === "true" && !!apiKey
  return {
    enabled,
    apiKey,
    // Cheap, structured-output-capable Claude model for high-volume extraction.
    // Overridable via AI_MODEL_EXTRACT (any Claude model id works).
    extractModel: process.env.AI_MODEL_EXTRACT?.trim() || "claude-haiku-4-5",
    maxOutputTokens: num(process.env.AI_MAX_OUTPUT_TOKENS, 700),
    dailyUsdCap: num(process.env.AI_DAILY_USD_CAP, 2),
    logUsage: process.env.AI_LOG_USAGE !== "false",
  }
}
