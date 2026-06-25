// Pure cost estimation. Prices are USD per 1M tokens and are intentionally
// conservative/overridable — confirm against current OpenAI pricing. Used only
// for logging + the per-day spend cap, never for billing.

interface ModelPrice {
  inputPerM: number
  outputPerM: number
}

const PRICES: Record<string, ModelPrice> = {
  "gpt-4o-mini": { inputPerM: 0.15, outputPerM: 0.6 },
  "gpt-4.1-mini": { inputPerM: 0.4, outputPerM: 1.6 },
  "gpt-4o": { inputPerM: 2.5, outputPerM: 10 },
  "gpt-4.1": { inputPerM: 2, outputPerM: 8 },
}

// Fallback when a model id is unknown — assume a small-model price so unknowns
// don't silently look free, but stay modest.
const DEFAULT_PRICE: ModelPrice = { inputPerM: 0.5, outputPerM: 1.5 }

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
