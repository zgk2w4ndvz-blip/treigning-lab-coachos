import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { getAllComputedAlerts } from "@/lib/data/alerts"
import { listActiveCutsForBoard } from "@/lib/data/combat"
import { listClientsForRoster } from "@/lib/data/clients"
import { getInboxPendingCount } from "@/lib/data/inbox"
import { mockAthleteCalendar } from "@/lib/data/athlete-calendar"
import { expandOccurrences } from "@/lib/calendar/recurrence"
import { getOperatingTimeZone } from "@/lib/data/settings"
import { dayKeyInZone, DEFAULT_OPERATING_TZ } from "@/lib/calendar/timezone"
import { planDirection } from "@/lib/metrics/weight-plan"
import {
  bucketDay,
  byStartsAt,
  behindPlanToItem,
  competitionToItem,
  occurrenceToItem,
  overdueTaskToItem,
  recoveryToItem,
  weightPlanBehind,
} from "@/lib/agenda/build"
import { fullName } from "@/lib/utils/format"
import type {
  AgendaAttention,
  AgendaDashboard,
  AgendaItem,
} from "@/types/models"
import {
  ensureImportedBaselines,
  getBypassAgendaCompTasks,
  getBypassClients,
  getBypassCompetitions,
  getBypassTaskRows,
  hasImportedRoster,
} from "@/lib/dev-roster-store"
import { getCreatedTaskRows } from "@/lib/dev-tasks-store"
import { mockTasks } from "@/lib/mock/athletes"
import {
  mockHydrationLogs,
  mockNutritionPlan,
  mockRecoveryLogs,
  mockSupplements,
  mockTrainingSessions,
} from "@/lib/mock/series"
import type {
  AgendaCompTask,
  AgendaPriority,
  Alert,
  AthleteAgenda,
  Client,
  Severity,
  Supplement,
  Task,
  TrainingSession,
} from "@/types/models"

/** Agenda before today's enrichment (priority, readiness, compliance, alerts). */
type AgendaBase = Omit<
  AthleteAgenda,
  | "priority"
  | "priorityReasons"
  | "readiness"
  | "compliance"
  | "alerts"
  | "isWeightCut"
  | "isCompetition"
  | "missedCheckIn"
>

const SLEEP_TARGET_H = 8

function dayBounds(date = new Date()) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

function isToday(iso: string | null): boolean {
  if (!iso) return false
  const { startIso, endIso } = dayBounds()
  return iso >= startIso && iso < endIso
}

// ---- mock competition prep tasks (bypass) ----------------------------------

const MOCK_COMP_TASKS: Record<string, AgendaCompTask[]> = {
  "c-jordan": [
    { id: "ct-j1", task: "Finalize attempt selections", dueDate: dateFromNow(18), competitionName: "USAPL Raw Nationals" },
    { id: "ct-j2", task: "Send water-cut protocol", dueDate: dateFromNow(20), competitionName: "USAPL Raw Nationals" },
  ],
  "c-kai": [
    { id: "ct-k1", task: "Confirm sauna / water-load schedule", dueDate: dateFromNow(2), competitionName: "Apex FC 42 — Title Fight" },
    { id: "ct-k2", task: "Day-of meal timing plan", dueDate: dateFromNow(9), competitionName: "Apex FC 42 — Title Fight" },
  ],
  "c-maya": [
    { id: "ct-m1", task: "Register for qualifier", dueDate: dateFromNow(12), competitionName: "State Weightlifting Qualifier" },
  ],
}

function dateFromNow(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
}

// ---- priority -------------------------------------------------------------

function dueWithin(dateStr: string, days: number): boolean {
  const due = new Date(dateStr).getTime()
  return due <= Date.now() + days * 86_400_000
}

