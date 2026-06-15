// ============================================================================
// Dev prescription store — local persistence for prescriptions created by
// approving inbox suggestions in dev bypass. Saved to .dev-data/prescriptions.json
// (keyed by client id) and overlaid on the mock seed by lib/data/prescriptions.ts.
// Server-only.
// ============================================================================

import "server-only"

import fs from "node:fs"
import path from "node:path"

import type { SuggestionDomain } from "@/types/database"

export interface StoredPrescription {
  id: string
  domain: SuggestionDomain
  title: string
  protocol: string
  status: "active" | "completed" | "cancelled"
  createdAt: string
}

type Store = Record<string, StoredPrescription[]>

const FILE = path.join(process.cwd(), ".dev-data", "prescriptions.json")

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

export function getStoredPrescriptions(clientId: string): StoredPrescription[] {
  return read()[clientId] ?? []
}

export function addStoredPrescription(clientId: string, p: StoredPrescription): void {
  const store = read()
  write({ ...store, [clientId]: [p, ...(store[clientId] ?? [])] })
}
