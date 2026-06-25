// ============================================================================
// Typed mock fixtures — mirror the SQL demo seed (supabase/seed_demo.sql).
// Use in tests, Storybook, or UI prototyping when Supabase isn't configured.
// These are NOT loaded by the running app, which reads live RLS-scoped data.
// ============================================================================

import {
  computeReadiness,
  generateRefuelProtocol,
  generateRehydrationProtocol,
  generateWaterLoadPlan,
  rehydrationWindowHours,
} from "@/lib/combat/protocols"
import {
  mockHydrationLogs,
  mockNutritionPlan,
  mockRecoveryLogs,
  mockTrainingProgram,
  mockWeightGoal,
  mockWeightLogs,
} from "@/lib/mock/series"
import {
  getMockWrestlingDetail,
  mockWrestlers,
  mockWrestlingBoard,
} from "@/lib/mock/wrestling"
import type {
  Alert,
  Client,
  ClientListItem,
  ClientSnapshot,
  CombatCutDetail,
  CombatCutListItem,
  Competition,
  DashboardSummary,
  Profile,
  ReadinessScore,
  Task,
  WeighIn,
  WeightClass,
  WeightCut,
} from "@/types/models"

const COACH = "00000000-0000-0000-0000-0000000000c0"

/** Stand-in coach profile used by the dev auth bypass. */
export const mockProfile: Profile = {
  id: COACH,
  clerk_id: "dev_bypass_coach",
  role: "coach",
  full_name: "Dev Coach",
  email: "dev@coachos.local",
  avatar_url: null,
  created_at: new Date(Date.now() - 365 * 86_400_000).toISOString(),
  updated_at: new Date().toISOString(),
}

/** The demo athlete the bypass "logs in" as for the client portal. */
export const MOCK_ATHLETE_ID = "c-jordan"

/** Stand-in client/athlete profile used by the dev auth bypass. */
export const mockClientProfile: Profile = {
  id: "00000000-0000-0000-0000-0000000000a1",
  clerk_id: "dev_bypass_athlete",
  role: "client",
  full_name: "Jordan Vance",
  email: "jordan.vance@example.com",
  avatar_url: null,
  created_at: new Date(Date.now() - 200 * 86_400_000).toISOString(),
  updated_at: new Date().toISOString(),
}

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString()
}
function dateFromNow(n: number): string {
  return daysFromNow(n).slice(0, 10)
}

function makeClient(p: Partial<Client> & Pick<Client, "id" | "first_name" | "last_name">): Client {
  return {
    coach_id: COACH,
    profile_id: null,
    email: null,
    phone: null,
    date_of_birth: null,
    gender: null,
    sport: null,
    discipline: null,
    current_weight_class: null,
    goal_summary: null,
    status: "active",
    start_date: null,
    avatar_url: null,
    emergency_contact: null,
    notes: "DEMO_SEED",
    current_weight: null,
    goal_weight: null,
    next_competition: null,
    competition_date: null,
    created_at: daysFromNow(-200),
    updated_at: daysFromNow(-1),
    ...p,
  }
}

