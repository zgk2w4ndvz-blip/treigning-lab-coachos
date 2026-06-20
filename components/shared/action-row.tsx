import Link from "next/link"

import { cn } from "@/lib/utils"

interface ActionRowProps {
  /** Leading visual — a badge, avatar, icon chip, or severity dot. */
  leading?: React.ReactNode
  title: React.ReactNode
  /** When set, the title becomes a link. */
  titleHref?: string
  subtitle?: React.ReactNode
  /** Trailing meta text (e.g. relative time). */
  meta?: React.ReactNode
  /** Trailing action control (e.g. a button); sits after `meta`. */
  action?: React.ReactNode
  className?: string
}

/**
 * One row in a command-center feed (messages, approvals, alerts, tasks).
 * Render several inside a `divide-y` wrapper or an `AlertCard`.
 */
export function ActionRow({
  leading,
  title,
  titleHref,
  subtitle,
  meta,
  action,
  className,
}: ActionRowProps) {
  const titleNode = titleHref ? (
    <Link
      href={titleHref}
      className="block truncate font-medium hover:underline"
    >
      {title}
    </Link>
  ) : (
    <span className="block truncate font-medium">{title}</span>
  )

  return (
    <div className={cn("flex items-start gap-3 py-2.5", className)}>
      {leading ? <div className="shrink-0 pt-0.5">{leading}</div> : null}
      <div className="min-w-0 flex-1 text-sm">
        {titleNode}
        {subtitle ? (
          <div className="text-muted-foreground truncate text-xs">
            {subtitle}
          </div>
        ) : null}
      </div>
      {meta ? (
        <div className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
          {meta}
        </div>
      ) : null}
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
