// ============================================================================
// Dev measurements store — local persistence for manually-entered
// anthropometric measurements in dev bypass. Coach-entered sessions are
// appended to .dev-data/measurements.json (keyed by client id) so they read
// back across requests. Server-only (uses fs). Mirrors dev-body-comp-store.
// ============================================================================

import "server-only"

import fs from "node:fs"
import path from "node:path"

export interface StoredMeasurementSession {
  id: string
  measuredAt: string // ISO datetime
  waistIn: number | null
  hipsIn: number | null
  chestIn: number | null
  shoulderIn: number | null
  thighIn: number | null
  calvesIn: number | null
  wristIn: number | null
  ankleIn: number | null
  neckIn: number | null
  bicepIn: number | null
  heightIn: number | null
  notes: string | null
}

type Store = Record<string, StoredMeasurementSession[]>

const FILE = path.join(process.cwd(), ".dev-data", "measurements.json")

let cache: { mtimeMs: number; store: Store } | null = null

function read(): Store {
  try {
    const stat = fs.statSync(FILE)
    if (!cache || cache.mtimeMs !== stat.mtimeMs) {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as Store
      cache = { mtimeMs: stat.mtimeMs, store: raw ?? {} }
    }
    return cache.store
  } catch {
    return {}
  }
}

function write(store: Store): void {
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify(store, null, 2))
  cache = null
}

/** Manually-entered measurement sessions for one client (oldest → newest). */
export function getStoredMeasurementSessions(
  clientId: string
): StoredMeasurementSession[] {
  return read()[clientId] ?? []
}

export function addStoredMeasurementSession(
  clientId: string,
  m: StoredMeasurementSession
): void {
  const store = read()
  const list = [...(store[clientId] ?? []), m]
  write({ ...store, [clientId]: list })
}

/** Update a stored session in place. Returns true if a row matched. */
export function updateStoredMeasurementSession(
  clientId: string,
  id: string,
  patch: Omit<StoredMeasurementSession, "id">
): boolean {
  const store = read()
  const list = store[clientId] ?? []
  let found = false
  const next = list.map((m) => (m.id === id ? ((found = true), { ...patch, id }) : m))
  if (found) write({ ...store, [clientId]: next })
  return found
}

/** Delete a stored session. Returns true if a row was removed. */
export function deleteStoredMeasurementSession(clientId: string, id: string): boolean {
  const store = read()
  const list = store[clientId] ?? []
  const next = list.filter((m) => m.id !== id)
  if (next.length === list.length) return false
  write({ ...store, [clientId]: next })
  return true
}
