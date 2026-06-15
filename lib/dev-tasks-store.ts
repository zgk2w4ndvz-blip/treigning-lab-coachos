// ============================================================================
// Dev tasks store — local persistence for coach tasks in dev bypass.
//
// Generated tasks (derived from the imported roster in dev-roster-store) are
// ephemeral. This store layers two kinds of *persisted* state on top, saved to
// .dev-data/tasks.json:
//   • created  — tasks the coach added by hand via the New Task form
//   • overrides — status/completion changes applied to ANY task by id, so
//                 marking a generated task done survives a reload.
// Server-only (uses fs).
// ============================================================================

import "server-only"

import fs from "node:fs"
import path from "node:path"

import type { CoachTaskView, Task, TaskStatus } from "@/types/models"

export type StoredTask = CoachTaskView & { createdAt: string }

const COACH = "00000000-0000-0000-0000-0000000000c0"

/** Hand-created tasks as DB-shaped rows (for the agenda reminder feed). */
export function getCreatedTaskRows(): Task[] {
  return getCreatedTasks().map((t) => ({
    id: t.id,
    coach_id: COACH,
    client_id: t.clientId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    due_date: t.dueDate,
    completed_at: t.completedAt,
    created_at: t.createdAt,
    updated_at: t.createdAt,
  }))
}

export type TaskOverride = {
  status: TaskStatus
  completedAt: string | null
}

type TaskFile = {
  created: StoredTask[]
  overrides: Record<string, TaskOverride>
}

const FILE = path.join(process.cwd(), ".dev-data", "tasks.json")
const EMPTY: TaskFile = { created: [], overrides: {} }

let cache: { mtimeMs: number; data: TaskFile } | null = null

function read(): TaskFile {
  try {
    const stat = fs.statSync(FILE)
    if (!cache || cache.mtimeMs !== stat.mtimeMs) {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as Partial<TaskFile>
      cache = {
        mtimeMs: stat.mtimeMs,
        data: {
          created: Array.isArray(raw.created) ? raw.created : [],
          overrides: raw.overrides ?? {},
        },
      }
    }
    return cache.data
  } catch {
    return EMPTY
  }
}

function write(data: TaskFile): void {
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2))
  cache = null
}

/** Hand-created tasks, newest first. */
export function getCreatedTasks(): StoredTask[] {
  return [...read().created].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function addCreatedTask(task: StoredTask): void {
  const data = read()
  write({ ...data, created: [...data.created, task] })
}

/** Status/completion overrides keyed by task id. */
export function getTaskOverrides(): Record<string, TaskOverride> {
  return read().overrides
}

export function setTaskOverride(id: string, override: TaskOverride): void {
  const data = read()
  // A hand-created task can be updated in place; otherwise record an override.
  const idx = data.created.findIndex((t) => t.id === id)
  if (idx !== -1) {
    const next = [...data.created]
    next[idx] = { ...next[idx], status: override.status, completedAt: override.completedAt }
    write({ ...data, created: next })
    return
  }
  write({ ...data, overrides: { ...data.overrides, [id]: override } })
}
