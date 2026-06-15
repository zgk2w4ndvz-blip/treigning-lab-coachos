// ============================================================================
// CALIBRATION CONFIG — the one file you adjust after the first scrape.
//
// The scraper saves every JSON response Treigning Lab returns into
// raw-backup/. Open those, find the athlete records, and confirm/adjust:
//   1. SCRAPE.* — how to find athlete detail links + which responses hold data
//   2. FIELD_CANDIDATES — the raw key names for each CoachOS field
// Defaults below try common names so the dry-run works on the sample data.
// ============================================================================

import {
  cleanStr,
  nameKey,
  normDate,
  normEmail,
  normPhone,
  pick,
  splitName,
  toNumber,
  toNumberAny,
} from "./normalize"
import type {
  BiomarkerRow,
  BodyCompRow,
  ClientRow,
  ImportRow,
  RawAthlete,
} from "./types"

/** Classify a biomarker key into a coarse category for the labs vertical. */
function categorize(marker: string): string {
  if (/(hrv|resting_hr|rhr|sleep|readiness|stress|recovery)/.test(marker)) return "recovery"
  if (/(vo2|power|speed|watt|ftp|max)/.test(marker)) return "performance"
  if (/(ferritin|vitamin|testosterone|cortisol|glucose|cholesterol|hdl|ldl|tsh|hemoglobin|hba1c|iron|crp)/.test(marker)) return "blood"
  return "other"
}

// ---- scrape calibration ----------------------------------------------------

export const SCRAPE = {
  /** Env var holding the team athlete-list URL. */
  teamUrlEnv: "TREIGNING_TEAM_URL",
  /** Anchors matching these become athlete-detail pages to visit. */
  athleteLinkSelectors: ['a[href*="/athletes/"]', 'a[href*="/athlete/"]'],
  /** Only follow links whose href matches this (avoids nav/footer links). */
  athleteLinkUrlPattern: /\/athlete[s]?\//i,
  /** Capture JSON responses whose URL contains any of these substrings. */
  jsonResponseUrlIncludes: ["athlete", "team", "biometric", "measurement", "profile", "api"],
  /** If the page URL still contains this after load, we're on a login screen. */
  loginUrlIncludes: ["login", "sign-in", "signin", "auth"],
}

// ---- field mapping ---------------------------------------------------------

/** Candidate raw key names for each logical field (case-insensitive). */
export const FIELD_CANDIDATES = {
  fullName: ["name", "full_name", "fullName", "athlete_name", "displayName"],
  firstName: ["first_name", "firstName", "given_name", "first"],
  lastName: ["last_name", "lastName", "family_name", "surname", "last"],
  email: ["email", "email_address", "contact_email"],
  phone: ["phone", "phone_number", "mobile", "cell", "contact_phone"],
  sport: ["sport", "discipline", "primary_sport"],
  weightClass: ["weight_class", "weightClass", "division", "class"],
  currentWeight: ["weight", "current_weight", "body_weight", "weight_lbs", "mass"],
  goalWeight: ["goal_weight", "target_weight", "goalWeight"],
  nextCompetition: ["next_competition", "competition", "event", "next_event"],
  competitionDate: ["competition_date", "event_date", "next_competition_date"],
  notes: ["notes", "coach_notes", "comments", "remarks"],
  // body composition
  bodyFatPct: ["body_fat_pct", "body_fat", "bodyFat", "bf", "fat_percent", "fat_pct"],
  bodyFatMass: ["body_fat_mass", "fat_mass", "fat_mass_lbs"],
  skeletalMuscleMass: ["skeletal_muscle_mass", "smm", "muscle_mass", "lean_mass"],
  totalBodyWater: ["total_body_water", "tbw", "body_water"],
  bmr: ["bmr", "basal_metabolic_rate", "rmr"],
  measuredAt: ["measured_at", "date", "recorded_at", "updated_at", "timestamp"],
} as const

/** All raw keys we knowingly consume — used to compute "unmapped" biomarkers. */
export function consumedKeys(): Set<string> {
  const set = new Set<string>()
  for (const list of Object.values(FIELD_CANDIDATES))
    for (const k of list) set.add(k.toLowerCase())
  return set
}

/** Map one raw athlete to CoachOS-shaped rows. Pure; safe to re-run. */
export function mapAthlete(raw: RawAthlete): ImportRow {
  const c = FIELD_CANDIDATES

  // Name: prefer explicit first/last, else split a full name.
  let first = cleanStr(pick(raw, [...c.firstName])) ?? ""
  let last = cleanStr(pick(raw, [...c.lastName])) ?? ""
  if (!first && !last) {
    const split = splitName(pick(raw, [...c.fullName]))
    first = split.first
    last = split.last
  }

  const client: ClientRow = {
    first_name: first,
    last_name: last,
    email: normEmail(pick(raw, [...c.email])),
    phone: normPhone(pick(raw, [...c.phone])),
    sport: cleanStr(pick(raw, [...c.sport])),
    current_weight_class: cleanStr(pick(raw, [...c.weightClass])),
    current_weight: toNumber(pick(raw, [...c.currentWeight])),
    goal_weight: toNumber(pick(raw, [...c.goalWeight])),
    next_competition: cleanStr(pick(raw, [...c.nextCompetition])),
    competition_date: normDate(pick(raw, [...c.competitionDate])),
    notes: cleanStr(pick(raw, [...c.notes])),
  }

  const weight = client.current_weight
  const bf = toNumber(pick(raw, [...c.bodyFatPct]))
  const fatMass = toNumber(pick(raw, [...c.bodyFatMass]))
  const smm = toNumber(pick(raw, [...c.skeletalMuscleMass]))
  const tbw = toNumber(pick(raw, [...c.totalBodyWater]))
  const bmr = toNumber(pick(raw, [...c.bmr]))
  const measuredAt = normDate(pick(raw, [...c.measuredAt]))

  // A body-comp snapshot requires at least a weight to anchor the weight_logs row.
  const bodyComp: BodyCompRow | null =
    weight != null
      ? {
          weight_lbs: weight,
          body_fat_pct: bf,
          body_fat_mass_lbs: fatMass,
          bmr,
          total_body_water_lbs: tbw,
          skeletal_muscle_mass_lbs: smm,
          logged_at: measuredAt
            ? new Date(`${measuredAt}T12:00:00Z`).toISOString()
            : new Date().toISOString(),
        }
      : null

  // Anything not consumed above becomes a biomarker reading (the labs vertical).
  const consumed = consumedKeys()
  const measuredIso = bodyComp?.logged_at ?? new Date().toISOString()
  const unmappedBiomarkers: Record<string, unknown> = {}
  const biomarkers: BiomarkerRow[] = []
  for (const [k, v] of Object.entries(raw)) {
    if (consumed.has(k.toLowerCase())) continue
    unmappedBiomarkers[k] = v
    // Only simple scalar values map to a reading; skip nested objects/arrays.
    if (v == null || typeof v === "object") continue
    const marker = k.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
    if (!marker) continue
    const num = toNumberAny(v)
    biomarkers.push({
      marker,
      label: k,
      value_num: num,
      value_text: num == null ? cleanStr(v) : null,
      unit: null,
      category: categorize(marker),
      measured_at: measuredIso,
    })
  }

  return {
    client,
    bodyComp,
    biomarkers,
    email: client.email,
    nameKey: nameKey(first, last),
    unmappedBiomarkers,
    source: raw,
  }
}