function computePriority(
  ag: AgendaBase,
  severities: Set<Severity> | undefined
): { priority: AgendaPriority; reasons: string[] } {
  const reasons: string[] = []
  const has = (s: Severity) => severities?.has(s) ?? false

  const urgentReminder = ag.reminders.some((r) => r.priority === "urgent")
  if (ag.weighInToday) reasons.push("Weigh-in today")
  if (has("critical")) reasons.push("Critical alert")
  if (urgentReminder) reasons.push("Urgent reminder")
  if (ag.weighInToday || has("critical") || urgentReminder) {
    return { priority: "urgent", reasons }
  }

  const highReminder = ag.reminders.some((r) => r.priority === "high")
  const compSoon = ag.competitionTasks.some(
    (t) => t.dueDate && dueWithin(t.dueDate, 2)
  )
  if (has("warning")) reasons.push("Warning alert")
  if (highReminder) reasons.push("High-priority reminder")
  if (compSoon) reasons.push("Competition task due soon")
  if (has("warning") || highReminder || compSoon) {
    return { priority: "attention", reasons }
  }

  reasons.push("On track")
  return { priority: "steady", reasons }
}

// ---- public API ------------------------------------------------------------

/** Every active athlete's agenda for today, enriched + priority-ranked. */
export async function getDailyAgenda(): Promise<AthleteAgenda[]> {
  const [base, alerts, cutBoard, roster] = await Promise.all([
    DEV_AUTH_BYPASS ? buildMockAgenda() : buildLiveAgenda(),
    getAllComputedAlerts(),
    listActiveCutsForBoard(),
    listClientsForRoster(),
  ])

  // Computed alerts grouped per athlete.
  const alertsByClient = new Map<string, Alert[]>()
  const sevByClient = new Map<string, Set<Severity>>()
  for (const a of alerts) {
    const list = alertsByClient.get(a.client_id) ?? []
    list.push(a)
    alertsByClient.set(a.client_id, list)
    const set = sevByClient.get(a.client_id) ?? new Set<Severity>()
    set.add(a.severity)
    sevByClient.set(a.client_id, set)
  }

  // Readiness + cut flag from the combat board.
  const readinessByClient = new Map<string, number>()
  for (const item of cutBoard) {
    readinessByClient.set(item.client.id, item.readiness.overall)
  }
  // Compliance from the roster (7-day proxy).
  const complianceByClient = new Map<string, number>()
  for (const r of roster) complianceByClient.set(r.client.id, r.complianceScore)

  const enriched: AthleteAgenda[] = base.map((ag) => {
    const id = ag.client.id
    const clientAlerts = alertsByClient.get(id) ?? []
    const { priority, reasons } = computePriority(ag, sevByClient.get(id))
    const isWeightCut = readinessByClient.has(id)
    return {
      ...ag,
      priority,
      priorityReasons: reasons,
      readiness: readinessByClient.get(id) ?? null,
      compliance: complianceByClient.get(id) ?? 0,
      alerts: clientAlerts,
      isWeightCut,
      isCompetition:
        isWeightCut || ag.competitionTasks.length > 0 || ag.weighInToday,
      missedCheckIn: clientAlerts.some(
        (a) => a.rule_key === "missed_weigh_in"
      ),
    }
  })

  const order: Record<AgendaPriority, number> = {
    urgent: 0,
    attention: 1,
    steady: 2,
  }
  return enriched.sort(
    (a, b) =>
      order[a.priority] - order[b.priority] ||
      a.client.first_name.localeCompare(b.client.first_name)
  )
}

