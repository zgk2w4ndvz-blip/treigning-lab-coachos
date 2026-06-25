import {
  format,
  formatDistanceToNowStrict,
  differenceInCalendarDays,
  parseISO,
} from "date-fns"

/** Human initials from a name, e.g. "Jordan Vance" -> "JV". */
export function initials(name: string | null | undefined): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")
}

export function fullName(first: string, last: string): string {
  return `${first} ${last}`.trim()
}

/**
 * Roster/list/selector display name: "Last, First" (e.g. "Ramirez, Julian").
 * Falls back to whichever part is present so it never renders a stray comma.
 * Use this anywhere clients are listed, picked, or filtered — keep the profile
 * header on `fullName` ("First Last").
 */
export function rosterName(first: string, last: string): string {
  const f = (first ?? "").trim()
  const l = (last ?? "").trim()
  if (f && l) return `${l}, ${f}`
  return l || f
}

/** Sort comparator: last name A→Z, then first name A→Z. Locale-aware and
 *  case-insensitive. Pass to `Array.prototype.sort`. */
export function compareByLastFirst(
  a: { first_name: string; last_name: string },
  b: { first_name: string; last_name: string }
): number {
  const byLast = a.last_name.localeCompare(b.last_name, undefined, {
    sensitivity: "base",
  })
  if (byLast !== 0) return byLast
  return a.first_name.localeCompare(b.first_name, undefined, {
    sensitivity: "base",
  })
}

/** Sort comparator: first name A→Z, then last name A→Z. Locale-aware and
 *  case-insensitive. Pass to `Array.prototype.sort`. */
export function compareByFirstLast(
  a: { first_name: string; last_name: string },
  b: { first_name: string; last_name: string }
): number {
  const byFirst = a.first_name.localeCompare(b.first_name, undefined, {
    sensitivity: "base",
  })
  if (byFirst !== 0) return byFirst
  return a.last_name.localeCompare(b.last_name, undefined, {
    sensitivity: "base",
  })
}

/** "Jun 14, 2026" */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—"
  const d = typeof value === "string" ? parseISO(value) : value
  return format(d, "MMM d, yyyy")
}

/** "Jun 14" */
export function formatDateShort(value: string | Date | null | undefined): string {
  if (!value) return "—"
  const d = typeof value === "string" ? parseISO(value) : value
  return format(d, "MMM d")
}

/** "3 days ago" */
export function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return "—"
  const d = typeof value === "string" ? parseISO(value) : value
  return `${formatDistanceToNowStrict(d)} ago`
}

/** Whole days from today until a target date (negative = past). */
export function daysUntil(value: string | Date | null | undefined): number | null {
  if (!value) return null
  const d = typeof value === "string" ? parseISO(value) : value
  return differenceInCalendarDays(d, new Date())
}

/** "in 12 days" / "today" / "5 days ago" */
export function relativeDays(value: string | Date | null | undefined): string {
  const n = daysUntil(value)
  if (n === null) return "—"
  if (n === 0) return "today"
  if (n > 0) return `in ${n} day${n === 1 ? "" : "s"}`
  return `${Math.abs(n)} day${n === -1 ? "" : "s"} ago`
}

export function formatWeight(lbs: number | null | undefined): string {
  if (lbs == null) return "—"
  return `${lbs.toLocaleString(undefined, { maximumFractionDigits: 1 })} lb`
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—"
  return n.toLocaleString()
}

/** Clamp a 0–100 score and round it. */
export function compliancePct(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)))
}

/** Today's date as yyyy-MM-dd (server-safe; for date input defaults). */
export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}
