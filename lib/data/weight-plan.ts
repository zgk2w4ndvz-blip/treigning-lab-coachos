import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { getStoredWeightPlan } from "@/lib/dev-weight-plan-store"
import { getBodyComposition } from "@/lib/data/body-composition"
import { getLowBasePrescription } from "@/lib/data/low-base"
import {
  poundsRemaining,
  weeksRemaining,
  totalWeeks,
  poundsPerWeek,
  dailyCalorieDeficit,
  maintenanceCalories,
  dailyCalorieTarget,
  proteinTargetG,
  planDirection,
  AGGRESSIVE_LB_PER_WEEK,
} from "@/lib/metrics/weight-plan"
import type {
  Competition,
  NutritionPlan,
  WeightLog,
  WeightPlan,
  WeightPlanData,
  WeightPlanNutrition,
  WeightPlanSummary,
  WeightPlanTarget,
} from "@/types/models"

const COACH = "00000000-0000-0000-0000-0000000000c0"

function buildSummary(plan: WeightPlan): WeightPlanSummary {
  const direction = planDirection(plan.current_weight, plan.goal_weight)
  const lbPerWeek = poundsPerWeek(
    plan.current_weight,
    plan.goal_weight,
    plan.start_date,
    plan.target_date
  )
  return {
    poundsRemaining: poundsRemaining(plan.current_weight, plan.goal_weight),
    weeksRemaining: weeksRemaining(plan.target_date),
    totalWeeks: totalWeeks(plan.start_date, plan.target_date),
    poundsPerWeek: lbPerWeek,
    dailyCalorieDeficit: dailyCalorieDeficit(lbPerWeek),
    direction,
    aggressive: lbPerWeek != null && lbPerWeek > AGGRESSIVE_LB_PER_WEEK,
  }
}

function buildNutrition(
  plan: WeightPlan,
  summary: WeightPlanSummary,
  nutritionPlan: NutritionPlan | null,
  bmr: number | null
): WeightPlanNutrition {
  const { calories: maintenance, basis } = maintenanceCalories({
    nutritionCalories: nutritionPlan?.calories ?? null,
    bmr,
  })
  return {
    maintenanceCalories: maintenance,
    dailyCalorieTarget: dailyCalorieTarget(
      maintenance,
      summary.dailyCalorieDeficit,
      summary.direction
    ),
    proteinTargetG: proteinTargetG(plan.goal_weight),
    potassiumTargetMg: null, // no agreed formula — left unset rather than invented
    basis,
  }
}

function assemble(
  plan: WeightPlan | null,
  targets: WeightPlanTarget[],
  bodyLogs: WeightLog[],
  latestWeight: WeightLog | null,
  lowBase: WeightPlanData["lowBase"],
  nutritionPlan: NutritionPlan | null,
  competition: Competition | null
): WeightPlanData {
  const summary = plan ? buildSummary(plan) : null
  const nutrition =
    plan && summary ? buildNutrition(plan, summary, nutritionPlan, latestWeight?.bmr ?? null) : null
  return {
    plan,
    targets,
    summary,
    nutrition,
    latestWeight,
    recentWeights: bodyLogs.slice(-12),
    lowBase,
    nutritionPlan,
    competition,
  }
}

async function bypass(clientId: string): Promise<WeightPlanData> {
  const stored = getStoredWeightPlan(clientId)
  const [bodyComp, lowBase] = await Promise.all([
    getBodyComposition(clientId),
    getLowBasePrescription(clientId),
  ])
  if (!stored) {
    return assemble(null, [], bodyComp.logs, bodyComp.latest, lowBase, null, null)
  }
  const plan: WeightPlan = {
    id: stored.id,
    coach_id: COACH,
    client_id: clientId,
    current_weight: stored.current_weight,
    goal_weight: stored.goal_weight,
    competition_weight: stored.competition_weight,
    start_date: stored.start_date,
    target_date: stored.target_date,
    competition_id: stored.competition_id,
    is_active: true,
    notes: stored.notes,
    created_at: stored.created_at,
    updated_at: stored.updated_at,
  }
  const targets: WeightPlanTarget[] = stored.targets.map((t, i) => ({
    id: `${stored.id}-t${i}`,
    plan_id: stored.id,
    client_id: clientId,
    week_index: t.week_index,
    week_start: t.week_start,
    target_weight: t.target_weight,
    calorie_target: t.calorie_target,
    protein_target_g: t.protein_target_g,
    potassium_target_mg: t.potassium_target_mg,
    created_at: stored.created_at,
  }))
  return assemble(plan, targets, bodyComp.logs, bodyComp.latest, lowBase, null, null)
}

async function real(clientId: string): Promise<WeightPlanData> {
  const supabase = await createServerSupabase()
  const today = new Date().toISOString().slice(0, 10)

  const [{ data: plan }, bodyComp, lowBase, { data: nutritionPlan }] = await Promise.all([
    supabase
      .from("weight_plans")
      .select("*")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getBodyComposition(clientId),
    getLowBasePrescription(clientId),
    supabase
      .from("nutrition_plans")
      .select("*")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (!plan) {
    return assemble(null, [], bodyComp.logs, bodyComp.latest, lowBase, nutritionPlan ?? null, null)
  }

  const [{ data: targets }, competition] = await Promise.all([
    supabase
      .from("weight_plan_targets")
      .select("*")
      .eq("plan_id", plan.id)
      .order("week_index", { ascending: true }),
    (async () => {
      if (plan.competition_id) {
        const { data } = await supabase
          .from("competitions")
          .select("*")
          .eq("id", plan.competition_id)
          .maybeSingle()
        return data ?? null
      }
      const { data } = await supabase
        .from("competitions")
        .select("*")
        .eq("client_id", clientId)
        .gte("competition_date", today)
        .order("competition_date", { ascending: true })
        .limit(1)
        .maybeSingle()
      return data ?? null
    })(),
  ])

  return assemble(
    plan,
    targets ?? [],
    bodyComp.logs,
    bodyComp.latest,
    lowBase,
    nutritionPlan ?? null,
    competition
  )
}

/** Full Weight Plan module data for one client. */
export async function getWeightPlan(clientId: string): Promise<WeightPlanData> {
  return DEV_AUTH_BYPASS ? bypass(clientId) : real(clientId)
}
