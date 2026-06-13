import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ReadinessLevel } from "@/types/models"

const META: Record<ReadinessLevel, { label: string; cls: string }> = {
  on_track: {
    label: "On track",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  watch: {
    label: "Watch",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  at_risk: {
    label: "At risk",
    cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
}

export function ReadinessBadge({
  level,
  score,
}: {
  level: ReadinessLevel
  score?: number
}) {
  const m = META[level]
  return (
    <Badge variant="secondary" className={cn(m.cls)}>
      {score != null ? `${score} · ` : ""}
      {m.label}
    </Badge>
  )
}
