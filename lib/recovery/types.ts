// ============================================================================
// Recovery sync — canonical types shared by the ingestion engine and every
// connector. A connector (TreigningLab today; Whoop/Oura/Garmin/… later) emits
// RecoverySample[] in this shape; the engine matches the athlete and turns each
// sample into a PENDING suggested_action (coach approval — never auto-written).
// ============================================================================

/** External-system identity for an athlete, used for deterministic matching. */
export interface ExternalAthlete {
  /** The connector's own stable id for the athlete (preferred match key). */
  id?: string | null
  email?: string | null
  phone?: string | null
  name?: string | null
}

/** The superset of recovery metrics any connector might provide. Each connector
 *  fills only what it has; everything is optional + nullable. */
export interface RecoveryMetrics {
  recoveryScore?: number | null
  hrvRmssd?: number | null
  restingHr?: number | null
  hydration?: number | null
  hydrationStandard?: number | null
  hrvAnomaly?: boolean | null
  trendHrvAnomaly?: boolean | null
  mentalHealthAnomaly?: boolean | null
  // Not exposed by TreigningLab today, but reserved so future wearable
  // connectors (Whoop/Oura/Garmin/…) plug in without a type change.
  sleepHours?: number | null
  sleepQuality?: number | null
  readiness?: number | null
  soreness?: number | null
  fatigue?: number | null
  bodyBattery?: number | null
}

/** One athlete-day of recovery data from one connector. The unit of idempotency
 *  is (connector, external athlete, date). */
export interface RecoverySample {
  connector: string
  external: ExternalAthlete
  /** Calendar day the metrics belong to (YYYY-MM-DD). */
  date: string
  metrics: RecoveryMetrics
  notes?: string | null
  /** Provider timestamp (ISO), if known. */
  measuredAt?: string | null
}

/** The contract a connector implements (runs wherever auth lives — e.g. the
 *  local agent for session-based providers, or a server cron for token-based
 *  ones). It only PRODUCES samples; matching + persistence are the engine's job. */
export interface RecoveryConnector {
  readonly id: string
  /** Fetch samples newer than `sinceISO` (incremental); omit for a full pull. */
  fetchSamples(opts: { sinceISO?: string | null }): Promise<RecoverySample[]>
}
