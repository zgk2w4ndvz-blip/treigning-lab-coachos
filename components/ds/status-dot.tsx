import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Design-system StatusDot — the pre-attentive severity cue used in rosters,
// triage, and list rows (DESIGN_SYSTEM.md §3). Token-driven; additive (U1).
const dsStatusDotVariants = cva("inline-block shrink-0 rounded-full", {
  variants: {
    status: {
      critical: "bg-ds-danger",
      warning: "bg-ds-warning",
      positive: "bg-ds-positive",
      review: "bg-ds-attention",
      neutral: "bg-ds-text-muted",
    },
    size: {
      sm: "size-1.5",
      md: "size-2",
    },
  },
  defaultVariants: { status: "neutral", size: "md" },
})

function StatusDot({
  className,
  status,
  size,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof dsStatusDotVariants>) {
  return (
    <span
      data-slot="ds-status-dot"
      data-status={status ?? "neutral"}
      aria-hidden="true"
      className={cn(dsStatusDotVariants({ status, size }), className)}
      {...props}
    />
  )
}

export { StatusDot, dsStatusDotVariants }
