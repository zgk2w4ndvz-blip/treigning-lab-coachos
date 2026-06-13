import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { WrestlingPace, WrestlingRisk } from "@/types/models"

const PACE: Record<WrestlingPace, { label: string; cls: string }> = {
  on: { label: "On pace", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  off: { label: "Off pace", cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  unknown: { label: "Unknown", cls: "bg-muted text-muted-foreground" },
}

const RISK: Record<WrestlingRisk, { label: string; cls: string }> = {
  low: { label: "Low risk", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  medium: { label: "Medium", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  high: { label: "High risk", cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
}

export function PaceBadge({ pace }: { pace: WrestlingPace }) {
  const m = PACE[pace]
  return <Badge variant="secondary" className={cn(m.cls)}>{m.label}</Badge>
}

export function RiskBadge({ risk }: { risk: WrestlingRisk }) {
  const m = RISK[risk]
  return <Badge variant="secondary" className={cn(m.cls)}>{m.label}</Badge>
}
