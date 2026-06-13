"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import { setTaskStatusAction } from "@/lib/actions/tasks"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { CreateTaskDialog } from "@/components/coach/create-task-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { PriorityBadge } from "@/components/shared/badges"
import { relativeDays } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { ListTodo } from "lucide-react"
import type { CoachTaskView, TaskStatus, TaskType } from "@/types/models"

const TYPE_LABELS: Record<TaskType, string> = {
  nutrition: "Nutrition",
  hydration: "Hydration",
  supplements: "Supplements",
  recovery: "Recovery",
  weight_cut: "Weight cut",
  competition: "Competition",
  communication: "Comms",
  training: "Training",
  general: "General",
}

type DueFilter = "all" | "overdue" | "today" | "week" | "later"

const todayStr = () => new Date().toISOString().slice(0, 10)
const weekStr = () =>
  new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)

function dueBucket(dueDate: string | null): DueFilter {
  if (!dueDate) return "later"
  const t = todayStr()
  if (dueDate < t) return "overdue"
  if (dueDate === t) return "today"
  if (dueDate <= weekStr()) return "week"
  return "later"
}

const SECTIONS: { key: DueFilter; label: string }[] = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Due today" },
  { key: "week", label: "This week" },
  { key: "later", label: "Later" },
]

export function TasksBoard({ tasks }: { tasks: CoachTaskView[] }) {
  const [items, setItems] = useState(tasks)
  const [athlete, setAthlete] = useState("all")
  const [priority, setPriority] = useState("all")
  const [status, setStatus] = useState("all")
  const [due, setDue] = useState<DueFilter>("all")
  const [type, setType] = useState("all")
  const [, startTransition] = useTransition()

  // Re-sync when the server sends fresh tasks (after a create/toggle revalidate).
  useEffect(() => setItems(tasks), [tasks])

  const athletes = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of tasks)
      if (t.clientId && t.clientName) m.set(t.clientId, t.clientName)
    return [...m.entries()]
  }, [tasks])

  function toggle(id: string) {
    const current = items.find((t) => t.id === id)
    if (!current) return
    const done = current.status === "done"
    const nextStatus: TaskStatus = done ? "open" : "done"

    // Optimistic update; reconcile with the server in a transition.
    setItems((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: nextStatus, completedAt: done ? null : todayStr() }
          : t
      )
    )
    startTransition(async () => {
      const res = await setTaskStatusAction(id, nextStatus)
      if (res.ok) {
        toast.success(done ? "Marked open" : "Marked complete")
      } else {
        toast.error(res.error ?? "Update failed")
        setItems((prev) => prev.map((t) => (t.id === id ? current : t)))
      }
    })
  }

  const filtered = useMemo(() => {
    return items.filter((t) => {
      if (athlete !== "all" && t.clientId !== athlete) return false
      if (priority !== "all" && t.priority !== priority) return false
      if (status !== "all" && t.status !== status) return false
      if (type !== "all" && t.type !== type) return false
      if (due !== "all" && t.status !== "done" && dueBucket(t.dueDate) !== due)
        return false
      return true
    })
  }, [items, athlete, priority, status, type, due])

  const open = filtered.filter((t) => t.status !== "done")
  const done = filtered.filter((t) => t.status === "done")

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect value={athlete} onChange={setAthlete} placeholder="Athlete" width="w-44">
          <SelectItem value="all">All athletes</SelectItem>
          {athletes.map(([id, name]) => (
            <SelectItem key={id} value={id}>{name}</SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect value={priority} onChange={setPriority} placeholder="Priority">
          <SelectItem value="all">All priority</SelectItem>
          <SelectItem value="urgent">Urgent</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </FilterSelect>
        <FilterSelect value={status} onChange={setStatus} placeholder="Status">
          <SelectItem value="all">All status</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="in_progress">In progress</SelectItem>
          <SelectItem value="done">Done</SelectItem>
        </FilterSelect>
        <FilterSelect value={due} onChange={(v) => setDue(v as DueFilter)} placeholder="Due">
          <SelectItem value="all">Any due date</SelectItem>
          <SelectItem value="overdue">Overdue</SelectItem>
          <SelectItem value="today">Due today</SelectItem>
          <SelectItem value="week">This week</SelectItem>
          <SelectItem value="later">Later</SelectItem>
        </FilterSelect>
        <FilterSelect value={type} onChange={setType} placeholder="Type" width="w-40">
          <SelectItem value="all">All types</SelectItem>
          {(Object.keys(TYPE_LABELS) as TaskType[]).map((t) => (
            <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
          ))}
        </FilterSelect>
        <div className="ml-auto">
          <CreateTaskDialog
            athletes={athletes.map(([id, name]) => ({ id, name }))}
          />
        </div>
      </div>

      {open.length === 0 && done.length === 0 ? (
        <EmptyState icon={ListTodo} title="No tasks match these filters" />
      ) : (
        <div className="space-y-4">
          {SECTIONS.map(({ key, label }) => {
            const group = open.filter((t) => dueBucket(t.dueDate) === key)
            if (group.length === 0) return null
            return (
              <Section
                key={key}
                label={label}
                count={group.length}
                danger={key === "overdue"}
              >
                {group.map((t) => (
                  <TaskRow key={t.id} task={t} onToggle={toggle} />
                ))}
              </Section>
            )
          })}
          {done.length > 0 ? (
            <Section label="Completed" count={done.length}>
              {done.map((t) => (
                <TaskRow key={t.id} task={t} onToggle={toggle} />
              ))}
            </Section>
          ) : null}
        </div>
      )}
    </div>
  )
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  width = "w-36",
  children,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  width?: string
  children: React.ReactNode
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={width} aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  )
}

function Section({
  label,
  count,
  danger,
  children,
}: {
  label: string
  count: number
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <p className={cn("text-sm font-semibold", danger && "text-red-600 dark:text-red-500")}>
        {label} <span className="text-muted-foreground font-normal">({count})</span>
      </p>
      <Card>
        <CardContent className="divide-border divide-y p-0">{children}</CardContent>
      </Card>
    </div>
  )
}

function TaskRow({
  task,
  onToggle,
}: {
  task: CoachTaskView
  onToggle: (id: string) => void
}) {
  const done = task.status === "done"
  const overdue = !done && dueBucket(task.dueDate) === "overdue"
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <Checkbox checked={done} onCheckedChange={() => onToggle(task.id)} />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", done && "text-muted-foreground line-through")}>
          {task.title}
        </p>
        <p className="text-muted-foreground truncate text-xs">
          {task.clientName ?? "General"}
          {task.dueDate ? (
            <span className={cn(overdue && "text-red-600 dark:text-red-500")}>
              {" "}· {relativeDays(task.dueDate)}
            </span>
          ) : null}
        </p>
      </div>
      <Badge variant="outline" className="shrink-0 text-[11px]">
        {TYPE_LABELS[task.type]}
      </Badge>
      <PriorityBadge priority={task.priority} />
    </div>
  )
}
