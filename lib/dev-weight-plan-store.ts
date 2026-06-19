// ============================================================================
// Dev weight-plan store — local persistence for the active weight plan + its
// materialized weekly targets in dev bypass (one active plan per client).
// Mirrors weight_plans / weight_plan_targets. Server-only (uses fs).
// ============================================================================

import "server-only"

import fs from "node:fs"
import path from "node:path"

export interface StoredWeightTarget {
  week_index: number
  week_start: string
  target_weight: number
  calorie_target: number | null
  protein_target_g: number | null
  potassium_target_mg: number | null
}

export interface StoredWeightPlan {
  id: string
  current_weight: number
  goal_weight: number
  competition_weight: number | null
  start_date: string
  target_date: string
  competition_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
  targets: StoredWeightTarget[]
}

type Store = Record<string, StoredWeightPlan>

const FILE = path.join(process.cwd(), ".dev-data", "weight-plans.json")

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

export function getStoredWeightPlan(clientId: string): StoredWeightPlan | null {
  return read()[clientId] ?? null
}

export function setStoredWeightPlan(clientId: string, plan: StoredWeightPlan): void {
  const store = read()
  write({ ...store, [clientId]: plan })
}

export function deleteStoredWeightPlan(clientId: string): boolean {
  const store = read()
  if (!store[clientId]) return false
  const next = { ...store }
  delete next[clientId]
  write(next)
  return true
}
