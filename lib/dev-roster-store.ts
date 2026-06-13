// ============================================================================
// Dev roster store — local persistence for the imported (real) roster.
//
// In dev auth bypass mode the app serves mock data. When a roster has been
// imported via Settings → Import Roster, it is saved to .dev-data/roster.json
// and REPLACES the seeded demo athletes everywhere. Clearing the import
// restores the demo. Server-only (uses fs).
// ============================================================================

import "server-only"

import fs from "node:fs"
import path from "node:path"

import {
  getMockClient,
  getMockSnapshot,
  mockClients,
  mockCompetitions,
  mockDashboard,
  mockRoster,
} from "@/lib/mock/athletes"
import {
  createBaseline,
  mockHydrationLogs,
  mockRecoveryLogs,
  mockNutritionPlan,
  mockTrainingProgram,
  mockWeightGoal,
  mockWeightLogs,
  setBaselineOverrides,
  type Baseline,
} from "@/lib/mock/series"
import {
  generateImportedTasks,
  mockCoachTasks,
} from "@/lib/mock/tasks"
import {
  generateImportedCalendar,
  mockCalendarEvents,
} from "@/lib/mock/calendar"
import {
  generateImportedSchedule,
  mockScheduleSessions,
} from "@/lib/mock/schedule"
import type {
  AgendaCompTask,
  CalendarEvent,
  Client,
  ClientListItem,
  ClientSnapshot,
  CoachTaskView,
  Competition,
  DashboardSummary,
  ImportedAthlete,
  ScheduledSessionView,
  Task,
} from "@/types/models"

const COACH = "00000000-0000-0000-0000-0000000000c0"
const FILE = path.join(process.cwd(), ".dev-data", "roster.json")

let cache: { mtimeMs: number; athletes: ImportedAthlete[] } | null = null

// ---- file I/O ---------------------------------------------------------------

/** Imported athletes, or null when none (demo data should be shown). */
export function readImportedAthletes(): ImportedAthlete[] | null {
  try {
    const stat = fs.statSync(FILE)
    if (!cache || cache.mtimeMs !== stat.mtimeMs) {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as {
        athletes?: ImportedAthlete[]
      }
      const athletes = Array.isArray(raw?.athletes) ? raw.athletes : []
      cache = { mtimeMs: stat.mtimeMs, athletes }
      applyBaselines(athletes)
    }
    return cache.athletes.length > 0 ? cache.athletes : null
  } catch {
    return null
  }
}

export function writeImportedAthletes(athletes: ImportedAthlete[]): void {
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  fs.writeFileSync(
    FILE,
    JSON.stringify({ importedAt: new Date().toISOString(), athletes }, null, 2)
  )
  cache = null
  readImportedAthletes() // warm cache + apply baselines
}

export function clearImportedAthletes(): void {
  try {
    fs.rmSync(FILE)
  } catch {
    // already gone
  }
  cache = null
  setBaselineOverrides({})
}

export function hasImportedRoster(): boolean {
  return readImportedAthletes() !== null
}

/** Current imported athletes (empty array when none). */
function currentAthletes(): ImportedAthlete[] {
  return readImportedAthletes() ?? []
}

export function getImportedAthleteById(id: string): ImportedAthlete | null {
  return currentAthletes().find((a) => a.id === id) ?? null
}

/** Append one athlete; starting a real roster also hides the demo data. */
export function addImportedAthlete(a: ImportedAthlete): void {
  writeImportedAthletes([...currentAthletes(), a])
}

export function updateImportedAthlete(
  id: string,
  patch: Partial<ImportedAthlete>
): boolean {
  const list = currentAthletes()
  const idx = list.findIndex((a) => a.id === id)
  if (idx === -1) return false
  list[idx] = { ...list[idx], ...patch, id }
  writeImportedAthletes(list)
  return true
}

/** Remove one athlete. When the roster empties, demo data is restored. */
export function removeImportedAthlete(id: string): void {
  const next = currentAthletes().filter((a) => a.id !== id)
  if (next.length === 0) clearImportedAthletes()
  else writeImportedAthletes(next)
}

