import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// Design-system Chip — a selectable / filter pill (DESIGN_SYSTEM.md §3). Distinct
// from Badge (a passive status label): Chip is interactive and has an active
// state. Token-driven; additive (U1).
const dsChipVariants = cva(
  "inline-flex w-fit shrink-0 cursor-pointer items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ds-primary [&>svg]:size-3.5 [&>svg]:shrink-0",
  {
    variants: {
      active: {
        true: "bg-ds-primary-bg text-ds-primary-on",
        false:
          "border border-ds-border text-ds-text-secondary hover:bg-ds-surface-2 hover:text-ds-text-primary",
      },
    },
    defaultVariants: { active: false },
  }
)

function Chip({
  className,
  active,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof dsChipVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"
  return (
    <Comp
      data-slot="ds-chip"
      data-active={active ?? false}
      className={cn(dsChipVariants({ active }), className)}
      {...props}
    />
  )
}

export { Chip, dsChipVariants }
