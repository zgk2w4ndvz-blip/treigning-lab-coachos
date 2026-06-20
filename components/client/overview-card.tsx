import Link from "next/link"
import { ChevronRight, type LucideIcon } from "lucide-react"

import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface OverviewCardProps {
  /** Destination route (athlete tab or hub). */
  href: string
  title: string
  icon?: LucideIcon
  /** Accessible label for the link (defaults to "View {title}"). */
  ariaLabel?: string
  className?: string
  children?: React.ReactNode
}

/**
 * A clickable athlete-overview card. The whole card is a single link (keyboard
 * focusable, Enter-activated) that navigates to the related tab. Preserves the
 * 3D Card styling and adds a hover lift + a persistent arrow affordance that
 * brightens and slides on hover/focus.
 */
export function OverviewCard({
  href,
  title,
  icon: Icon,
  ariaLabel,
  className,
  children,
}: OverviewCardProps) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel ?? `View ${title}`}
      className={cn(
        "group/ocard block rounded-xl outline-none transition-transform duration-150",
        "hover:-translate-y-0.5 active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        "focus-visible:ring-ring/60 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      <Card className="h-full group-hover/ocard:[box-shadow:var(--shadow-card-hover)] group-active/ocard:[box-shadow:var(--shadow-card)]">
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          {Icon ? <Icon className="text-muted-foreground size-4 shrink-0" /> : null}
          <CardTitle className="text-base">{title}</CardTitle>
          <ChevronRight
            aria-hidden
            className="text-muted-foreground/50 ml-auto size-4 shrink-0 transition-all duration-150 group-hover/ocard:translate-x-0.5 group-hover/ocard:text-foreground group-focus-visible/ocard:translate-x-0.5 group-focus-visible/ocard:text-foreground"
          />
        </CardHeader>
        {children}
      </Card>
    </Link>
  )
}
