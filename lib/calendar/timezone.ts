// ============================================================================
// Operating-timezone helpers for the calendar. Single gym operating timezone
// (coach_settings.timezone, default America/Chicago) is the authority for ALL
// calendar date math — storage, recurrence expansion, day grouping, rendering.
//
// Implemented with the built-in Intl API (no dependency) so the SAME code runs
// identically on the server (Vercel/UTC) and in the browser: every function
// takes an explicit IANA `timeZone` and never reads the ambient runtime zone.
// ============================================================================

/** Default operating timezone when coach_settings.timezone is empty/invalid. */
export const DEFAULT_OPERATING_TZ = "America/Chicago"

/** True if `tz` is a valid IANA timezone the runtime understands. */
export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Coerce to a usable operating timezone (validated, else the default). */
export function operatingTimeZone(tz: string | null | undefined): string {
  return isValidTimeZone(tz) ? tz : DEFAULT_OPERATING_TZ
}

const pad = (n: number) => String(n).padStart(2, "0")

interface ZonedParts {
  year: number
  month: number // 1-12
  day: number
  hour: number // 0-23
  minute: number
  second: number
}

const PART_DTF_CACHE = new Map<string, Intl.DateTimeFormat>()
function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = PART_DTF_CACHE.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    PART_DTF_CACHE.set(tz, f)
  }
  return f
}

/** The wall-clock parts of `instant` as observed in `tz`. */
export function zonedParts(instant: Date, tz: string): ZonedParts {
  const map: Record<string, string> = {}
  for (const p of partsFormatter(tz).formatToParts(instant)) {
    if (p.type !== "literal") map[p.type] = p.value
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour === "24" ? "0" : map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  }
}

/** Milliseconds `tz` is ahead of UTC at `instant` (negative for the Americas). */
export function tzOffsetMs(instant: Date, tz: string): number {
  const p = zonedParts(instant, tz)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - instant.getTime()
}

/** Local civil day in `tz` as "yyyy-MM-dd" (the calendar's grouping key). */
export function dayKeyInZone(instant: Date, tz: string): string {
  const p = zonedParts(instant, tz)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** Day-of-week (0=Sun..6=Sat) of the civil day `instant` falls on in `tz`. */
export function weekdayInZone(instant: Date, tz: string): number {
  const p = zonedParts(instant, tz)
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()
}

const WALL_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/

/**
 * Interpret a timezone-naive wall-clock string ("yyyy-MM-ddTHH:mm[:ss]") as a
 * time in `tz` and return the corresponding UTC instant. This is what turns
 * "4:00 PM in Oklahoma" into the correct UTC instant (21:00Z in CDT, 22:00Z in
 * CST). Returns null for unparseable input. DST-safe (resolves the offset at the
 * target instant, with one refinement pass for transition days).
 */
export function wallClockToUtc(wall: string, tz: string): Date | null {
  const m = WALL_RE.exec(wall.trim())
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m
  const asUtc = Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0)
  // Real instant = wall-as-UTC minus the zone offset at that instant. The offset
  // itself depends on the instant, so refine once to settle DST boundaries.
  let off = tzOffsetMs(new Date(asUtc), tz)
  let utc = asUtc - off
  const off2 = tzOffsetMs(new Date(utc), tz)
  if (off2 !== off) {
    off = off2
    utc = asUtc - off
  }
  return new Date(utc)
}

/**
 * Format a UTC instant as a timezone-naive "yyyy-MM-ddTHH:mm" wall-clock string
 * in `tz` — the value for an <input type="datetime-local"> so the coach sees the
 * operating-timezone time regardless of their browser zone.
 */
export function instantToZonedInput(iso: string | null, tz: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const p = zonedParts(d, tz)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

/**
 * Add `days` civil days to `instant` while preserving its wall-clock time in
 * `tz`, returning the new UTC instant. DST-correct: "Tue 4:00 PM" + 7 days stays
 * "Tue 4:00 PM" local even when the UTC offset changed across the boundary.
 */
export function addZonedDays(instant: Date, days: number, tz: string): Date {
  const p = zonedParts(instant, tz)
  const civ = new Date(Date.UTC(p.year, p.month - 1, p.day))
  civ.setUTCDate(civ.getUTCDate() + days)
  const wall = `${civ.getUTCFullYear()}-${pad(civ.getUTCMonth() + 1)}-${pad(
    civ.getUTCDate()
  )}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`
  return wallClockToUtc(wall, tz) ?? instant
}

/** End-of-day (23:59:59) of a yyyy-MM-dd local date in `tz`, as a UTC instant. */
export function zonedEndOfDay(localDate: string, tz: string): Date | null {
  return wallClockToUtc(`${localDate.slice(0, 10)}T23:59:59`, tz)
}

/** The civil day before a yyyy-MM-dd date (date-only arithmetic, TZ-agnostic). */
export function previousLocalDay(localDate: string): string {
  const t = Date.parse(`${localDate.slice(0, 10)}T00:00:00Z`) - 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}
