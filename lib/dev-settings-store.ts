// ============================================================================
// Dev settings store — local persistence for coach settings in dev bypass.
//
// In dev auth bypass mode there is no Supabase, so the Settings form persists
// to .dev-data/settings.json instead of the `coach_settings` table. The stored
// payload is the full CoachSettingsData minus `devMode` (which is env-driven
// and re-attached at read time). Server-only (uses fs).
// ============================================================================

import "server-only"

import fs from "node:fs"
import path from "node:path"

import type { CoachSettingsData } from "@/types/models"

/** Everything except the env-derived devMode flag. */
export type StoredSettings = Omit<CoachSettingsData, "devMode">

const FILE = path.join(process.cwd(), ".dev-data", "settings.json")

let cache: { mtimeMs: number; settings: StoredSettings } | null = null

/** Saved settings, or null when the coach has never saved (use defaults). */
export function readStoredSettings(): StoredSettings | null {
  try {
    const stat = fs.statSync(FILE)
    if (!cache || cache.mtimeMs !== stat.mtimeMs) {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as {
        settings?: StoredSettings
      }
      if (!raw?.settings) return null
      cache = { mtimeMs: stat.mtimeMs, settings: raw.settings }
    }
    return cache.settings
  } catch {
    return null
  }
}

export function writeStoredSettings(settings: StoredSettings): void {
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  fs.writeFileSync(
    FILE,
    JSON.stringify(
      { savedAt: new Date().toISOString(), settings },
      null,
      2
    )
  )
  cache = null
}
