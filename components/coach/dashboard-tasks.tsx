import Link from "next/link"
import { ListTodo } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PriorityBadge } from "@/components/shared/badges"
import { EmptyState } from "@/components/shared/empty-state"
import { relativeDays } from "@/lib/utils/format"
import type { Task } from "@/types/models"

export function DashboardTasks({ tasks }: { tasks: Task[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Open tasks</CardTitle>
        <Link href="/tasks" className="text-primary text-sm hover:underline">
          View board
        </Link>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title="No open tasks"
            description="Nothing on your plate right now."
            className="py-8"
          />
        ) : (
          <ul className="divide-border divide-y">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center gap-3 py-3">
                <PriorityBadge priority={task.priority} />
                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                  {task.title}
                </p>
                {task.due_date ? (
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {relativeDays(task.due_date)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
