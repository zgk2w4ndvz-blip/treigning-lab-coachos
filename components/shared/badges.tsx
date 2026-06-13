import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type {
  AlertStatus,
  ClientStatus,
  CompStatus,
  Priority,
  Severity,
  TaskStatus,
} from "@/types/models"

export function SeverityBadge({ severity }: { severity: Severity }) {
  const map: Record<Severity, string> = {
    info: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    warning:
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    critical: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  }
  return (
    <Badge variant="secondary" className={cn("capitalize", map[severity])}>
      {severity}
    </Badge>
  )
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const map: Record<Priority, string> = {
    low: "bg-muted text-muted-foreground",
    medium: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    high: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    urgent: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  }
  return (
    <Badge variant="secondary" className={cn("capitalize", map[priority])}>
      {priority}
    </Badge>
  )
}

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const map: Record<ClientStatus, string> = {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    prospect: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    inactive: "bg-muted text-muted-foreground",
    archived: "bg-muted text-muted-foreground",
  }
  return (
    <Badge variant="secondary" className={cn("capitalize", map[status])}>
      {status}
    </Badge>
  )
}

export function CompStatusBadge({ status }: { status: CompStatus }) {
  const map: Record<CompStatus, string> = {
    planned: "bg-muted text-muted-foreground",
    registered:
      "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    completed:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    cancelled: "bg-muted text-muted-foreground line-through",
  }
  return (
    <Badge variant="secondary" className={cn("capitalize", map[status])}>
      {status}
    </Badge>
  )
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const label = status.replace("_", " ")
  const map: Record<TaskStatus, string> = {
    open: "bg-muted text-muted-foreground",
    in_progress: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    cancelled: "bg-muted text-muted-foreground line-through",
  }
  return (
    <Badge variant="secondary" className={cn("capitalize", map[status])}>
      {label}
    </Badge>
  )
}

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  return (
    <Badge variant="outline" className="capitalize">
      {status}
    </Badge>
  )
}
