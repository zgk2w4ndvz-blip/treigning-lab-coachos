import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface SectionHeaderProps {
  title: string
  /** Optional leading icon for command-center sections. */
  icon?: LucideIcon
  /** Optional count pill rendered after the title (hidden when 0/undefined). */
  count?: number
  /** Convenience "View all" link; takes precedence over `action`. */
  viewAllHref?: string
  /** Arbitrary trailing content (e.g. a toggle), used when no `viewAllHref`. */
  action?: React.ReactNode
  className?: string
}

/** A bold, uppercase section label for the dashboard/agenda command center. */
export function SectionHeader({
  title,
  icon: Icon,
  count,
  viewAllHref,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <h2 className="font-heading text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-widest uppercase">
        {Icon ? <Icon className="size-3.5" /> : null}
        {title}
        {typeof count === "number" && count > 0 ? (
          <span className="bg-primary/15 text-primary inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.625rem] font-bold tabular-nums">
            {count}
          </span>
        ) : null}
      </h2>
      {viewAllHref ? (
        <Link
          href={viewAllHref}
          className="text-primary text-xs font-medium hover:underline"
        >
          View all
        </Link>
      ) : (
        action ?? null
      )}
    </div>
  )
}