export const mockClients: Client[] = [
  makeClient({
    id: "c-jordan",
    first_name: "Jordan",
    last_name: "Vance",
    email: "jordan.vance@example.com",
    sport: "Powerlifting",
    discipline: "Raw",
    current_weight_class: "-83kg",
    goal_summary: "Cut to 83kg for nationals; hold strength.",
    notes:
      "Sleep has been short this week — protect 7+ hrs and hit your protein target every day. Log your morning weight before breakfast. You've got this.",
  }),
  makeClient({
    id: "c-maya",
    first_name: "Maya",
    last_name: "Okafor",
    email: "maya.okafor@example.com",
    sport: "Weightlifting",
    discipline: "Olympic",
    current_weight_class: "-71kg",
    goal_summary: "Peak snatch/CJ for regional qualifier.",
  }),
  makeClient({
    id: "c-devon",
    first_name: "Devon",
    last_name: "Reyes",
    email: "devon.reyes@example.com",
    sport: "CrossFit",
    discipline: "Rx",
    goal_summary: "General prep; improve engine + recovery.",
  }),
  makeClient({
    id: "c-priya",
    first_name: "Priya",
    last_name: "Nair",
    email: "priya.nair@example.com",
    sport: "Powerlifting",
    discipline: "Raw",
    current_weight_class: "-63kg",
    goal_summary: "Off-season hypertrophy block.",
  }),
  makeClient({
    id: "c-luca",
    first_name: "Luca",
    last_name: "Bianchi",
    email: "luca.bianchi@example.com",
    sport: "Weightlifting",
    discipline: "Olympic",
    current_weight_class: "-96kg",
    status: "prospect",
    goal_summary: "Returning from shoulder rehab.",
  }),
  makeClient({
    id: "c-kai",
    first_name: "Kai",
    last_name: "Tanaka",
    email: "kai.tanaka@example.com",
    sport: "MMA",
    discipline: "Pro",
    current_weight_class: "Welterweight (-170)",
    goal_summary: "Make 170 for title fight; 24h rehydration window.",
  }),
  ...mockWrestlers,
]

function makeComp(p: Pick<Competition, "id" | "client_id" | "name" | "competition_date"> & Partial<Competition>): Competition {
  return {
    coach_id: COACH,
    federation: null,
    location: null,
    weight_class: null,
    divisions: [],
    status: "planned",
    result: null,
    placement: null,
    peak_weight: null,
    weigh_in_weight: null,
    notes: null,
    created_at: daysFromNow(-30),
    ...p,
  }
}

export const mockCompetitions: Competition[] = [
  makeComp({
    id: "comp-jordan",
    client_id: "c-jordan",
    name: "USAPL Raw Nationals",
    competition_date: dateFromNow(25),
    federation: "USAPL",
    weight_class: "-83kg",
    status: "registered",
  }),
  makeComp({
    id: "comp-maya",
    client_id: "c-maya",
    name: "State Weightlifting Qualifier",
    competition_date: dateFromNow(40),
    federation: "USAW",
    weight_class: "-71kg",
  }),
]

export const mockAlerts: Alert[] = [
  {
    id: "alert-1",
    coach_id: COACH,
    client_id: "c-devon",
    rule_key: "missed_weigh_in",
    severity: "critical",
    status: "active",
    title: "Devon Reyes — no weigh-in for 4 days",
    detail: "Last weight logged 5 days ago.",
    context: {},
    created_at: daysFromNow(-0.1),
    acknowledged_at: null,
    resolved_at: null,
    snoozed_until: null,
  },
  {
    id: "alert-2",
    coach_id: COACH,
    client_id: "c-devon",
    rule_key: "low_hydration",
    severity: "warning",
    status: "active",
    title: "Devon Reyes — hydration under 50% target",
    detail: "Averaging ~38 oz against a 100 oz target.",
    context: {},
    created_at: daysFromNow(-0.3),
    acknowledged_at: null,
    resolved_at: null,
    snoozed_until: null,
  },
]

export const mockTasks: Task[] = [
  {
    id: "task-1",
    coach_id: COACH,
    client_id: "c-devon",
    title: "Call Devon re: hydration + check-in",
    description: null,
    status: "open",
    priority: "urgent",
    due_date: dateFromNow(0),
    completed_at: null,
    created_at: daysFromNow(-1),
    updated_at: daysFromNow(-1),
  },
  {
    id: "task-2",
    coach_id: COACH,
    client_id: "c-jordan",
    title: "Review Jordan's peak-week macros",
    description: null,
    status: "open",
    priority: "high",
    due_date: dateFromNow(1),
    completed_at: null,
    created_at: daysFromNow(-1),
    updated_at: daysFromNow(-1),
  },
]

const compByClient = new Map(mockCompetitions.map((c) => [c.client_id, c]))
const alertCountByClient = mockAlerts.reduce<Record<string, number>>((acc, a) => {
  acc[a.client_id] = (acc[a.client_id] ?? 0) + 1
  return acc
}, {})