function buildMockAgenda(): AgendaBase[] {
  ensureImportedBaselines()
  const imported = hasImportedRoster()
  const clients = getBypassClients().filter((c) => c.status === "active")
  // Reminders: generated tasks for imported rosters, demo tasks otherwise, plus
  // any hand-created tasks (incl. those minted by approving inbox suggestions).
  const taskRows = [
    ...(imported ? getBypassTaskRows() : mockTasks),
    ...getCreatedTaskRows(),
  ]

  return clients.map((client) => {
    const plan = mockNutritionPlan(client.id)
    const hydration = mockHydrationLogs(client.id)
    const recovery = mockRecoveryLogs(client.id)
    const latestRecovery = recovery.at(-1) ?? null
    const sessions = mockTrainingSessions(client.id).filter((s) =>
      isToday(s.scheduled_at)
    )
    return {
      client,
      training: sessions,
      caloriesTarget: plan?.calories ?? null,
      proteinTarget: plan?.protein_g ?? null,
      waterTargetOz: hydration.at(-1)?.oz_target ?? null,
      supplements: mockSupplements(client.id),
      recovery: {
        sleepTargetH: SLEEP_TARGET_H,
        latestSleepH: latestRecovery?.sleep_hours ?? null,
        latestSoreness: latestRecovery?.soreness ?? null,
      },
      competitionTasks: imported
        ? getBypassAgendaCompTasks(client.id)
        : MOCK_COMP_TASKS[client.id] ?? [],
      reminders: taskRows.filter(
        (t) => t.client_id === client.id && t.status !== "done"
      ),
      weighInToday: false,
    } satisfies AgendaBase
  })
}

async function buildLiveAgenda(): Promise<AgendaBase[]> {
  const supabase = await createServerSupabase()
  const { startIso, endIso } = dayBounds()
  const today = startIso.slice(0, 10)

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("status", "active")
    .order("first_name", { ascending: true })

  const ids = (clients ?? []).map((c) => c.id)
  if (ids.length === 0) return []

  const [
    sessions,
    plans,
    hydration,
    supplements,
    competitions,
    recovery,
    reminders,
    weighIns,
  ] = await Promise.all([
    supabase
      .from("training_sessions")
      .select("*")
      .in("client_id", ids)
      .gte("scheduled_at", startIso)
      .lt("scheduled_at", endIso),
    supabase
      .from("nutrition_plans")
      .select("*")
      .in("client_id", ids)
      .eq("is_active", true),
    supabase
      .from("hydration_logs")
      .select("client_id, oz_target, logged_date")
      .in("client_id", ids)
      .order("logged_date", { ascending: false }),
    supabase
      .from("supplements")
      .select("*")
      .in("client_id", ids)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("competitions")
      .select("id, client_id, name")
      .in("client_id", ids)
      .gte("competition_date", today),
    supabase
      .from("recovery_logs")
      .select("client_id, sleep_hours, soreness, logged_date")
      .in("client_id", ids)
      .order("logged_date", { ascending: false }),
    supabase
      .from("tasks")
      .select("*")
      .in("client_id", ids)
      .in("status", ["open", "in_progress"]),
    supabase
      .from("weigh_ins")
      .select("client_id, scheduled_at")
      .in("client_id", ids)
      .gte("scheduled_at", startIso)
      .lt("scheduled_at", endIso),
  ])

  // group helpers
  const byClient = <T extends { client_id: string }>(rows: T[] | null) => {
    const m = new Map<string, T[]>()
    for (const r of rows ?? []) {
      const list = m.get(r.client_id) ?? []
      list.push(r)
      m.set(r.client_id, list)
    }
    return m
  }

  const sessionsBy = byClient<TrainingSession>(sessions.data as TrainingSession[])
  const planBy = new Map((plans.data ?? []).map((p) => [p.client_id, p]))
  const suppBy = byClient<Supplement>(supplements.data as Supplement[])

  // reminders: tasks.client_id is nullable, but the query filters to our ids
  const reminderBy = new Map<string, Task[]>()
  for (const t of (reminders.data ?? []) as Task[]) {
    if (!t.client_id) continue
    const list = reminderBy.get(t.client_id) ?? []
    list.push(t)
    reminderBy.set(t.client_id, list)
  }

  // latest hydration target per client
  const waterBy = new Map<string, number | null>()
  for (const h of hydration.data ?? []) {
    if (!waterBy.has(h.client_id)) waterBy.set(h.client_id, h.oz_target)
  }
  // latest recovery per client
  const recoveryBy = new Map<string, { sleep_hours: number | null; soreness: number | null }>()
  for (const r of recovery.data ?? []) {
    if (!recoveryBy.has(r.client_id))
      recoveryBy.set(r.client_id, { sleep_hours: r.sleep_hours, soreness: r.soreness })
  }

  // competition tasks (need a second query keyed on competition ids)
  const compById = new Map((competitions.data ?? []).map((c) => [c.id, c]))
  const compTaskBy = new Map<string, AgendaCompTask[]>()
  if (compById.size > 0) {
    const { data: compTasks } = await supabase
      .from("competition_tasks")
      .select("*")
      .in("competition_id", [...compById.keys()])
      .eq("completed", false)
    for (const t of compTasks ?? []) {
      const comp = compById.get(t.competition_id)
      if (!comp) continue
      const list = compTaskBy.get(comp.client_id) ?? []
      list.push({
        id: t.id,
        task: t.task,
        dueDate: t.due_date,
        competitionName: comp.name,
      })
      compTaskBy.set(comp.client_id, list)
    }
  }

  const weighInToday = new Set((weighIns.data ?? []).map((w) => w.client_id))

  return (clients ?? []).map((client: Client) => {
    const plan = planBy.get(client.id)
    const rec = recoveryBy.get(client.id)
    return {
      client,
      training: sessionsBy.get(client.id) ?? [],
      caloriesTarget: plan?.calories ?? null,
      proteinTarget: plan?.protein_g ?? null,
      waterTargetOz: waterBy.get(client.id) ?? null,
      supplements: suppBy.get(client.id) ?? [],
      recovery: {
        sleepTargetH: SLEEP_TARGET_H,
        latestSleepH: rec?.sleep_hours ?? null,
        latestSoreness: rec?.soreness ?? null,
      },
      competitionTasks: compTaskBy.get(client.id) ?? [],
      reminders: reminderBy.get(client.id) ?? [],
      weighInToday: weighInToday.has(client.id),
    } satisfies AgendaBase
  })
}

