// Pure cost estimation. Prices are USD per 1M tokens and are intentionally
// conservative/overridable — confirm against current Anthropic pricing. Used
// only for logging + the per-day spend cap, never for billing.

interface ModelPrice {
  inputPerM: number
  outputPerM: number
}

// Current Claude model prices (input / output per 1M tokens).
const PRICES: Record<string, ModelPrice> = {
  "claude-haiku-4-5": { inputPerM: 1, outputPerM: 5 },
  "claude-sonnet-4-6": { inputPerM: 3, outputPerM: 15 },
  "claude-opus-4-8": { inputPerM: 5, outputPerM: 25 },
  "claude-fable-5": { inputPerM: 10, outputPerM: 50 },
}

// Fallback when a model id is unknown — assume the cheapest (Haiku) tier so
// unknowns don't silently look free, but stay modest.
const DEFAULT_PRICE: ModelPrice = { inputPerM: 1, outputPerM: 5 }

export function modelPrice(model: string): ModelPrice {
  return PRICES[model] ?? DEFAULT_PRICE
}

/** Estimated USD cost for a call. Pure. */
export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const p = modelPrice(model)
  const cost =
    (Math.max(0, promptTokens) / 1_000_000) * p.inputPerM +
    (Math.max(0, completionTokens) / 1_000_000) * p.outputPerM
  // round to 6dp (matches ai_usage.est_cost_usd numeric(10,6))
  return Math.round(cost * 1_000_000) / 1_000_000
}

/** True when running this call would stay within the daily cap. Pure. */
export function withinDailyCap(
  todaySpendUsd: number,
  projectedCallUsd: number,
  capUsd: number
): boolean {
  if (capUsd <= 0) return false // a non-positive cap disables AI spend
  return todaySpendUsd + projectedCallUsd <= capUsd
}
