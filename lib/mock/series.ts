// ============================================================================
// Deterministic per-athlete time series for the dev bypass / fixtures.
// Seeded by client id so charts stay stable across renders.
// ============================================================================

import type {
  BiomarkerReading,
  HydrationLog,
  NutritionLog,
  NutritionPlan,
  RecoveryLog,
  Supplement,
  SupplementLog,
  TrainingProgram,
  TrainingSession,
  WeightGoal,
  WeightLog,
} from "@/types/models"

const COACH = "00000000-0000-0000-0000-0000000000c0"

// ---- seeded RNG ------------------------------------------------------------

function hashSeed(s: string): number {
  let h = 1779033703 ^ s.length
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function rngFor(clientId: string, salt: string) {
  const rand = mulberry32(hashSeed(clientId + ":" + salt))
  return {
    next: rand,
    // centered noise in [-mag, mag]
    noise: (mag: number) => (rand() - 0.5) * 2 * mag,
    int: (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1)),
  }
}

function isoDaysAgo(d: number): string {
  return new Date(Date.now() - d * 86_400_000).toISOString()
}
function dateDaysAgo(d: number): string {
  return isoDaysAgo(d).slice(0, 10)
}
const r1 = (n: number) => Math.round(n * 10) / 10

// ---- per-athlete baselines -------------------------------------------------

export interface Baseline {
  w: number
  tr: number // lbs/day change (negative = cut)
  bf: number
  hyd: number
  hf: number // hydration fill ratio
  slp: number
  en: number
  so: number
  st: number
  kcal: number
  p: number
  c: number
  f: number
  sessPerWk: number
  goal?: number | null // explicit goal weight (imported rosters)
  lowSleep?: boolean
  highSoreness?: boolean
  sparseWeight?: boolean
}

const DEFAULT: Baseline = {
  w: 175, tr: 0, bf: 16, hyd: 100, hf: 0.8, slp: 7.2, en: 7, so: 3, st: 3,
  kcal: 2600, p: 180, c: 300, f: 75, sessPerWk: 4,
}

/** Build a full baseline from a partial spec (used by imported rosters). */
export function createBaseline(p: Partial<Baseline>): Baseline {
  return { ...DEFAULT, ...p }
}

// Overrides registered at runtime for imported athletes (dev bypass).
let OVERRIDES: Record<string, Baseline> = {}

export function setBaselineOverrides(map: Record<string, Baseline>): void {
  OVERRIDES = map
}

// ---- wrestling roster (drives the Wrestling Command Center) ----------------

export interface WrestlerSpec {
  id: string
  first: string
  last: string
  className: string // NCAA folkstyle lb class
  classLimit: number
  current: number
  weighInDays: number // days from now
  compDays: number
  lossRate: number // measured lbs/day (positive = losing)
  highSweat?: boolean
}

export const WRESTLERS: WrestlerSpec[] = [
  { id: "c-cole", first: "Cole", last: "Whitaker", className: "157", classLimit: 157, current: 165, weighInDays: 5, compDays: 6, lossRate: 1.5 },
  { id: "c-marcus", first: "Marcus", last: "Diaz", className: "133", classLimit: 133, current: 142, weighInDays: 3, compDays: 4, lossRate: 1.0, highSweat: true },
  { id: "c-tyler", first: "Tyler", last: "Brooks", className: "174", classLimit: 174, current: 181, weighInDays: 12, compDays: 13, lossRate: 0.6 },
  { id: "c-sam", first: "Sam", last: "Nguyen", className: "149", classLimit: 149, current: 158, weighInDays: 20, compDays: 35, lossRate: 0.45 },
  { id: "c-ethan", first: "Ethan", last: "Ross", className: "125", classLimit: 125, current: 131, weighInDays: 2, compDays: 3, lossRate: 1.2, highSweat: true },
]

