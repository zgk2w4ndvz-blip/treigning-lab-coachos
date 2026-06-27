import * as React from "react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// Design-system list row (DESIGN_SYSTEM.md §3): the shared "bordered rows, not
// nested cards" pattern used by Inbox, Today's Priority, Athlete Story, etc.
// leading (avatar/icon) + title/subtitle + trailing. `interactive` adds the hover
// surface; `asChild` lets it become a link. Token-driven; additive (U1).
function ListRow({
  className,
  leading,
  title,
  subtitle,
  trailing,
  interactive = false,
  asChild = false,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  leading?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  trailing?: React.ReactNode
  interactive?: boolean
  asChild?: boolean
}) {
  const Comp = asChild ? Slot.Root : "div"
  return (
    <Comp
      data-slot="ds-list-row"
      className={cn(
        "flex items-center gap-3 rounded-control px-2 py-2.5",
        interactive &&
          "cursor-pointer transition-colors duration-150 hover:bg-ds-surface-2",
        className
      )}
      {...props}
    >
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[0.8125rem] font-medium text-ds-text-primary">
          {title}
        </div>
        {subtitle ? (
          <div className="truncate text-xs text-ds-text-muted">{subtitle}</div>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </Comp>
  )
}

export { ListRow }
