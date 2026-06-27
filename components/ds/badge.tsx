import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// Design-system Badge — a status label (DESIGN_SYSTEM.md §3). Tint bg + on-tint
// text from the same role family. For selectable filters use Chip instead.
const dsBadgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-medium whitespace-nowrap [&>svg]:size-3 [&>svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "bg-ds-surface-2 text-ds-text-secondary",
        primary: "bg-ds-primary-bg text-ds-primary-on",
        positive: "bg-ds-positive-bg text-ds-positive-on",
        warning: "bg-ds-warning-bg text-ds-warning-on",
        attention: "bg-ds-attention-bg text-ds-attention-on",
        danger: "bg-ds-danger-bg text-ds-danger-on",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
)

function Badge({
  className,
  tone,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof dsBadgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"
  return (
    <Comp
      data-slot="ds-badge"
      data-tone={tone ?? "neutral"}
      className={cn(dsBadgeVariants({ tone }), className)}
      {...props}
    />
  )
}

export { Badge, dsBadgeVariants }