const BASE: Record<string, Baseline> = {
  "c-jordan": { ...DEFAULT, w: 181, tr: -0.12, bf: 14.5, hyd: 110, hf: 0.86, slp: 6.2, en: 6.5, so: 3.5, st: 4, kcal: 2600, p: 200, c: 250, f: 70, sessPerWk: 4, lowSleep: true },
  "c-maya": { ...DEFAULT, w: 156, tr: 0, bf: 18, hyd: 100, hf: 0.82, slp: 7.6, en: 7.4, so: 2.5, st: 2.5, kcal: 2900, p: 175, c: 360, f: 85, sessPerWk: 5 },
  "c-devon": { ...DEFAULT, w: 178, tr: -0.03, hyd: 100, hf: 0.38, slp: 6.8, en: 6, so: 4, st: 5, kcal: 2700, sessPerWk: 5, sparseWeight: true },
  "c-priya": { ...DEFAULT, w: 138, tr: 0.06, bf: 20, hyd: 90, hf: 0.8, slp: 7.1, kcal: 2400, p: 165, c: 290, f: 65, sessPerWk: 4 },
  "c-luca": { ...DEFAULT, w: 205, tr: 0, hyd: 120, hf: 0.7, slp: 7, en: 6.5, kcal: 3100, p: 185, c: 360, f: 90, sessPerWk: 3, sparseWeight: true },
  "c-kai": { ...DEFAULT, w: 179, tr: -0.4, bf: 12, hyd: 200, hf: 0.9, slp: 6.3, en: 6, so: 6.5, st: 5, kcal: 2500, p: 190, c: 240, f: 60, sessPerWk: 5, highSoreness: true },
}

// Inject wrestler baselines derived from their specs (heavy cut camps).
for (const w of WRESTLERS) {
  BASE[w.id] = {
    ...DEFAULT,
    w: w.current,
    tr: -w.lossRate,
    bf: 10,
    hyd: 110,
    hf: w.highSweat ? 0.85 : 0.78,
    slp: 6.6,
    en: 6,
    so: 6,
    st: 5,
    kcal: 2200,
    p: 180,
    c: 200,
    f: 55,
    sessPerWk: 6,
    highSoreness: true,
  }
}

function baseline(id: string): Baseline {
  return OVERRIDES[id] ?? BASE[id] ?? DEFAULT
}

const clamp10 = (n: number) => Math.max(1, Math.min(10, Math.round(n)))

// ---- generators ------------------------------------------------------------

export function mockWeightLogs(clientId: string, days = 30): WeightLog[] {
  const b = baseline(clientId)
  const g = rngFor(clientId, "weight")
  const out: WeightLog[] = []
  for (let d = days; d >= 0; d--) {
    if (b.sparseWeight && d < 6) continue // last log ~6 days ago
    if (b.sparseWeight && d % 3 !== 0) continue
    const weight = r1(b.w - b.tr * d + g.noise(0.6))
    // Body fat eases down toward "now"; the rest derives from weight + body fat
    // so all six metrics trend together realistically.
    const bf = r1(b.bf + d * 0.01 + g.noise(0.3))
    const leanMass = weight * (1 - bf / 100)
    const leanKg = leanMass / 2.2046
    const smm = r1(leanMass * 0.52)
    out.push({
      id: `wl-${clientId}-${d}`,
      client_id: clientId,
      logged_by: COACH,
      weight_lbs: weight,
      body_fat_pct: bf,
      muscle_mass_lbs: smm,
      body_fat_mass_lbs: r1(weight * (bf / 100)),
      bmr: Math.round(370 + 21.6 * leanKg),
      total_body_water_lbs: r1(leanMass * 0.732),
      skeletal_muscle_mass_lbs: smm,
      logged_at: isoDaysAgo(d),
      photo_url: null,
      notes: null,
      created_at: isoDaysAgo(d),
    })
  }
  return out
}

export function mockWeightGoal(clientId: string): WeightGoal | null {
  const b = baseline(clientId)
  // Explicit goal (imported rosters) takes precedence; else derive from trend.
  const target = b.goal != null ? r1(b.goal) : b.tr !== 0 ? r1(b.w + b.tr * 25) : null
  if (target == null) return null
  const direction =
    target < b.w - 0.5 ? "cut" : target > b.w + 0.5 ? "bulk" : "maintain"
  return {
    id: `wg-${clientId}`,
    client_id: clientId,
    target_weight: target,
    target_date: dateDaysAgo(-25),
    direction,
    weekly_rate_lbs: b.tr !== 0 ? r1(Math.abs(b.tr) * 7) : null,
    created_at: isoDaysAgo(40),
  }
}

export function mockNutritionPlan(clientId: string): NutritionPlan | null {
  const b = baseline(clientId)
  return {
    id: `np-${clientId}`,
    client_id: clientId,
    coach_id: COACH,
    name: b.tr < 0 ? "Cut Phase" : b.tr > 0 ? "Lean Gain" : "Performance Maintenance",
    calories: b.kcal,
    protein_g: b.p,
    carbs_g: b.c,
    fat_g: b.f,
    fiber_g: 35,
    meal_structure: null,
    is_active: true,
    effective_date: dateDaysAgo(20),
    notes: null,
    created_at: isoDaysAgo(20),
  }
}