/** Ensure baseline overrides are registered before using log generators. */
export function ensureImportedBaselines(): void {
  readImportedAthletes()
}

// ---- derived data ------------------------------------------------------------

function applyBaselines(athletes: ImportedAthlete[]): void {
  const map: Record<string, Baseline> = {}
  for (const a of athletes) {
    const w = a.currentWeight ?? 175
    const goal = a.goalWeight
    let tr = 0
    if (goal != null && a.currentWeight != null) {
      const diff = a.currentWeight - goal
      if (diff > 1) tr = -Math.min(0.35, Math.max(0.05, diff / 45))
      else if (diff < -1) tr = Math.min(0.2, Math.max(0.04, -diff / 60))
    }
    map[a.id] = createBaseline({ w, tr, goal })
  }
  setBaselineOverrides(map)
}

/** Stable 65–95 compliance proxy from the athlete id. */
function hashCompliance(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return 65 + (h % 31)
}

function toClient(a: ImportedAthlete): Client {
  const goalBits = [
    a.goalWeight != null ? `Goal weight ${a.goalWeight} lb` : null,
    a.nextCompetition ? `Next: ${a.nextCompetition}` : null,
  ].filter(Boolean)
  return {
    id: a.id,
    coach_id: COACH,
    profile_id: null,
    first_name: a.firstName,
    last_name: a.lastName,
    email: a.email,
    phone: a.phone,
    date_of_birth: null,
    gender: null,
    sport: a.sport,
    discipline: null,
    current_weight_class: a.weightClass,
    goal_summary: goalBits.length ? goalBits.join(" · ") : null,
    status: "active",
    start_date: null,
    avatar_url: null,
    emergency_contact: null,
    notes: a.coachNotes,
    current_weight: a.currentWeight,
    goal_weight: a.goalWeight,
    next_competition: a.nextCompetition,
    competition_date: a.competitionDate,
    created_at: new Date(Date.now() - 30 * 86_400_000).toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function toCompetition(a: ImportedAthlete): Competition | null {
  if (!a.competitionDate) return null
  return {
    id: `imp-comp-${a.id}`,
    client_id: a.id,
    coach_id: COACH,
    name: a.nextCompetition ?? "Competition",
    federation: null,
    location: null,
    competition_date: a.competitionDate,
    weight_class: a.weightClass,
    divisions: [],
    status: "planned",
    result: null,
    placement: null,
    peak_weight: null,
    weigh_in_weight: null,
    notes: null,
    created_at: new Date(Date.now() - 14 * 86_400_000).toISOString(),
  }
}

function toTaskRow(v: CoachTaskView): Task {
  const now = new Date(Date.now() - 86_400_000).toISOString()
  return {
    id: v.id,
    coach_id: COACH,
    client_id: v.clientId,
    title: v.title,
    description: v.description,
    status: v.status,
    priority: v.priority,
    due_date: v.dueDate,
    completed_at: v.completedAt,
    created_at: now,
    updated_at: now,
  }
}

// ---- bypass data accessors (imported roster replaces demo when present) ------

export function getBypassClients(): Client[] {
  const imported = readImportedAthletes()
  return imported ? imported.map(toClient) : mockClients
}

export function getBypassClientById(clientId: string): Client | null {
  const imported = readImportedAthletes()
  if (imported) {
    const a = imported.find((x) => x.id === clientId)
    return a ? toClient(a) : null
  }
  return getMockClient(clientId)
}

export function getBypassCompetitions(): Competition[] {
  const imported = readImportedAthletes()
  if (!imported) return mockCompetitions
  return imported
    .map(toCompetition)
    .filter((c): c is Competition => c !== null)
}

export function getBypassRosterList(): ClientListItem[] {
  const imported = readImportedAthletes()
  if (!imported) return mockRoster
  const comps = getBypassCompetitions()
  const today = new Date().toISOString().slice(0, 10)
  return imported.map((a) => {
    const client = toClient(a)
    return {
      client,
      nextCompetition:
        comps.find(
          (c) => c.client_id === client.id && c.competition_date >= today
        ) ?? null,
      openAlertCount: 0, // live count comes from the alert engine elsewhere
      complianceScore: hashCompliance(client.id),
      latestBodyFatPct:
        a.bodyFatPct ?? mockWeightLogs(a.id).at(-1)?.body_fat_pct ?? null,
    }
  })
}

export function getBypassSnapshot(clientId: string): ClientSnapshot | null {
  const imported = readImportedAthletes()
  if (!imported) return getMockSnapshot(clientId)

  const client = getBypassClientById(clientId)
  if (!client) return null

  const weights = mockWeightLogs(clientId)
  const hydration = mockHydrationLogs(clientId)
  const recovery = mockRecoveryLogs(clientId)
  const today = new Date().toISOString().slice(0, 10)

  return {
    client,
    latestWeight: weights.at(-1) ?? null,
    weightGoal: mockWeightGoal(clientId),
    activeNutritionPlan: mockNutritionPlan(clientId),
    hydrationToday: hydration.at(-1) ?? null,
    latestRecovery: recovery.at(-1) ?? null,
    activeProgram: mockTrainingProgram(clientId),
    nextCompetition:
      getBypassCompetitions().find(
        (c) => c.client_id === clientId && c.competition_date >= today
      ) ?? null,
    openAlerts: [], // overview page reads live alerts from the engine
    complianceScore: hashCompliance(clientId),
  }
}

export function getBypassCoachTasks(): CoachTaskView[] {
  const imported = readImportedAthletes()
  return imported ? generateImportedTasks(imported) : mockCoachTasks()
}

/** Generated tasks as DB-shaped rows (dashboard feed, agenda reminders). */
export function getBypassTaskRows(): Task[] {
  const imported = readImportedAthletes()
  if (!imported) return []
  return generateImportedTasks(imported).map(toTaskRow)
}

export function getBypassCalendar(): CalendarEvent[] {
  const imported = readImportedAthletes()
  if (!imported) return mockCalendarEvents()
  return generateImportedCalendar(getBypassClients(), getBypassCompetitions())
}

export function getBypassScheduleSessions(): ScheduledSessionView[] {
  const imported = readImportedAthletes()
  if (!imported) return mockScheduleSessions()
  return generateImportedSchedule(getBypassClients())
}

export function getBypassAgendaCompTasks(clientId: string): AgendaCompTask[] {
  const today = new Date().toISOString().slice(0, 10)
  const comp = getBypassCompetitions().find(
    (c) => c.client_id === clientId && c.competition_date >= today
  )
  if (!comp) return []
  const due = new Date(`${comp.competition_date}T00:00:00`)
  due.setDate(due.getDate() - 3)
  return [
    {
      id: `agc-${comp.id}`,
      task: `Prep for ${comp.name}`,
      dueDate: due.toISOString().slice(0, 10),
      competitionName: comp.name,
    },
  ]
}

export function getBypassDashboard(): DashboardSummary {
  if (!hasImportedRoster()) return mockDashboard

  const roster = getBypassRosterList()
  const comps = getBypassCompetitions()
  const today = new Date().toISOString().slice(0, 10)
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)
  const tasks = getBypassTaskRows().filter(
    (t) => t.status === "open" || t.status === "in_progress"
  )

  return {
    activeClients: roster.length,
    upcomingCompetitions: comps.filter(
      (c) => c.competition_date >= today && c.competition_date <= in30
    ).length,
    openAlerts: 0, // overridden by the alert engine in getDashboardSummary
    avgCompliance: roster.length
      ? Math.round(
          roster.reduce((s, r) => s + r.complianceScore, 0) / roster.length
        )
      : 0,
    activeCuts: 0,
    todaysTasks: tasks.slice(0, 8),
    recentAlerts: [],
  }
}
