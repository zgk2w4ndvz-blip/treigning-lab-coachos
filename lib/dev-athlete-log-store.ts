// ============================================================================
// Dev athlete-log store — local persistence for the athlete portal in bypass.
//
// The athlete portal lets a client log their own daily entries. In dev auth
// bypass there is no Supabase, so entries are saved to
// .dev-data/athlete-logs.json, keyed by client id → date (yyyy-MM-dd). These
// overlay the deterministic mock history so the day reads back what was logged.
// Server-only (uses fs).
// ============================================================================

import "server-only"

import fs from "node:fs"
import path from "node:path"

export interface AthleteDayEntry {
  weightLbs?: number | null
  hydrationOz?: number
  nutrition?: {
    calories: number | null
    protein: number | null
    carbs: number | null
    fat: number | null
  }
  recovery?: {
    sleepHours: number | null
    soreness: number | null
    energy: number | null
    stress: number | null
  }
  supplements?: Record<string, boolean> // supplementId → taken
}

type Store = Record<string, Record<string, AthleteDayEntry>>

const FILE = path.join(process.cwd(), ".dev-data", "athlete-logs.json")

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

/** One athlete's entry for a single day (empty object when nothing logged). */
export function getAthleteDay(clientId: string, date: string): AthleteDayEntry {
  return read()[clientId]?.[date] ?? {}
}

/** All of an athlete's dated entries (for streak / recent-completion math). */
export function getAthleteEntries(
  clientId: string
): Record<string, AthleteDayEntry> {
  return read()[clientId] ?? {}
}

/** Merge a patch into the athlete's entry for a day. */
export function updateAthleteDay(
  clientId: string,
  date: string,
  patch: Partial<AthleteDayEntry>
): void {
  const store = read()
  const forClient = { ...(store[clientId] ?? {}) }
  const day = forClient[date] ?? {}
  forClient[date] = { ...day, ...patch }
  write({ ...store, [clientId]: forClient })
}

/** Toggle a single supplement's taken-state for the day. */
export function setAthleteSupplement(
  clientId: string,
  date: string,
  supplementId: string,
  taken: boolean
): void {
  const day = getAthleteDay(clientId, date)
  updateAthleteDay(clientId, date, {
    supplements: { ...(day.supplements ?? {}), [supplementId]: taken },
  })
}