export function mockNutritionLogs(clientId: string, days = 12): NutritionLog[] {
  const b = baseline(clientId)
  const g = rngFor(clientId, "nutrition")
  // Hard cutters tend to under-eat protein + calories during the grind.
  const hardCut = b.tr <= -0.3
  const proteinFactor = hardCut ? 0.72 : 1
  const calorieFactor = hardCut ? 0.93 : 1
  const out: NutritionLog[] = []
  for (let d = days; d >= 0; d--) {
    out.push({
      id: `nl-${clientId}-${d}`,
      client_id: clientId,
      logged_by: COACH,
      logged_date: dateDaysAgo(d),
      meal_label: "Daily total",
      calories: Math.round(b.kcal * calorieFactor + g.noise(180)),
      protein_g: r1(b.p * proteinFactor + g.noise(12)),
      carbs_g: r1(b.c + g.noise(35)),
      fat_g: r1(b.f + g.noise(10)),
      fiber_g: r1(32 + g.noise(8)),
      photo_url: null,
      notes: null,
      created_at: isoDaysAgo(d),
    })
  }
  return out
}

export function mockHydrationLogs(clientId: string, days = 14): HydrationLog[] {
  const b = baseline(clientId)
  const g = rngFor(clientId, "hydration")
  const out: HydrationLog[] = []
  for (let d = days; d >= 0; d--) {
    out.push({
      id: `hl-${clientId}-${d}`,
      client_id: clientId,
      logged_by: COACH,
      logged_date: dateDaysAgo(d),
      oz_consumed: Math.max(0, Math.round(b.hyd * b.hf + g.noise(12))),
      oz_target: b.hyd,
      notes: null,
      created_at: isoDaysAgo(d),
    })
  }
  return out
}

export function mockRecoveryLogs(clientId: string, days = 14): RecoveryLog[] {
  const b = baseline(clientId)
  const g = rngFor(clientId, "recovery")
  const out: RecoveryLog[] = []
  for (let d = days; d >= 0; d--) {
    const sleep = r1(b.slp + g.noise(b.lowSleep ? 0.9 : 0.6))
    const soreness = clamp10(b.so + g.noise(b.highSoreness ? 1.6 : 1.2))
    out.push({
      id: `rl-${clientId}-${d}`,
      client_id: clientId,
      logged_by: COACH,
      logged_date: dateDaysAgo(d),
      sleep_hours: sleep,
      sleep_quality: clamp10(b.slp - 0.5 + g.noise(1.5)),
      soreness,
      energy: clamp10(b.en + g.noise(1.3)),
      stress: clamp10(b.st + g.noise(1.3)),
      hrv: Math.round(60 + g.noise(12)),
      resting_hr: Math.round(54 + g.noise(5)),
      modalities: d % 3 === 0 ? ["mobility"] : [],
      notes: null,
      created_at: isoDaysAgo(d),
      // Connector-import fields (migration 0025) — null for manual/mock logs.
      recovery_score: null,
      hydration: null,
      source: null,
      measured_at: null,
      source_ref: null,
      raw: null,
    })
  }
  return out
}

const SUPPLEMENT_SETS: Record<string, [string, string, string, string][]> = {
  default: [
    ["Creatine Monohydrate", "BulkLabs", "5 g", "Morning"],
    ["Whey Isolate", "PureForm", "30 g", "Post-workout"],
    ["Vitamin D3", "NordHealth", "2000 IU", "Morning"],
  ],
}

export function mockSupplements(clientId: string): Supplement[] {
  const set = SUPPLEMENT_SETS[clientId] ?? SUPPLEMENT_SETS.default
  return set.map(([name, brand, dosage, timing], i) => ({
    id: `sup-${clientId}-${i}`,
    client_id: clientId,
    coach_id: COACH,
    name,
    brand,
    dosage,
    frequency: "Daily",
    timing,
    purpose: i === 0 ? "Strength/output" : i === 1 ? "Protein target" : "General health",
    is_active: true,
    start_date: dateDaysAgo(60),
    end_date: null,
    notes: null,
    created_at: isoDaysAgo(60),
  }))
}

