import * as React from "react"

import { cn } from "@/lib/utils"

// Design-system section header (DESIGN_SYSTEM.md §3): a 14/500 sans title (the
// `font-sans` class overrides the app's display-heading rule for h1–h3) with an
// optional leading icon, right-aligned action, and optional description.
// Token-driven; additive (U1).
function SectionHeader({
  className,
  title,
  icon,
  action,
  description,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  title: React.ReactNode
  icon?: React.ReactNode
  action?: React.ReactNode
  description?: React.ReactNode
}) {
  return (
    <div data-slot="ds-section-header" className={cn("mb-2.5", className)} {...props}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon ? (
            <span className="text-ds-text-secondary [&>svg]:size-4" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <h3 className="font-sans text-sm font-medium tracking-normal text-ds-text-primary">
            {title}
          </h3>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {description ? (
        <p className="mt-1 text-xs text-ds-text-muted">{description}</p>
      ) : null}
    </div>
  )
}

export { SectionHeader }
