// Local sync cursor. The ONLY thing the bridge persists about your messages is
// the highest Messages ROWID it has processed (a number) + a timestamp — never
// message content. Enables incremental, idempotent syncs across restarts.

import fs from "node:fs"
import path from "node:path"

export interface SyncState {
  lastRowId: number
  lastSyncedAt: string | null
}

export function readState(p: string): SyncState {
  try {
    const s = JSON.parse(fs.readFileSync(p, "utf8")) as Partial<SyncState>
    return { lastRowId: Number(s.lastRowId) || 0, lastSyncedAt: s.lastSyncedAt ?? null }
  } catch {
    return { lastRowId: 0, lastSyncedAt: null }
  }
}

export function writeState(p: string, s: SyncState): void {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(s, null, 2))
}
