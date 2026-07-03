// ============================================================================
// Pure Athlete-Story timeline assembler. Takes already-fetched series from the
// EXISTING per-domain tables (weight, body-comp, recovery, nutrition, training,
// messages, competitions, alerts, notes) and returns a trend header + a merged,
// context-rich event list. No I/O, no Observation Store — deterministic and
// unit-testable. The reader (lib/data/client-timeline.ts) supplies the data.
// ============================================================================

export type TimelineKind =
  | "weight"
  | "recovery"
  | "nutrition"
  | "training"
  | "message"
  | "competition"
  | "alert"
  | "note"

export interface TimelineEvent {
  id: string
  kind: TimelineKind
  title: string
  detail?: string | null
  /** A short trend/context line (e.g. "▼ 0.8 lb since last reading"). */
  context?: string | null
  source?: string | null
  at: string
  sensitive?: boolean
}

export interface TrendStat {
  label: string
  value: string
  /** Change vs ~a week ago, already formatted (e.g. "▼ 1.4 lb / 7d"). */
  delta?: string | null
  direction?: "up" | "down" | "flat" | null
}

export interface TimelineResult {
  events: TimelineEvent[]
  trends: TrendStat[]
}

export interface WeightRow {
  id: string
  weight_lbs: number | null
  logged_at: string
  body_fat_pct?: number | null
  skeletal_muscle_mass_lbs?: number | null
}
export interface RecoveryRow {
  id: string
  logged_date: string
  sleep_hours?: number | null
  energy?: number | null
  soreness?: number | null
  recovery_score?: number | null
}
export interface NutritionRow {
  id: string
  logged_date: string
  calories?: number | null
  protein_g?: number | null
}
export interface TrainingRow {
  id: string
  scheduled_at?: string | null
  completed_at?: string | null
  session_type?: string | null
  duration_min?: number | null
  rpe?: number | null
}
export interface MessageRow {
  id: string
  body?: string | null
  source?: string | null
  received_at?: string | null
  created_at: string
  direction?: string | null
}
export interface CompetitionRow {
  id: string
  name: string
  competition_date: string
}
export interface AlertRow {
  id: string
  title: string
  detail?: string | null
  severity: string
  created_at: string
}
export interface NoteRow {
  id: string
  text: string
  at: string
}

export interface TimelineInput {
  weights?: WeightRow[]
  recoveries?: RecoveryRow[]
  nutrition?: NutritionRow[]
  training?: TrainingRow[]
  messages?: MessageRow[]
  competitions?: CompetitionRow[]
  alerts?: AlertRow[]
  notes?: NoteRow[]
  /** ISO now, for relative math; defaults to Date.now(). */
  now?: string
}

const round1 = (n: number) => Math.round(n * 10) / 10
const DAY = 86_400_000

/** A datapoint for trend math (most-recent first not required — we sort). */
interface Point {
  at: number
  v: number
}

/**
 * Compare the latest value to the reading closest to ~`windowDays` ago (falling
 * back to the oldest point). Returns the signed delta + a direction, or null
 * when there aren't two points to compare.
 */
export function computeDelta(points: Point[], windowDays = 7): { delta: number; direction: "up" | "down" | "flat" } | null {
  const pts = points.filter((p) => Number.isFinite(p.v)).sort((a, b) => b.at - a.at)
  if (pts.length < 2) return null
  const latest = pts[0]
  const cutoff = latest.at - windowDays * DAY
  // Newest point at or before the cutoff, else the oldest reading we have.
  const prior = pts.find((p) => p.at <= cutoff) ?? pts[pts.length - 1]
  if (prior === latest) return null
  const delta = round1(latest.v - prior.v)
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat"
  return { delta, direction }
}

const arrow = (d: "up" | "down" | "flat") => (d === "up" ? "▲" : d === "down" ? "▼" : "▬")

function ts(m: MessageRow): string {
  return m.received_at ?? m.created_at
}

