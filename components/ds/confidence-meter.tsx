import * as React from "react"

import { cn } from "@/lib/utils"

// Design-system ConfidenceMeter — a pre-attentive cue for how much a coach
// should trust an AI/rule extraction before approving it (DESIGN_SYSTEM.md §3).
// Read-only: this only *displays* the confidence a suggestion already carries;
// it never changes the approval gate or writes anything.

export type ConfidenceTier = "high" | "medium" | "low"

// Thresholds are intentionally conservative so anything a coach should
// double-check reads as "low". High ≥ 80%, Medium 60–79%, Low < 60%.
export function confidenceTier(value: number): ConfidenceTier {
  if (value >= 0.8) return "high"
  if (value >= 0.6) return "medium"
  return "low"
}

const TIER_FILL: Record<ConfidenceTier, string> = {
  high: "bg-ds-positive",
  medium: "bg-ds-attention",
  low: "bg-ds-warning",
}

const TIER_TEXT: Record<ConfidenceTier, string> = {
  high: "text-ds-text-secondary",
  medium: "text-ds-text-secondary",
  low: "text-ds-warning-on",
}

const TIER_LABEL: Record<ConfidenceTier, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
}

function ConfidenceMeter({
  value,
  showLabel = false,
  className,
  ...props
}: React.ComponentProps<"span"> & {
  /** Confidence in [0, 1]. Values are clamped for display. */
  value: number
  /** Show the tier word (High / Medium / Low) after the percentage. */
  showLabel?: boolean
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  const pct = Math.round(clamped * 100)
  const tier = confidenceTier(clamped)

  return (
    <span
      data-slot="ds-confidence-meter"
      data-tier={tier}
      className={cn("inline-flex items-center gap-1.5 text-[11px]", className)}
      title={`AI confidence: ${pct}% (${TIER_LABEL[tier].toLowerCase()})`}
      {...props}
    >
      <span className="text-ds-text-muted">conf</span>
      <span className="h-1.5 w-10 shrink-0 overflow-hidden rounded-pill bg-ds-surface-2">
        <span
          className={cn("block h-full rounded-pill", TIER_FILL[tier])}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className={cn("font-medium tabular-nums", TIER_TEXT[tier])}>
        {pct}%{showLabel ? ` · ${TIER_LABEL[tier]}` : ""}
      </span>
    </span>
  )
}

export { ConfidenceMeter }
