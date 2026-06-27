// ============================================================================
// CoachOS L2 Spine — core type stubs  (RFC: ARCHITECTURE_L2_SPINE.md §2, §4)
//
// P0 SCOPE: TYPE-ONLY. No runtime, no implementation, no I/O. These shapes
// describe the future Observation Store row, the connector-emitted sample, and
// the connector contract. They are the agreed interfaces that P1+ will build
// against; nothing imports them into a live path yet.
//
// `metric` keys reference the canonical Metric Registry (./registry). The DB
// table/enum that backs `Observation` is introduced later (P1) — these types are
// deliberately storage-agnostic camelCase app shapes, not DB row types.
// ============================================================================

import type { ObservationDomain, MetricValueKind } from "@/lib/observations/registry"

/** How an observation entered the system (provenance, not a trust grant). */
export type ObservationIngestedVia = "message" | "connector" | "manual" | "coach_entry"

/**
 * One canonical, coach-approved, immutable fact about one athlete at one point
 * in time — the L2 Observation Store row (app shape). Append-only: corrections
 * append a new row chained via `supersedesId`. [D3] one row per metric; bundles
 * share `readingGroupId`.
 */
export interface Observation {
  id: string
  coachId: string
  /** The athlete. NOT NULL in L2 — unmatched candidates stay in L1. */
  clientId: string
  domain: ObservationDomain
  /** Canonical Metric Registry key (see ./registry). */
  metric: string
  /** Exactly one of value* is populated per the metric's `kind`. */
  valueNum: number | null
  valueText: string | null
  valueJson: unknown | null
  /** Canonical unit (mirrors the registry entry's unit). */
  unit: string
  /** When the fact pertains to (ISO) — distinct from `createdAt`. */
  observedAt: string
  /** Connector id or message source (e.g. "treigninglab", "gmail", "manual"). */
  source: string
  ingestedVia: ObservationIngestedVia
  /** Stable idempotency key per (source, external athlete, metric, observed_at). */
  sourceRef: string | null
  /** [D3] groups metrics captured together (one scan/import); null if standalone. */
  readingGroupId: string | null
  /** Provenance/extraction confidence; coach-approved facts default 1.0. */
  confidence: number
  /** labs/injury/medical — surfaced for explicit handling, never auto-actioned. */
  sensitive: boolean
  /** Soft provenance link to the originating L1 suggestion (no hard FK). */
  suggestedActionId: string | null
  /** Correction chain: the observation this row supersedes, if any. */
  supersedesId: string | null
  /** Denormalized: set when a later row corrects this one (fast "current" reads). */
  supersededById: string | null
  /** The approving coach (or system actor for an explicit policy commit). */
  createdBy: string | null
  createdAt: string
}

/** External-system identity for an athlete (deterministic matching). Generalizes
 *  the recovery framework's `ExternalAthlete`. */
export interface ObservationExternalAthlete {
  id?: string | null
  email?: string | null
  phone?: string | null
  name?: string | null
}

/** One sample emitted by a connector — a superset of `RecoverySample`. Metrics
 *  are keyed by canonical registry key; the engine matches the athlete and turns
 *  each metric into a PENDING suggestion (coach approval — never auto-written). */
export interface ObservationSample {
  connector: string
  external: ObservationExternalAthlete
  /** When the metrics pertain to (ISO or YYYY-MM-DD). */
  observedAt: string
  /** Registry-keyed values; each connector fills only what it has. */
  metrics: Record<string, number | string | null>
  /** [D3] ties this sample's metrics together once committed. */
  readingGroupId?: string | null
  notes?: string | null
  /** Base for deriving per-metric idempotency `sourceRef`s. */
  sourceRefBase?: string | null
}

/** The contract a connector implements. It only PRODUCES samples; matching and
 *  persistence are the ingestion engine's job (generalizes `RecoveryConnector`). */
export interface ObservationConnector {
  readonly id: string
  /** Fetch samples newer than `sinceISO` (incremental); omit for a full pull. */
  fetchSamples(opts: { sinceISO?: string | null }): Promise<ObservationSample[]>
}

/** Re-export for convenience so consumers can `import type { MetricValueKind }`
 *  from the types module alongside the row shapes. */
export type { ObservationDomain, MetricValueKind }
