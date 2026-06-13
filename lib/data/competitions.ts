import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import {
  getBypassClientById,
  getBypassCompetitions,
} from "@/lib/dev-roster-store"
import { listActiveCutsForBoard, getClientWeightSeries } from "@/lib/data/combat"
import {
  cutRisk,
  daysUntil,
  measuredDailyLossRate,
  projectCut,
} from "@/lib/wrestling/projection"
import { DISCIPLINE_LABELS } from "@/lib/combat/protocols"
import { fullName } from "@/lib/utils/format"
import type {
  CompetitionBoard,
  CompetitionEvent,
  CompetitionPrepTask,
} from "@/types/models"

function dateFromNow(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
}

// ---- mock prep-task checklists (dev bypass) --------------------------------

const PREP: Record<string, CompetitionPrepTask[]> = {
  "c-kai": [
    { id: "p-kai-1", task: "Confirm sauna / water-load schedule", dueDate: dateFromNow(2), completed: false },
    { id: "p-kai-2", task: "Day-of meal timing plan", dueDate: dateFromNow(9), completed: false },
    { id: "p-kai-3", task: "Cornerman credentials", dueDate: dateFromNow(6), completed: true },
  ],
  "c-cole": [
    { id: "p-cole-1", task: "Hydration test", dueDate: dateFromNow(3), completed: false },
    { id: "p-cole-2", task: "Confirm weigh-in time", dueDate: dateFromNow(4), completed: true },
  ],
  "c-marcus": [
    { id: "p-marc-1", task: "Skin check", dueDate: dateFromNow(2), completed: false },
    { id: "p-marc-2", task: "Travel + hotel", dueDate: dateFromNow(1), completed: false },
  ],
  "c-tyler": [
    { id: "p-tyl-1", task: "Submit roster card", dueDate: dateFromNow(8), completed: true },
  ],
  "c-ethan": [
    { id: "p-eth-1", task: "Confirm weigh-in time", dueDate: dateFromNow(1), completed: false },
  ],
  "c-jordan": [
    { id: "p-jor-1", task: "Finalize attempt selections", dueDate: dateFromNow(18), completed: false },
    { id: "p-jor-2", task: "Book travel + hotel", dueDate: dateFromNow(5), completed: true },
  ],
  "c-maya": [
    { id: "p-may-1", task: "Register for qualifier", dueDate: dateFromNow(12), completed: false },
  ],
}

// ---- builders --------------------------------------------------------------

async function buildCutEvents(
  filterClientId?: string
): Promise<CompetitionEvent[]> {
  const board = (await listActiveCutsForBoard()).filter(
    (i) => !filterClientId || i.client.id === filterClientId
  )

  return Promise.all(
    board.map(async (item): Promise<CompetitionEvent> => {
      const { cut, client, readiness } = item
      const series = await getClientWeightSeries(client.id, 14)
      const proj = projectCut({
        currentLbs: item.latestWeightLbs,
        targetLbs: cut.target_weigh_in_lbs,
        weighInAt: cut.weigh_in_at,
        dailyLossRateLbs: measuredDailyLossRate(series),
      })
      return {
        id: cut.id,
        source: "cut",
        clientId: client.id,
        clientName: fullName(client.first_name, client.last_name),
        avatarUrl: client.avatar_url,
        sport: client.sport,
        name: `${DISCIPLINE_LABELS[cut.discipline]} · ${cut.class_name ?? "—"}`,
        weightClass: cut.class_name,
        competitionAt: cut.competition_at,
        weighInAt: cut.weigh_in_at,
        status: cut.status,
        daysToComp: daysUntil(cut.competition_at),
        daysToWeighIn: proj.daysToWeighIn,
        currentLbs: proj.currentLbs,
        targetLbs: cut.target_weigh_in_lbs,
        projectedLbs: proj.projectedLbs,
        weeklyLossTargetLbs: proj.weeklyLossTargetLbs,
        dailyLossTargetLbs: proj.dailyLossTargetLbs,
        cutRisk: cutRisk(proj.pctBodyweightPerDay, readiness.overall),
        readiness: readiness.overall,
        hydrationPlan: cut.hydration_restoration,
        fuelingReminders: cut.refuel_protocol,
        prepTasks: PREP[client.id] ?? [],
      }
    })
  )
}

