import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { getAllComputedAlerts } from "@/lib/data/alerts"
import { listActiveCutsForBoard } from "@/lib/data/combat"
import { listClientsForRoster } from "@/lib/data/clients"
import {
  ensureImportedBaselines,
  getBypassAgendaCompTasks,
  getBypassClients,
  getBypassTaskRows,
  hasImportedRoster,
} from "@/lib/dev-roster-store"
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
  // Reminders: generated tasks for imported rosters, demo tasks otherwise.
  const taskRows = imported ? getBypassTaskRows() : mockTasks

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
