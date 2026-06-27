import * as React from "react"

import { cn } from "@/lib/utils"
import { Card } from "@/components/ds/card"

type DeltaTone = "positive" | "negative" | "neutral"

interface KpiDelta {
  value: string
  direction: "up" | "down"
  tone?: DeltaTone
  hint?: string
}

const deltaToneClass: Record<DeltaTone, string> = {
  positive: "text-ds-positive",
  negative: "text-ds-danger",
  neutral: "text-ds-text-muted",
}

// Design-system KPI card (DESIGN_SYSTEM.md §3): muted label + optional role icon,
// large value, optional delta chip, and an optional sparkline slot via `children`.
// Token-driven; additive (U1).
function KpiCard({
  label,
  value,
  delta,
  icon,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Card>, "children"> & {
  label: string
  value: React.ReactNode
  delta?: KpiDelta
  icon?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <Card data-slot="ds-kpi-card" className={cn("p-3.5", className)} {...props}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-ds-text-muted">{label}</span>
        {icon ? (
          <span className="text-ds-text-muted [&>svg]:size-4" aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-[28px] leading-none font-medium text-ds-text-primary">
        {value}
      </div>
      {delta ? (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[11px]",
              deltaToneClass[delta.tone ?? "neutral"]
            )}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              {delta.direction === "up" ? (
                <path d="M3 9L9 3M9 3H4M9 3V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M3 3L9 9M9 9H4M9 9V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
            {delta.value}
          </span>
          {delta.hint ? (
            <span className="text-xs text-ds-text-muted">{delta.hint}</span>
          ) : null}
        </div>
      ) : null}
      {children ? <div className="mt-2">{children}</div> : null}
    </Card>
  )
}

export { KpiCard }
export type { KpiDelta }
