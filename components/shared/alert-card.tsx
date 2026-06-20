import type { LucideIcon } from "lucide-react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { EmptyState } from "./empty-state"
import { SectionHeader } from "./section-header"

interface AlertCardProps {
  title: string
  icon?: LucideIcon
  /** Count pill in the header (hidden when 0). */
  count?: number
  /** "View all" link target in the header. */
  viewAllHref?: string
  /** Optional left accent stripe to signal urgency. */
  accent?: "default" | "primary" | "warning" | "critical"
  /** When true, render the empty state instead of children. */
  isEmpty?: boolean
  emptyIcon?: LucideIcon
  emptyTitle?: string
  emptyDescription?: string
  /** Rows — typically `ActionRow`s; auto-divided. */
  children?: React.ReactNode
  className?: string
}

const accentStripe: Record<NonNullable<AlertCardProps["accent"]>, string> = {
  default: "",
  primary: "border-l-2 border-l-primary",
  warning: "border-l-2 border-l-amber-500",
  critical: "border-l-2 border-l-red-500",
}

/**
 * A titled command-center feed panel: header (icon + title + count + view-all)
 * over a divided list of rows, with a built-in empty state. Used for Recent
 * Messages, Pending Approvals, Athlete Alerts, etc. UI-only — no data logic.
 */
export function AlertCard({
  title,
  icon,
  count,
  viewAllHref,
  accent = "default",
  isEmpty,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  children,
  className,
}: AlertCardProps) {
  return (
    <Card className={cn(accentStripe[accent], className)}>
      <CardHeader>
        <SectionHeader
          title={title}
          icon={icon}
          count={count}
          viewAllHref={viewAllHref}
        />
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <EmptyState
            icon={emptyIcon ?? icon}
            title={emptyTitle ?? "Nothing here"}
            description={emptyDescription}
            className="border-0 py-8"
          />
        ) : (
          <div className="divide-border/70 divide-y">{children}</div>
        )}
      </CardContent>
    </Card>
  )
}
