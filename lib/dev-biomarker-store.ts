// ============================================================================
// Dev biomarker store — local persistence for manually-entered lab readings in
// dev bypass. Appends to .dev-data/biomarkers.json (keyed by client id) and is
// overlaid on the mock series by lib/data/biomarkers.ts. Server-only.
// ============================================================================

import "server-only"

import fs from "node:fs"
import path from "node:path"

export interface StoredBiomarker {
  id: string
  marker: string
  label: string
  valueNum: number | null
  valueText: string | null
  unit: string | null
  category: string
  measuredAt: string // ISO datetime
}

type Store = Record<string, StoredBiomarker[]>

const FILE = path.join(process.cwd(), ".dev-data", "biomarkers.json")

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

export function getStoredBiomarkers(clientId: string): StoredBiomarker[] {
  return read()[clientId] ?? []
}

export function addStoredBiomarker(clientId: string, b: StoredBiomarker): void {
  const store = read()
  write({ ...store, [clientId]: [...(store[clientId] ?? []), b] })
}
