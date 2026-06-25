// Pure routing-metrics summarization for the (future) AI Router dashboard.
// No I/O: takes ai_usage rows and computes the displayed aggregates. The query
// that loads the rows lives in lib/ai/usage.ts (getRoutingStats).

/** The ai_usage columns the metrics need. Each processed message logs exactly
 *  one row that is a regex route, a fresh Claude call, or a cache hit. */
export interface RoutingRow {
  routed_to_regex: boolean
  routed_to_claude: boolean
  cache_hit: boolean
  confidence: number | null
  est_cost_usd: number
}

export interface RoutingStats {
  total: number
  /** Fresh Claude API calls (routed_to_claude && !cache_hit). */
  claudeCalls: number
  regexRoutes: number
  cacheHits: number
  /** Fraction (0..1). */
  claudePct: number
  regexPct: number
  cacheHitRate: number
  avgConfidence: number
  /** Actual spend (sum est_cost_usd). */
  estCostUsd: number
  /** Avoided Claude calls (regex routes + cache hits) × average Claude cost. */
  estCostSavedUsd: number
}

const round4 = (n: number) => Math.round(n * 10000) / 10000
const round6 = (n: number) => Math.round(n * 1_000_000) / 1_000_000
const pct = (n: number, d: number) => (d > 0 ? round4(n / d) : 0)

export function summarizeRoutingRows(rows: RoutingRow[]): RoutingStats {
  let claudeCalls = 0
  let regexRoutes = 0
  let cacheHits = 0
  let confSum = 0
  let confCount = 0
  let costSum = 0
  let claudeCostSum = 0

  for (const r of rows) {
    const cost = Number(r.est_cost_usd ?? 0)
    costSum += cost
    if (r.cache_hit) {
      cacheHits++
    } else if (r.routed_to_claude) {
      claudeCalls++
      claudeCostSum += cost
    } else if (r.routed_to_regex) {
      regexRoutes++
    }
    if (r.confidence != null) {
      confSum += Number(r.confidence)
      confCount++
    }
  }

  const total = rows.length
  const avgClaudeCost = claudeCalls > 0 ? claudeCostSum / claudeCalls : 0
  const avoidedCalls = regexRoutes + cacheHits

  return {
    total,
    claudeCalls,
    regexRoutes,
    cacheHits,
    claudePct: pct(claudeCalls, total),
    regexPct: pct(regexRoutes, total),
    cacheHitRate: pct(cacheHits, claudeCalls + cacheHits),
    avgConfidence: confCount > 0 ? round4(confSum / confCount) : 0,
    estCostUsd: round6(costSum),
    estCostSavedUsd: round6(avoidedCalls * avgClaudeCost),
  }
}
