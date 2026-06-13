import { ListTodo, AlertTriangle, CalendarClock, CalendarRange } from "lucide-react"

import { requireCoach } from "@/lib/auth"
import { getCoachTasks } from "@/lib/data/tasks"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { TasksBoard } from "@/components/coach/tasks-board"

const todayStr = () => new Date().toISOString().slice(0, 10)
const weekStr = () => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)

export default async function TasksPage() {
  await requireCoach()
  const tasks = await getCoachTasks()
  const openTasks = tasks.filter((t) => t.status !== "done")

  const overdue = openTasks.filter((t) => t.dueDate && t.dueDate < todayStr()).length
  const today = openTasks.filter((t) => t.dueDate === todayStr()).length
  const week = openTasks.filter(
    (t) => t.dueDate && t.dueDate > todayStr() && t.dueDate <= weekStr()
  ).length

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <PageHeader
        title="Tasks"
        description="Every coaching to-do across nutrition, hydration, recovery, weight cuts, competitions, and follow-ups."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Overdue"
          value={overdue}
          icon={AlertTriangle}
          accent={overdue > 0 ? "critical" : "success"}
        />
        <StatCard
          label="Due today"
          value={today}
          icon={CalendarClock}
          accent={today > 0 ? "warning" : "default"}
        />
        <StatCard label="This week" value={week} icon={CalendarRange} />
        <StatCard label="Open tasks" value={openTasks.length} icon={ListTodo} />
      </div>

      <TasksBoard tasks={tasks} />
    </main>
  )
}