export function mockSupplementLogs(clientId: string, days = 7): SupplementLog[] {
  const sups = mockSupplements(clientId)
  const g = rngFor(clientId, "supplements")
  const out: SupplementLog[] = []
  for (const s of sups) {
    for (let d = days; d >= 0; d--) {
      const taken = g.next() > 0.12 // ~88% adherence
      if (!taken && g.next() > 0.5) continue // sometimes no record
      out.push({
        id: `spl-${s.id}-${d}`,
        client_id: clientId,
        supplement_id: s.id,
        logged_by: COACH,
        logged_at: isoDaysAgo(d),
        taken,
        notes: null,
      })
    }
  }
  return out
}

export function mockTrainingProgram(clientId: string): TrainingProgram {
  const b = baseline(clientId)
  return {
    id: `tp-${clientId}`,
    client_id: clientId,
    coach_id: COACH,
    name: b.tr < 0 ? "Peak Block" : "Build Block",
    phase: b.tr < 0 ? "peak" : "off-season",
    start_date: dateDaysAgo(21),
    end_date: null,
    is_active: true,
    notes: null,
    created_at: isoDaysAgo(21),
  }
}

const SESSION_TYPES = ["strength", "conditioning", "technique", "cardio"]

export function mockTrainingSessions(clientId: string, days = 21): TrainingSession[] {
  const b = baseline(clientId)
  const g = rngFor(clientId, "training")
  const out: TrainingSession[] = []
  const gap = Math.max(1, Math.round(7 / b.sessPerWk))
  let idx = 0
  for (let d = days; d >= -3; d -= gap) {
    const upcoming = d < 0
    out.push({
      id: `ts-${clientId}-${idx}`,
      client_id: clientId,
      program_id: `tp-${clientId}`,
      scheduled_at: isoDaysAgo(d),
      completed_at: upcoming ? null : isoDaysAgo(d),
      session_type: SESSION_TYPES[idx % SESSION_TYPES.length],
      duration_min: g.int(45, 95),
      rpe: upcoming ? null : g.int(6, 9),
      notes: null,
      created_at: isoDaysAgo(Math.max(d, 0)),
    })
    idx++
  }
  return out
}

// ---- biomarkers (labs vertical) --------------------------------------------

interface BiomarkerSpec {
  marker: string
  label: string
  unit: string
  category: "recovery" | "performance" | "blood"
  base: number
  drift: number // per-day change toward "now"
  noise: number
  decimals?: number
}

const BIOMARKER_SPECS: BiomarkerSpec[] = [
  { marker: "hrv", label: "HRV", unit: "ms", category: "recovery", base: 62, drift: 0.12, noise: 4 },
  { marker: "resting_hr", label: "Resting HR", unit: "bpm", category: "recovery", base: 54, drift: -0.03, noise: 2 },
  { marker: "vo2max", label: "VO₂ max", unit: "ml/kg/min", category: "performance", base: 51, drift: 0.04, noise: 0.8, decimals: 1 },
  { marker: "ferritin", label: "Ferritin", unit: "ng/mL", category: "blood", base: 88, drift: 0.15, noise: 6 },
  { marker: "vitamin_d", label: "Vitamin D", unit: "ng/mL", category: "blood", base: 41, drift: 0.05, noise: 3, decimals: 1 },
  { marker: "testosterone", label: "Testosterone", unit: "ng/dL", category: "blood", base: 610, drift: 0.4, noise: 35 },
]

/** Deterministic biomarker time series (~weekly readings over ~8 weeks). */
export function mockBiomarkers(clientId: string): BiomarkerReading[] {
  const out: BiomarkerReading[] = []
  for (const spec of BIOMARKER_SPECS) {
    const g = rngFor(clientId, `bio-${spec.marker}`)
    let i = 0
    for (let d = 56; d >= 0; d -= 7) {
      const raw = spec.base + spec.drift * (56 - d) + g.noise(spec.noise)
      const factor = Math.pow(10, spec.decimals ?? 0)
      const value = Math.round(raw * factor) / factor
      out.push({
        id: `bio-${clientId}-${spec.marker}-${i}`,
        client_id: clientId,
        logged_by: COACH,
        marker: spec.marker,
        label: spec.label,
        value_num: value,
        value_text: null,
        unit: spec.unit,
        category: spec.category,
        measured_at: isoDaysAgo(d),
        source: "mock",
        notes: null,
        created_at: isoDaysAgo(d),
      })
      i++
    }
  }
  return out
}
