import * as React from "react"

import { cn } from "@/lib/utils"

// Design-system empty state (DESIGN_SYSTEM.md content rules): an invitation, not
// an apology — muted icon, a verb-first title, a one-line body, and an optional
// action. Token-driven; additive (U1).
function EmptyState({
  className,
  icon,
  title,
  description,
  action,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div
      data-slot="ds-empty-state"
      className={cn(
        "flex flex-col items-center justify-center px-4 py-10 text-center",
        className
      )}
      {...props}
    >
      {icon ? (
        <span className="mb-3 text-ds-text-muted [&>svg]:size-7" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <div className="text-sm font-medium text-ds-text-primary">{title}</div>
      {description ? (
        <p className="mt-1 max-w-xs text-xs text-ds-text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export { EmptyState }
