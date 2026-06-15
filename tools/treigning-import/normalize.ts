// Pure normalization helpers — no I/O, easy to unit-test.

/** Trim to a non-empty string, or null. */
export function cleanStr(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s.length > 0 ? s : null
}

/**
 * First numeric token in a value: "213.85 (97kg)" → 213.85, "~157" → 157.
 * Returns null for blanks / non-numeric / non-positive.
 */
export function toNumber(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? round2(v) : null
  const m = String(v).match(/-?\d+(?:\.\d+)?/)
  if (!m) return null
  const n = Number(m[0])
  return Number.isFinite(n) && n > 0 ? round2(n) : null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Split a full name into first/last (last token = last name; rest = first). */
export function splitName(full: unknown): { first: string; last: string } {
  const s = cleanStr(full) ?? ""
  const parts = s.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: "", last: "" }
  if (parts.length === 1) return { first: parts[0], last: "" }
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] }
}

export function normEmail(v: unknown): string | null {
  const s = cleanStr(v)
  if (!s) return null
  const lower = s.toLowerCase()
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lower) ? lower : null
}

/** Keep digits and common phone punctuation; drop anything else. */
export function normPhone(v: unknown): string | null {
  const s = cleanStr(v)
  if (!s) return null
  const cleaned = s.replace(/[^\d+()\-.\s]/g, "").trim()
  return cleaned.length >= 7 ? cleaned : null
}

/** yyyy-MM-dd from common date inputs; null for blanks / "TBD" / unparseable. */
export function normDate(v: unknown): string | null {
  const s = cleanStr(v)
  if (!s) return null
  if (/^(tbd|tba|n\/?a|none|-)$/i.test(s)) return null
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10)
}

/** Dedupe key from a name: "Jordan|Vance" lower-cased. */
export function nameKey(first: string, last: string): string {
  return `${first.trim().toLowerCase()}|${last.trim().toLowerCase()}`
}

/** First defined, non-empty value among several candidate keys (case-insensitive). */
export function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  const lowerMap = new Map<string, unknown>()
  for (const [k, val] of Object.entries(obj)) lowerMap.set(k.toLowerCase(), val)
  for (const k of keys) {
    const val = lowerMap.get(k.toLowerCase())
    if (val != null && String(val).trim() !== "") return val
  }
  return undefined
}
