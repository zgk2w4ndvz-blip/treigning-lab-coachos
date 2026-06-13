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