const COMPLIANCE_BY_ID: Record<string, number> = {
  "c-jordan": 92,
  "c-maya": 84,
  "c-devon": 41,
  "c-priya": 78,
  "c-luca": 0,
  "c-kai": 71,
  "c-cole": 88,
  "c-marcus": 52,
  "c-tyler": 90,
  "c-sam": 81,
  "c-ethan": 47,
}

export const mockRoster: ClientListItem[] = mockClients.map((client) => ({
  client,
  nextCompetition: compByClient.get(client.id) ?? null,
  openAlertCount: alertCountByClient[client.id] ?? 0,
  complianceScore: COMPLIANCE_BY_ID[client.id] ?? 70,
  latestBodyFatPct: mockWeightLogs(client.id).at(-1)?.body_fat_pct ?? null,
  lastActiveAt: mockWeightLogs(client.id).at(-1)?.logged_at ?? null,
}))

export const mockDashboard: DashboardSummary = {
  activeClients: mockClients.filter((c) => c.status === "active").length,
  upcomingCompetitions: mockCompetitions.length,
  openAlerts: mockAlerts.length,
  activeCuts: 1,
  avgCompliance: Math.round(
    mockRoster.reduce((s, r) => s + r.complianceScore, 0) / mockRoster.length
  ),
  todaysTasks: mockTasks,
  recentAlerts: mockAlerts,
}

// ---- Combat sports mock (MMA welterweight mid-cut) ------------------------

const KAI_WEIGH_IN = daysFromNow(10)
const KAI_COMP = daysFromNow(11)
const KAI_WINDOW = rehydrationWindowHours(KAI_WEIGH_IN, KAI_COMP)
const KAI_CURRENT = 179

export const mockWeightClasses: WeightClass[] = [
  { id: "wc-mma-fw", coach_id: null, discipline: "mma", federation: "UFC", name: "Featherweight", gender: "male", limit_lbs: 145, limit_kg: 65.8, sort_order: 3, created_at: daysFromNow(-200) },
  { id: "wc-mma-lw", coach_id: null, discipline: "mma", federation: "UFC", name: "Lightweight", gender: "male", limit_lbs: 155, limit_kg: 70.3, sort_order: 4, created_at: daysFromNow(-200) },
  { id: "wc-mma-ww", coach_id: null, discipline: "mma", federation: "UFC", name: "Welterweight", gender: "male", limit_lbs: 170, limit_kg: 77.1, sort_order: 5, created_at: daysFromNow(-200) },
  { id: "wc-box-lw", coach_id: null, discipline: "boxing", federation: "—", name: "Lightweight", gender: "male", limit_lbs: 135, limit_kg: 61.2, sort_order: 4, created_at: daysFromNow(-200) },
]

export const mockWeightCut: WeightCut = {
  id: "cut-kai",
  client_id: "c-kai",
  coach_id: COACH,
  competition_id: null,
  weight_class_id: "wc-mma-ww",
  discipline: "mma",
  class_name: "Welterweight",
  class_limit_lbs: 170,
  walk_around_lbs: 191,
  camp_start_lbs: 185,
  target_weigh_in_lbs: 170,
  weigh_in_at: KAI_WEIGH_IN,
  competition_at: KAI_COMP,
  rehydration_window_hours: KAI_WINDOW,
  cut_method: "Water load + sauna",
  status: "active",
  made_weight: null,
  notes: "Title fight; disciplined water load underway.",
  created_at: daysFromNow(-30),
  updated_at: daysFromNow(-1),
  water_load_plan: generateWaterLoadPlan(),
  hydration_restoration: generateRehydrationProtocol(KAI_WINDOW),
  refuel_protocol: generateRefuelProtocol(KAI_WINDOW),
}

