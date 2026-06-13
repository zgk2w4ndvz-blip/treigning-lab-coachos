// ============================================================================
// Roster CSV parsing — pure functions, safe on client and server.
// Handles quoted fields, escaped quotes, CRLF, and flexible headers.
// ============================================================================

import type { ImportedAthlete } from "@/types/models"

export const ROSTER_COLUMNS = [
  { key: "first_name", required: true, example: "Alex", note: "Required" },
  { key: "last_name", required: true, example: "Rivera", note: "Required" },
  { key: "email", required: false, example: "alex@email.com", note: "Optional" },
  { key: "phone", required: false, example: "555-201-7788", note: "Optional" },
  { key: "sport", required: false, example: "Wrestling", note: "Optional" },
  { key: "weight_class", required: false, example: "213.85 (97kg)", note: "Text or number" },
  { key: "current_weight", required: false, example: "164.5", note: "Number in lb (units stripped)" },
  { key: "goal_weight", required: false, example: "157", note: "Number in lb (units stripped)" },
  { key: "next_competition", required: false, example: "Regional Duals", note: "Optional" },
  { key: "competition_date", required: false, example: "2026-07-12", note: "YYYY-MM-DD, MM/DD/YYYY, or TBD" },
  { key: "coach_notes", required: false, example: "Cutting for regionals", note: "Optional" },
  { key: "body_fat_pct", required: false, example: "14.5", note: "Body composition (optional)" },
  { key: "body_fat_mass", required: false, example: "26.1", note: "Body comp, lb (optional)" },
  { key: "skeletal_muscle_mass", required: false, example: "92.4", note: "Body comp, lb (optional)" },
  { key: "total_body_water", required: false, example: "118.7", note: "Body comp, lb (optional)" },
  { key: "bmr", required: false, example: "1850", note: "Body comp, kcal (optional)" },
] as const

export const SAMPLE_CSV = `first_name,last_name,email,phone,sport,weight_class,current_weight,goal_weight,next_competition,competition_date,coach_notes
Alex,Rivera,alex@email.com,555-201-7788,Wrestling,157,164.5,157,Regional Duals,2026-07-12,"Cutting for regionals, watch hydration"
Jamie,Lee,jamie@email.com,,MMA,Lightweight (155),162,155,Summer Showdown,2026-07-26,
Chris,Okoro,,555-310-4521,Powerlifting,-83kg,185,183,,,Off-season strength block`

/** Minimal RFC-4180-ish CSV parser: quotes, escaped quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ",") {
      row.push(field)
      field = ""
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      if (row.some((f) => f.trim() !== "")) rows.push(row)
      row = []
      field = ""
    } else {
      field += ch
    }
  }
  row.push(field)
  if (row.some((f) => f.trim() !== "")) rows.push(row)
  return rows
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_")
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

/** Placeholder values that mean "no date yet" — accepted, not flagged. */
const NO_DATE_TOKENS = new Set(["tbd", "tba", "n/a", "na", "none", "-", "—", "?"])

/**
 * Accepts YYYY-MM-DD, MM/DD/YYYY, or a "no date yet" placeholder (TBD, TBA,
 * N/A, …). Returns yyyy-MM-dd, or null. `bad` is only true for an unparseable
 * non-empty, non-placeholder value.
 */
function parseDate(raw: string): { value: string | null; bad: boolean } {
  const s = raw.trim()
  if (!s) return { value: null, bad: false }
  if (NO_DATE_TOKENS.has(s.toLowerCase())) return { value: null, bad: false }
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) {
    return {
      value: `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`,
      bad: false,
    }
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    return {
      value: `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`,
      bad: false,
    }
  }
  const t = Date.parse(s)
  if (!Number.isNaN(t)) {
    return { value: new Date(t).toISOString().slice(0, 10), bad: false }
  }
  return { value: null, bad: true }
}

/**
 * Extracts the first numeric token from a value, so "164.5", "~157", and
 * "213.85 (97kg)" all yield a clean number (213.85). Keeps 2 decimals to match
 * the `numeric(6,2)` weight columns. `bad` is true only for a non-empty value
 * with no parseable number.
 */
