import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { ensureImportedBaselines } from "@/lib/dev-roster-store"
import {
  mockHydrationLogs,
  mockNutritionLogs,
  mockNutritionPlan,
  mockRecoveryLogs,
  mockSupplementLogs,
  mockSupplements,
  mockTrainingProgram,
  mockTrainingSessions,
  mockWeightGoal,
  mockWeightLogs,
} from "@/lib/mock/series"
import type {
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

function isoDaysAgo(d: number) {
  return new Date(Date.now() - d * 86_400_000).toISOString()
}
function dateDaysAgo(d: number) {
  return isoDaysAgo(d).slice(0, 10)
}

// ---- WEIGHT ----------------------------------------------------------------

export interface WeightData {
  logs: WeightLog[] // ascending by date
  goal: WeightGoal | null
}

export async function getWeightData(clientId: string, days = 45): Promise<WeightData> {
  if (DEV_AUTH_BYPASS) {
    ensureImportedBaselines()
    return { logs: mockWeightLogs(clientId), goal: mockWeightGoal(clientId) }
  }
  const supabase = await createServerSupabase()
  const [logs, goal] = await Promise.all([
    supabase
      .from("weight_logs")
      .select("*")
      .eq("client_id", clientId)
      .gte("logged_at", isoDaysAgo(days))
      .order("logged_at", { ascending: true }),
    supabase
      .from("weight_goals")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  return { logs: logs.data ?? [], goal: goal.data ?? null }
}

// ---- NUTRITION -------------------------------------------------------------

export interface NutritionData {
  plan: NutritionPlan | null
  logs: NutritionLog[] // ascending by date
}

export async function getNutritionData(clientId: string, days = 30): Promise<NutritionData> {
  if (DEV_AUTH_BYPASS) {
    ensureImportedBaselines()
    return { plan: mockNutritionPlan(clientId), logs: mockNutritionLogs(clientId) }
  }
  const supabase = await createServerSupabase()
  const [plan, logs] = await Promise.all([
    supabase
      .from("nutrition_plans")
      .select("*")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("nutrition_logs")
      .select("*")
      .eq("client_id", clientId)
      .gte("logged_date", dateDaysAgo(days))
      .order("logged_date", { ascending: true }),
  ])
  return { plan: plan.data ?? null, logs: logs.data ?? [] }
}

// ---- HYDRATION -------------------------------------------------------------

export async function getHydrationData(clientId: string, days = 21): Promise<HydrationLog[]> {
  if (DEV_AUTH_BYPASS) { ensureImportedBaselines(); return mockHydrationLogs(clientId) }
  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from("hydration_logs")
    .select("*")
    .eq("client_id", clientId)
    .gte("logged_date", dateDaysAgo(days))
    .order("logged_date", { ascending: true })
  return data ?? []
}

// ---- SUPPLEMENTS -----------------------------------------------------------

export interface SupplementData {
  supplements: Supplement[]
  logs: SupplementLog[]
}

export async function getSupplementData(clientId: string, days = 14): Promise<SupplementData> {
  if (DEV_AUTH_BYPASS) {
    ensureImportedBaselines()
    return { supplements: mockSupplements(clientId), logs: mockSupplementLogs(clientId) }
  }
  const supabase = await createServerSupabase()
  const [supplements, logs] = await Promise.all([
    supabase
      .from("supplements")
      .select("*")
      .eq("client_id", clientId)
      .order("is_active", { ascending: false })
      .order("name", { ascending: true }),
    supabase
      .from("supplement_logs")
      .select("*")
      .eq("client_id", clientId)
      .gte("logged_at", isoDaysAgo(days)),
  ])
  return { supplements: supplements.data ?? [], logs: logs.data ?? [] }
}

// ---- RECOVERY --------------------------------------------------------------

export async function getRecoveryData(clientId: string, days = 21): Promise<RecoveryLog[]> {
  if (DEV_AUTH_BYPASS) { ensureImportedBaselines(); return mockRecoveryLogs(clientId) }
  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from("recovery_logs")
    .select("*")
    .eq("client_id", clientId)
    .gte("logged_date", dateDaysAgo(days))
    .order("logged_date", { ascending: true })
  return data ?? []
}

// ---- TRAINING --------------------------------------------------------------

export interface TrainingData {
  program: TrainingProgram | null
  sessions: TrainingSession[] // ascending by scheduled_at
}

export async function getTrainingData(clientId: string, days = 28): Promise<TrainingData> {
  if (DEV_AUTH_BYPASS) {
    ensureImportedBaselines()
    return { program: mockTrainingProgram(clientId), sessions: mockTrainingSessions(clientId) }
  }
  const supabase = await createServerSupabase()
  const [program, sessions] = await Promise.all([
    supabase
      .from("training_programs")
      .select("*")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("training_sessions")
      .select("*")
      .eq("client_id", clientId)
      .gte("scheduled_at", isoDaysAgo(days))
      .order("scheduled_at", { ascending: true }),
  ])
  return { program: program.data ?? null, sessions: sessions.data ?? [] }
}
