import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  hint?: string
  accent?: "default" | "warning" | "critical" | "success"
  /** When set, the whole card becomes a keyboard-focusable navigation tile. */
  href?: string
}

const accentMap: Record<NonNullable<StatCardProps["accent"]>, string> = {
  default: "text-foreground",
  warning: "text-amber-600 dark:text-amber-500",
  critical: "text-red-600 dark:text-red-500",
  success: "text-emerald-600 dark:text-emerald-500",
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = "default",
  href,
}: StatCardProps) {
  const card = (
    <Card
      className={cn(
        "h-full",
        // Interactive affordance: lift on hover, settle on press. The depth
        // (shadow) is owned by Card and deepens on hover automatically, so the
        // 3D styling is preserved — we only add motion and a focus ring here.
        href &&
          "transition-transform duration-150 group-hover/stat:-translate-y-0.5 group-active/stat:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none"
      )}
    >
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm font-medium">{label}</p>
          <p className={cn("text-3xl font-bold tabular-nums", accentMap[accent])}>
            {value}
          </p>
          {hint ? (
            <p className="text-muted-foreground text-xs">{hint}</p>
          ) : null}
        </div>
        {Icon ? (
          <div className="bg-muted text-muted-foreground relative rounded-md p-2">
            <Icon className="size-5" />
            {href ? (
              <ArrowUpRight className="text-muted-foreground/0 group-hover/stat:text-muted-foreground/70 group-focus-visible/stat:text-muted-foreground/70 absolute -top-1 -right-1 size-3.5 transition-colors" />
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )

  if (!href) return card

  return (
    <Link
      href={href}
      aria-label={`${label}: ${value}`}
      className="group/stat focus-visible:ring-ring focus-visible:ring-offset-background block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      {card}
    </Link>
  )
}
