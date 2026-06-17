// ============================================================================
// Dev metabolic store — local persistence for metabolic assessments + their
// curve points in dev bypass. Appended to .dev-data/metabolic.json (keyed by
// client id). Points are embedded on each assessment so a session round-trips
// as a unit. Server-only (uses fs). Mirrors dev-body-comp-store / dev-low-base.
// ============================================================================

import "server-only"

import fs from "node:fs"
import path from "node:path"

export interface StoredCurvePoint {
  id: string
  stage: number
  intensity: number | null
  heartRateBpm: number | null
  ventilationLMin: number | null
  vo2: number | null
}

export interface StoredAssessment {
  id: string
  assessedAt: string // ISO datetime
  vo2Max: number | null
  mepBpm: number | null
  aerobicThresholdBpm: number | null
  maxHrBpm: number | null
  notes: string | null
  points: StoredCurvePoint[]
}

type Store = Record<string, StoredAssessment[]>

const FILE = path.join(process.cwd(), ".dev-data", "metabolic.json")

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

/** Stored assessments for one client (oldest → newest). */
export function getStoredAssessments(clientId: string): StoredAssessment[] {
  return read()[clientId] ?? []
}

export function addStoredAssessment(clientId: string, a: StoredAssessment): void {
  const store = read()
  const list = [...(store[clientId] ?? []), a]
  write({ ...store, [clientId]: list })
}

/** Delete an assessment (and its embedded points). Returns true if removed. */
export function deleteStoredAssessment(clientId: string, id: string): boolean {
  const store = read()
  const list = store[clientId] ?? []
  const next = list.filter((a) => a.id !== id)
  if (next.length === list.length) return false
  write({ ...store, [clientId]: next })
  return true
}

/** A single stored assessment by id, or null. */
export function getStoredAssessment(
  clientId: string,
  id: string
): StoredAssessment | null {
  return getStoredAssessments(clientId).find((a) => a.id === id) ?? null
}