// ============================================================================
// Phase 2C — normalized Agenda dashboard (Today / Attention / Upcoming 7 days).
// Aggregates existing sources only; reuses the timezone-safe calendar expansion
// (lib/calendar/recurrence) — no new tables, no duplicated recurrence logic.
// ============================================================================

const DAY_MS = 86_400_000

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabase>>

/** Weight plans whose latest weigh-in is behind the current week's target. */
async function computeBehindPlans(
  supabase: SupabaseClient,
  todayKey: string,
  nameById: Map<string, string>
): Promise<AgendaItem[]> {
  const { data: plans } = await supabase
    .from("weight_plans")
    .select("id, client_id, current_weight, goal_weight")
    .eq("is_active", true)
  if (!plans || plans.length === 0) return []

  const planIds = plans.map((p) => p.id)
  const clientIds = plans.map((p) => p.client_id)
  const [{ data: targets }, { data: weights }] = await Promise.all([
    supabase
      .from("weight_plan_targets")
      .select("plan_id, week_start, target_weight")
      .in("plan_id", planIds)
      .lte("week_start", todayKey)
      .order("week_start", { ascending: false }),
    supabase
      .from("weight_logs")
      .select("client_id, weight_lbs, logged_at")
      .in("client_id", clientIds)
      .order("logged_at", { ascending: false }),
  ])

  // current-week target = latest week_start <= today, per plan
  const targetByPlan = new Map<string, number>()
  for (const t of targets ?? []) {
    if (!targetByPlan.has(t.plan_id) && t.target_weight != null) {
      targetByPlan.set(t.plan_id, t.target_weight)
    }
  }
  const latestByClient = new Map<string, number>()
  for (const w of weights ?? []) {
    if (!latestByClient.has(w.client_id) && w.weight_lbs != null) {
      latestByClient.set(w.client_id, w.weight_lbs)
    }
  }

  const items: AgendaItem[] = []
  for (const p of plans) {
    const target = targetByPlan.get(p.id) ?? null
    const latest = latestByClient.get(p.client_id) ?? null
    const direction = planDirection(p.current_weight, p.goal_weight)
    if (weightPlanBehind({ latest, target, direction })) {
      items.push(
        behindPlanToItem(p.client_id, nameById.get(p.client_id) ?? null, `${latest} lb vs ${target} lb target`)
      )
    }
  }
  return items
}

