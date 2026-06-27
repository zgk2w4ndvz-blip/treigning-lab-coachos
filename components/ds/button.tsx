import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// Design-system Button (DESIGN_SYSTEM.md §3). One primary (filled blue) per view;
// secondary + ghost for everything else. Token-driven; additive (U1).
const dsButtonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-control font-medium whitespace-nowrap transition-colors duration-150 outline-none select-none focus-visible:ring-2 focus-visible:ring-ds-primary active:translate-y-px disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-ds-primary text-white hover:bg-ds-primary-hover",
        secondary:
          "border border-ds-border-strong bg-transparent text-ds-text-primary hover:bg-ds-surface-2",
        ghost:
          "bg-transparent text-ds-text-secondary hover:bg-ds-surface-2 hover:text-ds-text-primary",
      },
      size: {
        sm: "h-7 px-2.5 text-xs",
        md: "h-8 px-3 text-[0.8125rem]",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof dsButtonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button"
  return (
    <Comp
      data-slot="ds-button"
      data-variant={variant ?? "secondary"}
      className={cn(dsButtonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Button, dsButtonVariants }
