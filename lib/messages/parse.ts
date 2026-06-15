// ============================================================================
// Message import parser — CSV or JSON → normalized ParsedMessage records.
// Source-agnostic: the same shape will back Gmail / SMS / WhatsApp adapters
// later; for now it handles manual CSV/JSON paste or upload.
// ============================================================================

import { parseCsv } from "@/lib/import/csv"
import type { MessageSource } from "@/types/database"

export interface ParsedMessage {
  source: MessageSource
  externalId: string | null
  senderName: string | null
  senderPhone: string | null
  senderEmail: string | null
  body: string
  receivedAt: string | null // ISO
}

export interface ParseResult {
  messages: ParsedMessage[]
  errors: string[]
}

const SOURCES: MessageSource[] = ["gmail", "sms", "imessage", "whatsapp", "manual", "csv", "json"]

function asSource(v: unknown, fallback: MessageSource): MessageSource {
  const s = String(v ?? "").trim().toLowerCase()
  return (SOURCES as string[]).includes(s) ? (s as MessageSource) : fallback
}

function str(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s.length ? s : null
}

function toIso(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

const FIELDS = {
  source: ["source", "channel", "platform"],
  externalId: ["external_id", "id", "message_id", "guid"],
  senderName: ["sender_name", "name", "from_name", "contact"],
  senderPhone: ["sender_phone", "phone", "from", "from_number", "number"],
  senderEmail: ["sender_email", "email", "from_email"],
  body: ["body", "text", "message", "content", "snippet"],
  receivedAt: ["received_at", "date", "timestamp", "time", "sent_at"],
}

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  const lower = new Map(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]))
  for (const k of keys) {
    const v = lower.get(k.toLowerCase())
    if (v != null && String(v).trim() !== "") return v
  }
  return undefined
}

function fromObject(o: Record<string, unknown>, fallbackSource: MessageSource): ParsedMessage | null {
  const body = str(pick(o, FIELDS.body))
  if (!body) return null
  return {
    source: asSource(pick(o, FIELDS.source), fallbackSource),
    externalId: str(pick(o, FIELDS.externalId)),
    senderName: str(pick(o, FIELDS.senderName)),
    senderPhone: str(pick(o, FIELDS.senderPhone)),
    senderEmail: str(pick(o, FIELDS.senderEmail)),
    body,
    receivedAt: toIso(pick(o, FIELDS.receivedAt)),
  }
}

/** Parse pasted/uploaded messages. Auto-detects JSON vs CSV. */
export function parseMessages(text: string, formatHint?: "csv" | "json"): ParseResult {
  const errors: string[] = []
  const trimmed = (text ?? "").trim()
  if (!trimmed) return { messages: [], errors: ["No message content provided."] }

  const isJson = formatHint === "json" || (!formatHint && /^[[{]/.test(trimmed))

  if (isJson) {
    let data: unknown
    try {
      data = JSON.parse(trimmed)
    } catch (e) {
      return { messages: [], errors: [`Invalid JSON: ${e instanceof Error ? e.message : e}`] }
    }
    const arr = Array.isArray(data) ? data : [data]
    const messages: ParsedMessage[] = []
    arr.forEach((o, i) => {
      if (o && typeof o === "object") {
        const m = fromObject(o as Record<string, unknown>, "json")
        if (m) messages.push(m)
        else errors.push(`Item ${i + 1}: missing a message body — skipped.`)
      }
    })
    return { messages, errors }
  }

  // CSV
  const grid = parseCsv(trimmed)
  if (grid.length < 2) return { messages: [], errors: ["CSV needs a header row and at least one message."] }
  const headers = grid[0].map((h) => h.trim().toLowerCase())
  const messages: ParsedMessage[] = []
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r]
    const obj: Record<string, unknown> = {}
    headers.forEach((h, i) => (obj[h] = row[i]))
    const m = fromObject(obj, "csv")
    if (m) messages.push(m)
    else errors.push(`Row ${r + 1}: missing a message body — skipped.`)
  }
  if (messages.length === 0 && errors.length === 0)
    errors.push("No message rows found below the header.")
  return { messages, errors }
}