/** Attention block: unapproved prescriptions, unreviewed messages, overdue
 *  tasks, weight plans behind target. */
async function computeAttention(
  supabase: SupabaseClient,
  todayKey: string,
  nameById: Map<string, string>
): Promise<AgendaAttention> {
  const sevenDaysAgo = new Date(Date.now() - 7 * DAY_MS).toISOString()
  const [pending, { data: tasks }, { count: msgCount }, behindPlanItems] = await Promise.all([
    getInboxPendingCount(),
    supabase
      .from("tasks")
      .select("id, client_id, title, due_date, status")
      .in("status", ["open", "in_progress"])
      .not("due_date", "is", null)
      .lt("due_date", todayKey),
    supabase
      .from("message_ingest")
      .select("id", { count: "exact", head: true })
      .eq("direction", "incoming")
      .gte("received_at", sevenDaysAgo),
    computeBehindPlans(supabase, todayKey, nameById),
  ])

  const overdueTaskItems = (tasks ?? []).map((t) =>
    overdueTaskToItem(t as never, t.client_id ? nameById.get(t.client_id) ?? null : null)
  )

  return {
    unapprovedPrescriptions: pending,
    unreviewedMessages: msgCount ?? 0,
    overdueTasks: overdueTaskItems.length,
    weightPlansBehind: behindPlanItems.length,
    overdueTaskItems,
    behindPlanItems,
  }
}

