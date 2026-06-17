// ============================================================================
// Dev Low Base store — local persistence for the Low Base prescription in dev
// bypass (one row per client). Mirrors the real low_base_prescriptions table so
// the tab works without Supabase. Server-only (uses fs).
// ============================================================================

import "server-only"

import fs from "node:fs"
import path from "node:path"

export interface StoredLowBase {
  mep_bpm: number
  frequency_per_week: number
  minutes_per_session: number
  notes: string | null
  created_at: string
  updated_at: string
}

type Store = Record<string, StoredLowBase>

const FILE = path.join(process.cwd(), ".dev-data", "low-base.json")

function read(): Store {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as Store
  } catch {
    return {}
  }
}

function write(store: Store): void {
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify(store, null, 2))
}

export function getStoredLowBase(clientId: string): StoredLowBase | null {
  return read()[clientId] ?? null
}

export function setStoredLowBase(
  clientId: string,
  data: Omit<StoredLowBase, "created_at" | "updated_at">
): void {
  const store = read()
  const now = new Date().toISOString()
  const prev = store[clientId]
  store[clientId] = { ...data, created_at: prev?.created_at ?? now, updated_at: now }
  write(store)
}
