import { AlertTriangle, Flag, CheckCircle2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AgendaPriority } from "@/types/models"

const META: Record<
  AgendaPriority,
  { label: string; cls: string; icon: typeof Flag; border: string }
> = {
  urgent: {
    label: "Urgent",
    cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    icon: AlertTriangle,
    border: "border-l-red-500",
  },
  attention: {
    label: "Attention",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    icon: Flag,
    border: "border-l-amber-500",
  },
  steady: {
    label: "On track",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    icon: CheckCircle2,
    border: "border-l-emerald-500",
  },
}

export function AgendaPriorityBadge({
  priority,
  reasons,
}: {
  priority: AgendaPriority
  reasons?: string[]
}) {
  const m = META[priority]
  const Icon = m.icon
  return (
    <Badge
      variant="secondary"
      className={cn("shrink-0", m.cls)}
      title={reasons?.join(" · ")}
    >
      <Icon className="mr-1 size-3" />
      {m.label}
    </Badge>
  )
}

export function priorityBorder(priority: AgendaPriority): string {
  return META[priority].border
}
