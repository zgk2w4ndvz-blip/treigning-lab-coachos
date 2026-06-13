// ============================================================================
// Dev body-composition store — local persistence for manually-entered
// measurements in dev bypass. Coach-entered body composition readings are
// appended to .dev-data/body-comp.json (keyed by client id) and overlaid on the
// deterministic mock series so they read back. Server-only (uses fs).
// ============================================================================

import "server-only"

import fs from "node:fs"
import path from "node:path"

export interface StoredMeasurement {
  id: string
  loggedAt: string // ISO datetime
  weightLbs: number
  bodyFatPct: number | null
  bodyFatMassLbs: number | null
  bmr: number | null
  totalBodyWaterLbs: number | null
  skeletalMuscleMassLbs: number | null
  notes: string | null
}

type Store = Record<string, StoredMeasurement[]>

const FILE = path.join(process.cwd(), ".dev-data", "body-comp.json")

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

/** Manually-entered measurements for one client (oldest → newest). */
export function getStoredMeasurements(clientId: string): StoredMeasurement[] {
  return read()[clientId] ?? []
}

export function addStoredMeasurement(
  clientId: string,
  m: StoredMeasurement
): void {
  const store = read()
  const list = [...(store[clientId] ?? []), m]
  write({ ...store, [clientId]: list })
}
