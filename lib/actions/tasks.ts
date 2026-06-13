"use server"

import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"

import { requireCoach } from "@/lib/auth"
import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { addCreatedTask, setTaskOverride } from "@/lib/dev-tasks-store"
import { createTaskSchema, NO_CLIENT } from "@/lib/validations/tasks"
import type { ActionState } from "@/lib/actions/types"
import type { TaskStatus } from "@/types/models"

const AFFECTED = ["/tasks", "/dashboard", "/agenda"]

function revalidateAll() {
  for (const p of AFFECTED) revalidatePath(p)
}

/** Create a coaching task. Bypass → local store; real → `tasks` insert. */
export async function createTaskAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = createTaskSchema.safeParse(
    Object.fromEntries(formData.entries())
  )
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const v = parsed.data
  const clientId = v.clientId && v.clientId !== NO_CLIENT ? v.clientId : null
  const dueDate = v.dueDate ? v.dueDate : null
  const description = v.description ? v.description : null

  try {
    if (DEV_AUTH_BYPASS) {
      addCreatedTask({
        id: randomUUID(),
        clientId,
        clientName: null, // re-resolved against the roster on read
        title: v.title,
        description,
        type: v.type,
        status: "open",
        priority: v.priority,
        dueDate,
        completedAt: null,
        createdAt: new Date().toISOString(),
      })
    } else {
      const coach = await requireCoach()
      const supabase = await createServerSupabase()
      const { error } = await supabase.from("tasks").insert({
        coach_id: coach.id,
        client_id: clientId,
        title: v.title,
        description,
        status: "open",
        priority: v.priority,
        due_date: dueDate,
      })
      if (error) return { ok: false, error: error.message }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Create failed." }
  }

  revalidateAll()
  return { ok: true }
}

/** Toggle/set a task's completion. Bypass → override store; real → update. */
export async function setTaskStatusAction(
  taskId: string,
  status: TaskStatus
): Promise<ActionState> {
  const completedAt = status === "done" ? new Date().toISOString() : null

  try {
    if (DEV_AUTH_BYPASS) {
      setTaskOverride(taskId, { status, completedAt })
    } else {
      await requireCoach()
      const supabase = await createServerSupabase()
      const { error } = await supabase
        .from("tasks")
        .update({ status, completed_at: completedAt })
        .eq("id", taskId)
      if (error) return { ok: false, error: error.message }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Update failed." }
  }

  revalidateAll()
  return { ok: true }
}
