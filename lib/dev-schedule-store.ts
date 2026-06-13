// ============================================================================
// Dev schedule store — local persistence for scheduled sessions in dev bypass.
//
// Stores created and updated sessions to .dev-data/schedule.json.
// Status overrides (complete/cancel/no_show) are applied on top of mock data.
// Server-only (uses fs).
// ============================================================================

import "server-only"

import fs from "node:fs"
import path from "node:path"

import type { ScheduledSessionView } from "@/types/models"
import type { SessionStatus } from "@/types/database"

export type StoredSession = ScheduledSessionView & { createdAt: string }

export type SessionOverride = {
  status: SessionStatus
}

type ScheduleFile = {
  created: StoredSession[]
  overrides: Record<string, SessionOverride>
}

const FILE = path.join(process.cwd(), ".dev-data", "schedule.json")
const EMPTY: ScheduleFile = { created: [], overrides: {} }

let cache: { mtimeMs: number; data: ScheduleFile } | null = null

function read(): ScheduleFile {
  try {
    const stat = fs.statSync(FILE)
    if (!cache || cache.mtimeMs !== stat.mtimeMs) {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as Partial<ScheduleFile>
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

function write(data: ScheduleFile): void {
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2))
  cache = null
}

export function getCreatedSessions(): StoredSession[] {
  return [...read().created].sort((a, b) =>
    a.scheduledAt.localeCompare(b.scheduledAt)
  )
}

export function addCreatedSession(session: StoredSession): void {
  const data = read()
  write({ ...data, created: [...data.created, session] })
}

export function updateCreatedSession(
  id: string,
  patch: Partial<ScheduledSessionView>
): boolean {
  const data = read()
  const idx = data.created.findIndex((s) => s.id === id)
  if (idx === -1) return false
  const next = [...data.created]
  next[idx] = { ...next[idx], ...patch, id }
  write({ ...data, created: next })
  return true
}

export function deleteCreatedSession(id: string): boolean {
  const data = read()
  const next = data.created.filter((s) => s.id !== id)
  if (next.length === data.created.length) return false
  write({ ...data, created: next })
  return true
}

export function getSessionOverrides(): Record<string, SessionOverride> {
  return read().overrides
}

export function setSessionOverride(id: string, override: SessionOverride): void {
  const data = read()
  const idx = data.created.findIndex((s) => s.id === id)
  if (idx !== -1) {
    const next = [...data.created]
    next[idx] = { ...next[idx], status: override.status }
    write({ ...data, created: next })
    return
  }
  write({ ...data, overrides: { ...data.overrides, [id]: override } })
}