async function liveDashboard(
  tz: string,
  todayKey: string,
  horizonKey: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<AgendaDashboard> {
  const supabase = await createServerSupabase()
  const [{ data: clients }, { data: calEvents }, { data: overrides }, { data: comps }, { data: recovery }] =
    await Promise.all([
      supabase.from("clients").select("id, first_name, last_name"),
      supabase.from("athlete_calendar_events").select("*"),
      supabase.from("athlete_calendar_event_overrides").select("*"),
      supabase
        .from("competitions")
        .select("id, client_id, name, competition_date, weight_class, status")
        .gte("competition_date", todayKey)
        .lte("competition_date", horizonKey)
        .neq("status", "cancelled"),
      supabase
        .from("recovery_logs")
        .select("id, client_id, logged_date, modalities")
        .eq("logged_date", todayKey),
    ])

  const nameById = new Map((clients ?? []).map((c) => [c.id, fullName(c.first_name, c.last_name)]))
  const name = (id: string | null | undefined) => (id ? nameById.get(id) ?? null : null)

  const calToday: AgendaItem[] = []
  const calUpcoming: AgendaItem[] = []
  for (const o of expandOccurrences(calEvents ?? [], rangeStart, rangeEnd, overrides ?? [], tz)) {
    const bucket = bucketDay(o.date, todayKey, horizonKey)
    if (bucket === "today") calToday.push(occurrenceToItem(o, name(o.event.client_id)))
    else if (bucket === "upcoming") calUpcoming.push(occurrenceToItem(o, name(o.event.client_id)))
  }

  const compToday: AgendaItem[] = []
  const compUpcoming: AgendaItem[] = []
  for (const c of comps ?? []) {
    if (!c.competition_date) continue
    const item = competitionToItem(c as never, name(c.client_id))
    const bucket = bucketDay(c.competition_date.slice(0, 10), todayKey, horizonKey)
    if (bucket === "today") compToday.push(item)
    else if (bucket === "upcoming") compUpcoming.push(item)
  }

  const recToday = (recovery ?? []).map((r) => recoveryToItem(r as never, name(r.client_id)))
  const attention = await computeAttention(supabase, todayKey, nameById)

  return {
    today: [...calToday, ...compToday, ...recToday].sort(byStartsAt),
    upcoming: [...calUpcoming, ...compUpcoming].sort(byStartsAt),
    attention,
    timeZone: tz,
    generatedAt: new Date().toISOString(),
  }
}

function bypassDashboard(
  tz: string,
  todayKey: string,
  horizonKey: string,
  rangeStart: Date,
  rangeEnd: Date
): AgendaDashboard {
  const clients = getBypassClients().filter((c) => c.status === "active")
  const nameById = new Map(clients.map((c) => [c.id, fullName(c.first_name, c.last_name)]))
  const events = clients.flatMap((c) => mockAthleteCalendar(c.id))

  const calToday: AgendaItem[] = []
  const calUpcoming: AgendaItem[] = []
  for (const o of expandOccurrences(events, rangeStart, rangeEnd, [], tz)) {
    const bucket = bucketDay(o.date, todayKey, horizonKey)
    if (bucket === "today") calToday.push(occurrenceToItem(o, nameById.get(o.event.client_id) ?? null))
    else if (bucket === "upcoming") calUpcoming.push(occurrenceToItem(o, nameById.get(o.event.client_id) ?? null))
  }

  const compToday: AgendaItem[] = []
  const compUpcoming: AgendaItem[] = []
  for (const c of getBypassCompetitions()) {
    if (!c.competition_date) continue
    const item = competitionToItem(c, nameById.get(c.client_id) ?? null)
    const bucket = bucketDay(c.competition_date.slice(0, 10), todayKey, horizonKey)
    if (bucket === "today") compToday.push(item)
    else if (bucket === "upcoming") compUpcoming.push(item)
  }

  return {
    today: [...calToday, ...compToday].sort(byStartsAt),
    upcoming: [...calUpcoming, ...compUpcoming].sort(byStartsAt),
    attention: {
      unapprovedPrescriptions: 0,
      unreviewedMessages: 0,
      overdueTasks: 0,
      weightPlansBehind: 0,
      overdueTaskItems: [],
      behindPlanItems: [],
    },
    timeZone: tz,
    generatedAt: new Date().toISOString(),
  }
}

/** Full normalized agenda dashboard (Today / Attention / Upcoming 7 days). */
export async function getAgendaDashboard(): Promise<AgendaDashboard> {
  const tz = DEV_AUTH_BYPASS ? DEFAULT_OPERATING_TZ : await getOperatingTimeZone()
  const now = new Date()
  const todayKey = dayKeyInZone(now, tz)
  const horizonKey = dayKeyInZone(new Date(now.getTime() + 7 * DAY_MS), tz)
  const rangeStart = new Date(now.getTime() - DAY_MS)
  const rangeEnd = new Date(now.getTime() + 8 * DAY_MS)
  return DEV_AUTH_BYPASS
    ? bypassDashboard(tz, todayKey, horizonKey, rangeStart, rangeEnd)
    : liveDashboard(tz, todayKey, horizonKey, rangeStart, rangeEnd)
}

/** Lighter attention-only summary (for the coach dashboard integration). */
export async function getAgendaAttention(): Promise<AgendaAttention> {
  if (DEV_AUTH_BYPASS) {
    const pending = await getInboxPendingCount()
    return {
      unapprovedPrescriptions: pending,
      unreviewedMessages: 0,
      overdueTasks: 0,
      weightPlansBehind: 0,
      overdueTaskItems: [],
      behindPlanItems: [],
    }
  }
  const tz = await getOperatingTimeZone()
  const todayKey = dayKeyInZone(new Date(), tz)
  const supabase = await createServerSupabase()
  const { data: clients } = await supabase.from("clients").select("id, first_name, last_name")
  const nameById = new Map((clients ?? []).map((c) => [c.id, fullName(c.first_name, c.last_name)]))
  return computeAttention(supabase, todayKey, nameById)
}
