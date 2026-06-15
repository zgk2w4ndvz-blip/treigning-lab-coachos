// ============================================================================
// Dev inbox store — local persistence for the message-ingestion approval queue
// in dev bypass. Holds suggestions created by manual import plus per-suggestion
// status overrides (approve/edit/reject), saved to .dev-data/inbox.json and
// overlaid on the mock seed by lib/data/inbox.ts. Server-only.
// ============================================================================

import "server-only"

import fs from "node:fs"
import path from "node:path"

import type { ReviewQueueItem, SuggestionStatus } from "@/types/models"

export interface SuggestionOverride {
  status: SuggestionStatus
  reviewedAt: string
  editedProtocol?: string
}

interface InboxFile {
  created: ReviewQueueItem[]
  overrides: Record<string, SuggestionOverride>
}

const FILE = path.join(process.cwd(), ".dev-data", "inbox.json")
const EMPTY: InboxFile = { created: [], overrides: {} }

let cache: { mtimeMs: number; data: InboxFile } | null = null

function read(): InboxFile {
  try {
    const stat = fs.statSync(FILE)
    if (!cache || cache.mtimeMs !== stat.mtimeMs) {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as Partial<InboxFile>
      cache = {
        mtimeMs: stat.mtimeMs,
        data: {
          created: Array.isArray(raw.created) ? raw.created : [],
          overrides: raw.overrides ?? {},
        },
      }
    }
    return cache.data
  } catch {
    return EMPTY
  }
}

function write(data: InboxFile): void {
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2))
  cache = null
}

export function getCreatedSuggestions(): ReviewQueueItem[] {
  return read().created
}

export function addCreatedSuggestions(items: ReviewQueueItem[]): void {
  const data = read()
  write({ ...data, created: [...items, ...data.created] })
}

export function getSuggestionOverrides(): Record<string, SuggestionOverride> {
  return read().overrides
}

export function setSuggestionOverride(id: string, override: SuggestionOverride): void {
  const data = read()
  write({ ...data, overrides: { ...data.overrides, [id]: override } })
}
