import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { getBypassClients, getBypassCoachTasks } from "@/lib/dev-roster-store"
import { getCreatedTasks, getTaskOverrides } from "@/lib/dev-tasks-store"
import { fullName } from "@/lib/utils/format"
import type { CoachTaskView } from "@/types/models"

/**
 * Bypass tasks = hand-created tasks + roster-generated tasks, with any
 * persisted status/completion overrides applied and client names re-resolved
 * against the current roster.
 */
function getBypassTasks(): CoachTaskView[] {
  const overrides = getTaskOverrides()
  const nameById = new Map(
    getBypassClients().map((c) => [c.id, fullName(c.first_name, c.last_name)])
  )
  const created: CoachTaskView[] = getCreatedTasks().map((t) => ({
    id: t.id,
    clientId: t.clientId,
    clientName: t.clientId ? nameById.get(t.clientId) ?? t.clientName : null,
    title: t.title,
    description: t.description,
    type: t.type,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    completedAt: t.completedAt,
  }))
  return [...created, ...getBypassCoachTasks()].map((t) => {
    const o = overrides[t.id]
    return o ? { ...t, status: o.status, completedAt: o.completedAt } : t
  })
}

/** All coach tasks for the Tasks page. */
export async function getCoachTasks(): Promise<CoachTaskView[]> {
  if (DEV_AUTH_BYPASS) return getBypassTasks()

  const supabase = await createServerSupabase()
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false })

  const clientIds = [
    ...new Set((tasks ?? []).map((t) => t.client_id).filter(Boolean)),
  ] as string[]
  const { data: clients } =
    clientIds.length > 0
      ? await supabase
          .from("clients")
          .select("id, first_name, last_name")
          .in("id", clientIds)
      : { data: [] }
  const nameById = new Map(
    (clients ?? []).map((c) => [c.id, fullName(c.first_name, c.last_name)])
  )

  return (tasks ?? []).map((t) => ({
    id: t.id,
    clientId: t.client_id,
    clientName: t.client_id ? nameById.get(t.client_id) ?? null : null,
    title: t.title,
    description: t.description,
    type: "general",
    status: t.status,
    priority: t.priority,
    dueDate: t.due_date,
    completedAt: t.completed_at,
  }))
}
