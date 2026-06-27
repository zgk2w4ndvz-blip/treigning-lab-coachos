import * as React from "react"

import { cn } from "@/lib/utils"

// Design-system Card — the base surface (DESIGN_SYSTEM.md §3). Token-driven; not
// wired into any screen yet (U1). `interactive` adds the hover-lift used by
// clickable cards.
function Card({
  className,
  interactive = false,
  ...props
}: React.ComponentProps<"div"> & { interactive?: boolean }) {
  return (
    <div
      data-slot="ds-card"
      className={cn(
        "rounded-card border border-ds-border bg-ds-surface-1 p-4 text-ds-text-primary",
        interactive &&
          "transition-colors duration-150 hover:border-ds-border-strong hover:bg-ds-surface-2",
        className
      )}
      {...props}
    />
  )
}

export { Card }