export const mockWeighIns: WeighIn[] = [
  { id: "wi-1", weight_cut_id: "cut-kai", client_id: "c-kai", kind: "check_in", scheduled_at: daysFromNow(-7), target_lbs: 170, weight_lbs: 186, made_weight: false, recorded_at: daysFromNow(-7), notes: "Camp start check", created_at: daysFromNow(-7) },
  { id: "wi-2", weight_cut_id: "cut-kai", client_id: "c-kai", kind: "check_in", scheduled_at: daysFromNow(-3), target_lbs: 170, weight_lbs: 181.5, made_weight: false, recorded_at: daysFromNow(-3), notes: "On pace", created_at: daysFromNow(-3) },
  { id: "wi-3", weight_cut_id: "cut-kai", client_id: "c-kai", kind: "check_in", scheduled_at: daysFromNow(0), target_lbs: 170, weight_lbs: KAI_CURRENT, made_weight: false, recorded_at: daysFromNow(0), notes: "Begin water load", created_at: daysFromNow(0) },
  { id: "wi-4", weight_cut_id: "cut-kai", client_id: "c-kai", kind: "official", scheduled_at: KAI_WEIGH_IN, target_lbs: 170, weight_lbs: null, made_weight: null, recorded_at: null, notes: "Official weigh-in", created_at: daysFromNow(-30) },
]

export const mockReadiness: ReadinessScore = computeReadiness({
  currentLbs: KAI_CURRENT,
  targetLbs: 170,
  weighInAt: KAI_WEIGH_IN,
  hydrationLogs7d: 6,
  recoveryLogs7d: 6,
  avgSleepHours: 6.4,
  trainingCompleted14d: 2,
})

const kaiClient = mockClients.find((c) => c.id === "c-kai")!

export const mockCombatBoard: CombatCutListItem[] = [
  {
    cut: mockWeightCut,
    client: {
      id: kaiClient.id,
      first_name: kaiClient.first_name,
      last_name: kaiClient.last_name,
      avatar_url: kaiClient.avatar_url,
      sport: kaiClient.sport,
    },
    latestWeightLbs: KAI_CURRENT,
    readiness: mockReadiness,
    nextWeighIn: mockWeighIns.find((w) => w.kind === "official") ?? null,
  },
  ...mockWrestlingBoard,
]

export const mockCombatDetail: CombatCutDetail = {
  cut: mockWeightCut,
  weighIns: mockWeighIns,
  latestWeightLbs: KAI_CURRENT,
  readiness: mockReadiness,
  weightClass: mockWeightClasses.find((c) => c.id === "wc-mma-ww") ?? null,
}

export function getMockCombatDetail(clientId: string): CombatCutDetail | null {
  if (clientId === "c-kai") return mockCombatDetail
  return getMockWrestlingDetail(clientId)
}

/** Weight series for the cut descent chart, derived from the mock weight logs. */
export function getMockWeightSeries(clientId: string): { date: string; weight: number }[] {
  return mockWeightLogs(clientId).map((w) => ({
    date: w.logged_at.slice(0, 10),
    weight: w.weight_lbs,
  }))
}

export function getMockClient(clientId: string): Client | null {
  return mockClients.find((c) => c.id === clientId) ?? null
}

export function getMockSnapshot(clientId: string): ClientSnapshot | null {
  const client = mockClients.find((c) => c.id === clientId)
  if (!client) return null

  const weights = mockWeightLogs(clientId)
  const hydration = mockHydrationLogs(clientId)
  const recovery = mockRecoveryLogs(clientId)

  return {
    client,
    latestWeight: weights.at(-1) ?? null,
    weightGoal: mockWeightGoal(clientId),
    activeNutritionPlan: mockNutritionPlan(clientId),
    hydrationToday: hydration.at(-1) ?? null,
    latestRecovery: recovery.at(-1) ?? null,
    activeProgram: mockTrainingProgram(clientId),
    nextCompetition: mockCompetitions.find((c) => c.client_id === clientId) ?? null,
    openAlerts: mockAlerts.filter((a) => a.client_id === clientId),
    complianceScore:
      mockRoster.find((r) => r.client.id === clientId)?.complianceScore ?? 70,
  }
}
