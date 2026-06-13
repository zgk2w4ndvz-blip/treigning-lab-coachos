// Shared date-range handling for athlete detail pages (?range=7|30|90).

export const RANGE_OPTIONS = [7, 30, 90] as const
export type RangeDays = (typeof RANGE_OPTIONS)[number]

const DEFAULT_RANGE: RangeDays = 30

/** Parse a `range` search param into an allowed window (default 30). */
export function parseRange(
  searchParams: Record<string, string | string[] | undefined> | undefined
): RangeDays {
  const raw = Array.isArray(searchParams?.range)
    ? searchParams?.range[0]
    : searchParams?.range
  const n = Number(raw)
  return (RANGE_OPTIONS as readonly number[]).includes(n)
    ? (n as RangeDays)
    : DEFAULT_RANGE
}

export function rangeLabel(days: RangeDays): string {
  return days === 7 ? "7-day" : days === 30 ? "30-day" : "90-day"
}
