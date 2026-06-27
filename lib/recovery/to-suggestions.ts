// Pure: map a RecoverySample to the SAME ClassifiedSuggestion shape the message
// extractors produce, so synced recovery data flows through the identical
// pending-suggested_actions → coach-approval pipeline. Never auto-applied.

import type { ClassifiedSuggestion } from "@/lib/messages/classify"
import type { RecoveryMetrics, RecoverySample } from "@/lib/recovery/types"

// metric key → (details column, human label). Numeric metrics only; booleans
// and notes are handled separately.
const NUMERIC: Partial<Record<keyof RecoveryMetrics, { col: string; label: string }>> = {
  recoveryScore: { col: "recovery_score", label: "Recovery" },
  hrvRmssd: { col: "hrv_rmssd", label: "HRV" },
  restingHr: { col: "resting_hr", label: "RHR" },
  hydration: { col: "hydration", label: "Hydration" },
  hydrationStandard: { col: "hydration_standard", label: "Hydration target" },
  sleepHours: { col: "sleep_hours", label: "Sleep" },
  sleepQuality: { col: "sleep_quality", label: "Sleep quality" },
  readiness: { col: "readiness", label: "Readiness" },
  soreness: { col: "soreness", label: "Soreness" },
  fatigue: { col: "fatigue", label: "Fatigue" },
  bodyBattery: { col: "body_battery", label: "Body battery" },
}

const BOOLEAN: Partial<Record<keyof RecoveryMetrics, string>> = {
  hrvAnomaly: "hrv_anomaly",
  trendHrvAnomaly: "trend_hrv_anomaly",
  mentalHealthAnomaly: "mental_health_anomaly",
}

/** Stable per-(connector, athlete, date) key for idempotency + traceability. */
export function recoverySourceKey(sample: RecoverySample): string {
  const ext = sample.external.id ?? sample.external.email ?? sample.external.phone ?? "unknown"
  return `recovery:${sample.connector}:${ext}:${sample.date}`
}

/**
 * Returns a pending recovery suggestion, or null when the sample carries no
 * usable metrics or notes (nothing to review).
 */
export function recoverySampleToSuggestion(sample: RecoverySample): ClassifiedSuggestion | null {
  const m = sample.metrics
  const details: Record<string, unknown> = {
    action: "recovery_import",
    source: "recovery_sync",
    connector: sample.connector,
    source_date: sample.date,
  }
  const summary: string[] = []
  let hasValue = false

  for (const [key, meta] of Object.entries(NUMERIC) as [keyof RecoveryMetrics, { col: string; label: string }][]) {
    const v = m[key]
    if (typeof v === "number" && Number.isFinite(v)) {
      details[meta.col] = v
      summary.push(`${meta.label} ${v}`)
      hasValue = true
    }
  }
  for (const [key, col] of Object.entries(BOOLEAN) as [keyof RecoveryMetrics, string][]) {
    const v = m[key]
    if (v === true) {
      details[col] = true
      summary.push(meta_label(col))
      hasValue = true
    }
  }
  if (sample.notes && sample.notes.trim()) {
    details.notes = sample.notes.trim()
    hasValue = true
  }
  if (sample.measuredAt) details.measured_at = sample.measuredAt

  if (!hasValue) return null

  return {
    domain: "recovery",
    intent: `Recovery import (${sample.connector})`,
    suggestedProtocol:
      `Imported ${sample.date}: ${summary.join(", ") || "daily note"}`.slice(0, 300),
    // Deterministic structured data — full confidence; coach still approves.
    confidence: 1,
    sensitive: false,
    details,
  }
}

function meta_label(col: string): string {
  if (col === "hrv_anomaly") return "HRV anomaly"
  if (col === "trend_hrv_anomaly") return "HRV trend anomaly"
  if (col === "mental_health_anomaly") return "Mental-health anomaly"
  return col
}