/** Assemble the trend header + merged event timeline. */
export function buildTimeline(input: TimelineInput): TimelineResult {
  const nowMs = input.now ? Date.parse(input.now) : Date.now()
  const events: TimelineEvent[] = []
  const trends: TrendStat[] = []

  // ---- Weight (+ body composition folded into detail) ----------------------
  const weights = (input.weights ?? [])
    .filter((w) => typeof w.weight_lbs === "number")
    .slice()
    .sort((a, b) => Date.parse(b.logged_at) - Date.parse(a.logged_at))
  if (weights.length) {
    const latest = weights[0]
    const wDelta = computeDelta(weights.map((w) => ({ at: Date.parse(w.logged_at), v: w.weight_lbs as number })))
    trends.push({
      label: "Weight",
      value: `${latest.weight_lbs} lb`,
      delta: wDelta ? `${arrow(wDelta.direction)} ${Math.abs(wDelta.delta)} lb / 7d` : null,
      direction: wDelta?.direction ?? null,
    })
    const bfPoints = weights
      .filter((w) => typeof w.body_fat_pct === "number")
      .map((w) => ({ at: Date.parse(w.logged_at), v: w.body_fat_pct as number }))
    const latestBf = weights.find((w) => typeof w.body_fat_pct === "number")
    if (latestBf) {
      const bfDelta = computeDelta(bfPoints)
      trends.push({
        label: "Body fat",
        value: `${latestBf.body_fat_pct}%`,
        delta: bfDelta ? `${arrow(bfDelta.direction)} ${Math.abs(bfDelta.delta)}% / 7d` : null,
        direction: bfDelta?.direction ?? null,
      })
    }

    weights.forEach((w, i) => {
      const prev = weights[i + 1]
      const bits = [
        typeof w.body_fat_pct === "number" ? `${w.body_fat_pct}% BF` : null,
        typeof w.skeletal_muscle_mass_lbs === "number" ? `${w.skeletal_muscle_mass_lbs} lb SMM` : null,
      ].filter(Boolean)
      let context: string | null = null
      if (prev && typeof prev.weight_lbs === "number") {
        const d = round1((w.weight_lbs as number) - prev.weight_lbs)
        context = d === 0 ? "same as previous reading" : `${arrow(d > 0 ? "up" : "down")} ${Math.abs(d)} lb since last reading`
      }
      events.push({
        id: `w-${w.id}`,
        kind: "weight",
        title: `Body weight ${w.weight_lbs} lb`,
        detail: bits.join(" · ") || null,
        context,
        source: bits.length ? "weight · body comp" : "weight",
        at: w.logged_at,
      })
    })
  }

  // ---- Recovery ------------------------------------------------------------
  const recoveries = (input.recoveries ?? [])
    .slice()
    .sort((a, b) => Date.parse(b.logged_date) - Date.parse(a.logged_date))
  if (recoveries.length) {
    const latest = recoveries[0]
    const scorePts = recoveries
      .filter((r) => typeof r.recovery_score === "number")
      .map((r) => ({ at: Date.parse(r.logged_date), v: r.recovery_score as number }))
    if (typeof latest.recovery_score === "number") {
      const d = computeDelta(scorePts)
      trends.push({
        label: "Recovery",
        value: `${latest.recovery_score}`,
        delta: d ? `${arrow(d.direction)} ${Math.abs(d.delta)} / 7d` : null,
        direction: d?.direction ?? null,
      })
    }
    recoveries.forEach((r) => {
      const bits = [
        r.sleep_hours != null ? `Sleep ${r.sleep_hours}h` : null,
        r.energy != null ? `Energy ${r.energy}/10` : null,
        r.soreness != null ? `Soreness ${r.soreness}/10` : null,
      ].filter(Boolean)
      events.push({
        id: `r-${r.id}`,
        kind: "recovery",
        title: r.recovery_score != null ? `Recovery ${r.recovery_score}` : "Recovery logged",
        detail: bits.join(" · ") || null,
        source: "recovery",
        at: r.logged_date,
      })
    })
  }

  // ---- Nutrition -----------------------------------------------------------
  const nutrition = (input.nutrition ?? [])
    .slice()
    .sort((a, b) => Date.parse(b.logged_date) - Date.parse(a.logged_date))
  if (nutrition.length) {
    const latest = nutrition[0]
    if (typeof latest.calories === "number") {
      const d = computeDelta(
        nutrition.filter((n) => typeof n.calories === "number").map((n) => ({ at: Date.parse(n.logged_date), v: n.calories as number }))
      )
      trends.push({
        label: "Calories",
        value: `${latest.calories}`,
        delta: d ? `${arrow(d.direction)} ${Math.abs(d.delta)} / 7d` : null,
        direction: d?.direction ?? null,
      })
    }
    nutrition.forEach((n) => {
      const bits = [
        n.calories != null ? `${n.calories} kcal` : null,
        n.protein_g != null ? `${n.protein_g}g protein` : null,
      ].filter(Boolean)
      if (!bits.length) return
      events.push({
        id: `n-${n.id}`,
        kind: "nutrition",
        title: "Nutrition logged",
        detail: bits.join(" · "),
        source: "nutrition",
        at: n.logged_date,
      })
    })
  }

  // ---- Training ------------------------------------------------------------
  for (const t of input.training ?? []) {
    const at = t.completed_at ?? t.scheduled_at
    if (!at) continue
    const done = !!t.completed_at
    const bits = [
      t.duration_min != null ? `${t.duration_min} min` : null,
      t.rpe != null ? `RPE ${t.rpe}` : null,
    ].filter(Boolean)
    events.push({
      id: `t-${t.id}`,
      kind: "training",
      title: `${done ? "Completed" : "Planned"} ${t.session_type ?? "training"}`.trim(),
      detail: bits.join(" · ") || null,
      source: "training",
      at,
    })
  }

  // ---- Competitions --------------------------------------------------------
  for (const c of input.competitions ?? []) {
    const dayMs = Date.parse(c.competition_date)
    const days = Math.round((dayMs - nowMs) / DAY)
    const context = Number.isFinite(days)
      ? days > 0
        ? `in ${days} day${days === 1 ? "" : "s"}`
        : days === 0
          ? "today"
          : `${Math.abs(days)} day${days === -1 ? "" : "s"} ago`
      : null
    events.push({
      id: `c-${c.id}`,
      kind: "competition",
      title: c.name,
      context,
      source: "competition",
      at: c.competition_date,
    })
  }

  // ---- Alerts --------------------------------------------------------------
  for (const a of input.alerts ?? []) {
    events.push({
      id: `a-${a.id}`,
      kind: "alert",
      title: a.title,
      detail: a.detail ?? null,
      source: `alert · ${a.severity}`,
      at: a.created_at,
      sensitive: a.severity === "critical",
    })
  }

  // ---- Notes ---------------------------------------------------------------
  for (const n of input.notes ?? []) {
    if (!n.text?.trim()) continue
    events.push({
      id: `note-${n.id}`,
      kind: "note",
      title: n.text.trim().slice(0, 140),
      source: "note",
      at: n.at,
    })
  }

  // ---- Messages ------------------------------------------------------------
  for (const m of input.messages ?? []) {
    const body = (m.body ?? "").trim()
    if (!body) continue
    events.push({
      id: `m-${m.id}`,
      kind: "message",
      title: body.slice(0, 140),
      detail: null,
      source: m.direction === "outgoing" ? "message · coach" : m.source ?? "message",
      at: ts(m),
    })
  }

  events.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))
  return { events, trends }
}
