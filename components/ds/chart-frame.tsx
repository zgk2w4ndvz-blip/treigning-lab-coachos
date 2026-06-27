import * as React from "react"

import { Card } from "@/components/ds/card"
import { SectionHeader } from "@/components/ds/section-header"

// Design-system chart frame (DESIGN_SYSTEM.md §3): a Card wrapper that gives any
// chart a consistent header, body, and legend row. Presentational only — it does
// NOT touch the charting library, so it's low-risk for U1. `children` is the chart
// (e.g. an existing Recharts wrapper); `legend` is the legend row. Additive (U1).
function ChartFrame({
  className,
  title,
  action,
  legend,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Card>, "title"> & {
  title?: React.ReactNode
  action?: React.ReactNode
  legend?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card data-slot="ds-chart-frame" className={className} {...props}>
      {title ? <SectionHeader title={title} action={action} /> : null}
      <div className="text-ds-text-secondary">{children}</div>
      {legend ? (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-ds-text-secondary">
          {legend}
        </div>
      ) : null}
    </Card>
  )
}

export { ChartFrame }
