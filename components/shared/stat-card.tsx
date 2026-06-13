import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  hint?: string
  accent?: "default" | "warning" | "critical" | "success"
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
}: StatCardProps) {
  return (
    <Card>
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
          <div className="bg-muted text-muted-foreground rounded-md p-2">
            <Icon className="size-5" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