function parseNumber(raw: string): { value: number | null; bad: boolean } {
  const s = raw.trim()
  if (!s) return { value: null, bad: false }
  const m = s.match(/-?\d+(?:\.\d+)?/)
  if (!m) return { value: null, bad: true }
  const n = Number(m[0])
  if (Number.isNaN(n) || n <= 0) return { value: null, bad: true }
  return { value: Math.round(n * 100) / 100, bad: false }
}

export interface RosterParseResult {
  athletes: ImportedAthlete[]
  errors: string[]
}

/** Parse + validate a roster CSV into ImportedAthlete rows. */
export function parseRosterCsv(text: string): RosterParseResult {
  const errors: string[] = []
  const grid = parseCsv(text ?? "")
  if (grid.length === 0) {
    return { athletes: [], errors: ["No CSV content found."] }
  }

  const headers = grid[0].map(normalizeHeader)
  const col = (name: string) => headers.indexOf(name)

  if (col("first_name") === -1 || col("last_name") === -1) {
    return {
      athletes: [],
      errors: [
        "Header row must include at least first_name and last_name. Check that the first line of your CSV is the header.",
      ],
    }
  }

  const known = new Set(ROSTER_COLUMNS.map((c) => c.key as string))
  const unknown = headers.filter((h) => h && !known.has(h))
  if (unknown.length > 0) {
    errors.push(`Ignored unrecognized column(s): ${unknown.join(", ")}`)
  }

  const get = (row: string[], name: string) => {
    const i = col(name)
    return i === -1 ? "" : (row[i] ?? "").trim()
  }

  const athletes: ImportedAthlete[] = []
  const seen = new Map<string, number>()

  for (let r = 1; r < grid.length; r++) {
    const row = grid[r]
    const rowNo = r + 1
    const first = get(row, "first_name")
    const last = get(row, "last_name")
    if (!first || !last) {
      errors.push(`Row ${rowNo}: skipped — first_name and last_name are required.`)
      continue
    }

    const current = parseNumber(get(row, "current_weight"))
    if (current.bad)
      errors.push(`Row ${rowNo}: invalid current_weight "${get(row, "current_weight")}" — ignored.`)
    const goal = parseNumber(get(row, "goal_weight"))
    if (goal.bad)
      errors.push(`Row ${rowNo}: invalid goal_weight "${get(row, "goal_weight")}" — ignored.`)
    const compDate = parseDate(get(row, "competition_date"))
    if (compDate.bad)
      errors.push(`Row ${rowNo}: invalid competition_date "${get(row, "competition_date")}" — ignored. Use YYYY-MM-DD.`)

    // Optional body-composition values (silently ignored if blank/invalid).
    const bodyFat = parseNumber(get(row, "body_fat_pct"))
    const fatMass = parseNumber(get(row, "body_fat_mass"))
    const smm = parseNumber(get(row, "skeletal_muscle_mass"))
    const tbw = parseNumber(get(row, "total_body_water"))
    const bmr = parseNumber(get(row, "bmr"))

    const base = slug(`${first}-${last}`) || `athlete-${rowNo}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)

    athletes.push({
      id: `imp-${base}${n > 1 ? `-${n}` : ""}`,
      firstName: first,
      lastName: last,
      email: get(row, "email") || null,
      phone: get(row, "phone") || null,
      sport: get(row, "sport") || null,
      weightClass: get(row, "weight_class") || null,
      currentWeight: current.value,
      goalWeight: goal.value,
      nextCompetition: get(row, "next_competition") || null,
      competitionDate: compDate.value,
      coachNotes: get(row, "coach_notes") || null,
      bodyFatPct: bodyFat.value,
      bodyFatMassLbs: fatMass.value,
      skeletalMuscleMassLbs: smm.value,
      totalBodyWaterLbs: tbw.value,
      bmr: bmr.value,
    })
  }

  if (athletes.length === 0 && errors.length === 0) {
    errors.push("No athlete rows found below the header.")
  }
  return { athletes, errors }
}