async function buildCompetitionEvents(
  filterClientId?: string
): Promise<CompetitionEvent[]> {
  const today = new Date().toISOString().slice(0, 10)

  if (DEV_AUTH_BYPASS) {
    return getBypassCompetitions()
      .filter(
        (c) =>
          c.competition_date >= today &&
          (!filterClientId || c.client_id === filterClientId)
      )
      .map((c): CompetitionEvent => {
        const client = getBypassClientById(c.client_id)
        return {
          id: c.id,
          source: "competition",
          clientId: c.client_id,
          clientName: client
            ? fullName(client.first_name, client.last_name)
            : "Athlete",
          avatarUrl: client?.avatar_url ?? null,
          sport: client?.sport ?? null,
          name: c.name,
          weightClass: c.weight_class,
          competitionAt: c.competition_date,
          weighInAt: null,
          status: c.status,
          daysToComp: daysUntil(c.competition_date),
          daysToWeighIn: null,
          currentLbs: null,
          targetLbs: null,
          projectedLbs: null,
          weeklyLossTargetLbs: null,
          dailyLossTargetLbs: null,
          cutRisk: null,
          readiness: null,
          hydrationPlan: [],
          fuelingReminders: [],
          prepTasks: PREP[c.client_id] ?? [],
        }
      })
  }

  const supabase = await createServerSupabase()
  let q = supabase
    .from("competitions")
    .select("*")
    .gte("competition_date", today)
    .order("competition_date", { ascending: true })
  if (filterClientId) q = q.eq("client_id", filterClientId)
  const { data } = await q
  const comps = data ?? []

  // Resolve client names + prep tasks in separate queries (no PostgREST embed).
  const clientIds = [...new Set(comps.map((c) => c.client_id))]
  const { data: clientRows } =
    clientIds.length > 0
      ? await supabase
          .from("clients")
          .select("id, first_name, last_name, avatar_url, sport")
          .in("id", clientIds)
      : { data: [] }
  const clientMap = new Map((clientRows ?? []).map((c) => [c.id, c]))

  const compIds = comps.map((c) => c.id)
  const taskBy = new Map<string, CompetitionPrepTask[]>()
  if (compIds.length > 0) {
    const { data: tasks } = await supabase
      .from("competition_tasks")
      .select("*")
      .in("competition_id", compIds)
    for (const t of tasks ?? []) {
      const list = taskBy.get(t.competition_id) ?? []
      list.push({ id: t.id, task: t.task, dueDate: t.due_date, completed: t.completed })
      taskBy.set(t.competition_id, list)
    }
  }

  return comps.map((c): CompetitionEvent => {
    const client = clientMap.get(c.client_id)
    return {
      id: c.id,
      source: "competition",
      clientId: c.client_id,
      clientName: client ? fullName(client.first_name, client.last_name) : "Athlete",
      avatarUrl: client?.avatar_url ?? null,
      sport: client?.sport ?? null,
      name: c.name,
      weightClass: c.weight_class,
      competitionAt: c.competition_date,
      weighInAt: null,
      status: c.status,
      daysToComp: daysUntil(c.competition_date),
      daysToWeighIn: null,
      currentLbs: null,
      targetLbs: null,
      projectedLbs: null,
      weeklyLossTargetLbs: null,
      dailyLossTargetLbs: null,
      cutRisk: null,
      readiness: null,
      hydrationPlan: [],
      fuelingReminders: [],
      prepTasks: taskBy.get(c.id) ?? [],
    }
  })
}

function sortEvents(events: CompetitionEvent[]): CompetitionEvent[] {
  const key = (e: CompetitionEvent) => e.competitionAt ?? e.weighInAt ?? "9999"
  return [...events].sort((a, b) => key(a).localeCompare(key(b)))
}

// ---- public API ------------------------------------------------------------

export async function getCompetitionBoard(): Promise<CompetitionBoard> {
  const [cutEvents, compEvents] = await Promise.all([
    buildCutEvents(),
    buildCompetitionEvents(),
  ])
  const events = sortEvents([...cutEvents, ...compEvents])

  const within = (e: CompetitionEvent, n: number) =>
    e.daysToComp != null && e.daysToComp <= n

  return {
    events,
    within7: events.filter((e) => within(e, 7)).length,
    within30: events.filter((e) => within(e, 30)).length,
    weighInsWithin14: events.filter(
      (e) => e.daysToWeighIn != null && e.daysToWeighIn <= 14
    ).length,
    highRisk: events.filter((e) => e.cutRisk === "high").length,
  }
}

export async function getClientCompetitionEvents(
  clientId: string
): Promise<CompetitionEvent[]> {
  const [cutEvents, compEvents] = await Promise.all([
    buildCutEvents(clientId),
    buildCompetitionEvents(clientId),
  ])
  return sortEvents([...cutEvents, ...compEvents])
}
