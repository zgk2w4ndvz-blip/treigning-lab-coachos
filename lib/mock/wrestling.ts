// ============================================================================
// Wrestling mock data — clients + active weight cuts derived from WRESTLERS.
// Feeds the Wrestling Command Center, combat board, and per-client combat tab
// when running in dev bypass.
// ============================================================================

import {
  computeReadiness,
  generateRefuelProtocol,
  generateRehydrationProtocol,
  generateWaterLoadPlan,
  rehydrationWindowHours,
} from "@/lib/combat/protocols"
import { WRESTLERS, type WrestlerSpec } from "@/lib/mock/series"
import type {
  Client,
  CombatCutDetail,
  CombatCutListItem,
  ReadinessScore,
  WeighIn,
  WeightCut,
} from "@/types/models"

const COACH = "00000000-0000-0000-0000-0000000000c0"

function atTime(daysFromNow: number, hour: number): string {
  const d = new Date(Date.now() + daysFromNow * 86_400_000)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function wrestlerClient(w: WrestlerSpec): Client {
  return {
    id: w.id,
    coach_id: COACH,
    profile_id: null,
    first_name: w.first,
    last_name: w.last,
    email: `${w.first.toLowerCase()}.${w.last.toLowerCase()}@example.com`,
    phone: null,
    date_of_birth: null,
    gender: "male",
    sport: "Wrestling",
    discipline: "Folkstyle",
    current_weight_class: `${w.className}`,
    goal_summary: `Make ${w.className} for the next dual.`,
    status: "active",
    start_date: null,
    avatar_url: null,
    emergency_contact: null,
    notes: "DEMO_SEED",
    current_weight: w.current,
    goal_weight: w.classLimit,
    next_competition: "Upcoming meet",
    competition_date: null,
    created_at: new Date(Date.now() - 120 * 86_400_000).toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function wrestlerCut(w: WrestlerSpec): WeightCut {
  const weighInAt = atTime(w.weighInDays, 8)
  const competitionAt = atTime(w.compDays, 17)
  const windowHours = rehydrationWindowHours(weighInAt, competitionAt)
  return {
    id: `cut-${w.id}`,
    client_id: w.id,
    coach_id: COACH,
    competition_id: null,
    weight_class_id: null,
    discipline: "wrestling",
    class_name: w.className,
    class_limit_lbs: w.classLimit,
    walk_around_lbs: Math.round(w.current + w.lossRate * 14),
    camp_start_lbs: Math.round(w.current + w.lossRate * 7),
    target_weigh_in_lbs: w.classLimit,
    weigh_in_at: weighInAt,
    competition_at: competitionAt,
    rehydration_window_hours: windowHours,
    cut_method: "Sweat + water manipulation",
    status: w.weighInDays <= 3 ? "peak_week" : "active",
    made_weight: null,
    notes: null,
    created_at: new Date(Date.now() - 21 * 86_400_000).toISOString(),
    updated_at: new Date().toISOString(),
    water_load_plan: generateWaterLoadPlan(),
    hydration_restoration: generateRehydrationProtocol(windowHours),
    refuel_protocol: generateRefuelProtocol(windowHours),
  }
}

function wrestlerReadiness(w: WrestlerSpec): ReadinessScore {
  return computeReadiness({
    currentLbs: w.current,
    targetLbs: w.classLimit,
    weighInAt: atTime(w.weighInDays, 8),
    hydrationLogs7d: 7,
    recoveryLogs7d: 7,
    avgSleepHours: 6.6,
    trainingCompleted14d: 8,
  })
}

function wrestlerWeighIns(w: WrestlerSpec): WeighIn[] {
  return [
    {
      id: `wi-${w.id}-a`,
      weight_cut_id: `cut-${w.id}`,
      client_id: w.id,
      kind: "check_in",
      scheduled_at: new Date(Date.now() - 4 * 86_400_000).toISOString(),
      target_lbs: w.classLimit,
      weight_lbs: Math.round((w.current + w.lossRate * 4) * 10) / 10,
      made_weight: false,
      recorded_at: new Date(Date.now() - 4 * 86_400_000).toISOString(),
      notes: null,
      created_at: new Date(Date.now() - 4 * 86_400_000).toISOString(),
    },
    {
      id: `wi-${w.id}-b`,
      weight_cut_id: `cut-${w.id}`,
      client_id: w.id,
      kind: "check_in",
      scheduled_at: new Date(Date.now() - 1 * 86_400_000).toISOString(),
      target_lbs: w.classLimit,
      weight_lbs: Math.round((w.current + w.lossRate) * 10) / 10,
      made_weight: false,
      recorded_at: new Date(Date.now() - 1 * 86_400_000).toISOString(),
      notes: null,
      created_at: new Date(Date.now() - 1 * 86_400_000).toISOString(),
    },
    {
      id: `wi-${w.id}-off`,
      weight_cut_id: `cut-${w.id}`,
      client_id: w.id,
      kind: "official",
      scheduled_at: atTime(w.weighInDays, 8),
      target_lbs: w.classLimit,
      weight_lbs: null,
      made_weight: null,
      recorded_at: null,
      notes: "Official weigh-in",
      created_at: new Date(Date.now() - 21 * 86_400_000).toISOString(),
    },
  ]
}

export const mockWrestlers: Client[] = WRESTLERS.map(wrestlerClient)

export const mockWrestlingCuts: WeightCut[] = WRESTLERS.map(wrestlerCut)

export const mockWrestlingBoard: CombatCutListItem[] = WRESTLERS.map((w) => {
  const client = wrestlerClient(w)
  return {
    cut: wrestlerCut(w),
    client: {
      id: client.id,
      first_name: client.first_name,
      last_name: client.last_name,
      avatar_url: client.avatar_url,
      sport: client.sport,
    },
    latestWeightLbs: w.current,
    readiness: wrestlerReadiness(w),
    nextWeighIn: wrestlerWeighIns(w).find((x) => x.kind === "official") ?? null,
  }
})

const detailById = new Map<string, CombatCutDetail>(
  WRESTLERS.map((w) => [
    w.id,
    {
      cut: wrestlerCut(w),
      weighIns: wrestlerWeighIns(w),
      latestWeightLbs: w.current,
      readiness: wrestlerReadiness(w),
      weightClass: null,
    },
  ])
)

export function getMockWrestlingDetail(clientId: string): CombatCutDetail | null {
  return detailById.get(clientId) ?? null
}
