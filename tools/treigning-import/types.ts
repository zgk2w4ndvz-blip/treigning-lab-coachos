// Shared types for the Treigning Lab → CoachOS importer.

/** A raw athlete record as captured from Treigning Lab (shape unknown). */
export type RawAthlete = Record<string, unknown>

/** Maps to a CoachOS `clients` row (minus id/coach_id, set at upsert time). */
export interface ClientRow {
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  sport: string | null
  current_weight_class: string | null
  current_weight: number | null
  goal_weight: number | null
  next_competition: string | null
  competition_date: string | null // yyyy-MM-dd
  notes: string | null
}

/** Maps to a CoachOS `weight_logs` row (the body-composition snapshot). */
export interface BodyCompRow {
  weight_lbs: number
  body_fat_pct: number | null
  body_fat_mass_lbs: number | null
  bmr: number | null
  total_body_water_lbs: number | null
  skeletal_muscle_mass_lbs: number | null
  logged_at: string // ISO datetime
}

/** Maps to a CoachOS `biomarker_readings` row (the labs vertical). */
export interface BiomarkerRow {
  marker: string // normalized key, e.g. "hrv"
  label: string | null // original field name
  value_num: number | null
  value_text: string | null
  unit: string | null
  category: string | null // recovery | performance | blood | other
  measured_at: string // ISO datetime
}

/** One athlete fully transformed into CoachOS-shaped data. */
export interface ImportRow {
  client: ClientRow
  bodyComp: BodyCompRow | null
  biomarkers: BiomarkerRow[]
  /** Lower-cased email when present — primary dedupe key. */
  email: string | null
  /** Fallback dedupe key: `${first}|${last}` lower-cased. */
  nameKey: string
  /** Biomarkers with no CoachOS destination table yet (kept for the labs vertical). */
  unmappedBiomarkers: Record<string, unknown>
  /** The original raw record, for traceability. */
  source: RawAthlete
}
