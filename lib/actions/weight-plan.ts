"use server"

import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"

import { requireCoach } from "@/lib/auth"
import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { getBodyComposition } from "@/lib/data/body-composition"
import {
  getStoredWeightPlan,
  setStoredWeightPlan,
  deleteStoredWeightPlan,
} from "@/lib/dev-weight-plan-store"
import { weightPlanSchema, type WeightPlanInput } from "@/lib/validations/weight-plan"
import {
  buildProjection,
  dailyCalorieDeficit,
  dailyCalorieTarget,
  maintenanceCalories,
  planDirection,
  poundsPerWeek,
  proteinTargetG,
  type ProjectionPoint,
} from "@/lib/metrics/weight-plan"
import type { ActionState } from "@/lib/actions/types"

function revalidate(clientId: string) {
  revalidatePath(`/clients/${clientId}/weight-plan`)
  revalidatePath(`/clients/${clientId}`)
}

/** Compute the materialized weekly projection for a plan + maintenance inputs. */
function projectionFor(
  d: WeightPlanInput,
  opts: { nutritionCalories: number | null; bmr: number | null }
): ProjectionPoint[] {
  const direction = planDirection(d.current_weight, d.goal_weight)
  const lbWk = poundsPerWeek(d.current_weight, d.goal_weight, d.start_date, d.target_date)
  const deficit = dailyCalorieDeficit(lbWk)
  const { calories: maintenance } = maintenanceCalories(opts)
  const calorieTarget = dailyCalorieTarget(maintenance, deficit, direction)
  return buildProjection(d, {
    dailyCalorieTarget: calorieTarget,
    proteinTargetG: proteinTargetG(d.goal_weight),
  })
}

/** Create or update the athlete's active weight plan + regenerate its targets. */
export async function saveWeightPlanAction(
  clientId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = weightPlanSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }
  const d = parsed.data

  try {
    if (DEV_AUTH_BYPASS) {
      const bmr = (await getBodyComposition(clientId)).latest?.bmr ?? null
      const projection = projectionFor(d, { nutritionCalories: null, bmr })
      const now = new Date().toISOString()
      const prev = getStoredWeightPlan(clientId)
      setStoredWeightPlan(clientId, {
        id: prev?.id ?? randomUUID(),
        current_weight: d.current_weight,
        goal_weight: d.goal_weight,
        competition_weight: d.competition_weight,
        start_date: d.start_date,
        target_date: d.target_date,
        competition_id: d.competition_id,
        notes: d.notes,
        created_at: prev?.created_at ?? now,
        updated_at: now,
        targets: projection,
      })
    } else {
      const coach = await requireCoach()
      const supabase = await createServerSupabase()

      const [{ data: np }, { data: wl }] = await Promise.all([
        supabase
          .from("nutrition_plans")
          .select("calories")
          .eq("client_id", clientId)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("weight_logs")
          .select("bmr")
          .eq("client_id", clientId)
          .order("logged_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      const projection = projectionFor(d, {
        nutritionCalories: np?.calories ?? null,
        bmr: wl?.bmr ?? null,
      })

      const fields = {
        current_weight: d.current_weight,
        goal_weight: d.goal_weight,
        competition_weight: d.competition_weight,
        start_date: d.start_date,
        target_date: d.target_date,
        competition_id: d.competition_id,
        notes: d.notes,
      }

      const { data: existing } = await supabase
        .from("weight_plans")
        .select("id")
        .eq("client_id", clientId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      let planId: string
      if (existing) {
        planId = existing.id
        const { error } = await supabase
          .from("weight_plans")
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq("id", planId)
        if (error) return { ok: false, error: error.message }
      } else {
        const { data: ins, error } = await supabase
          .from("weight_plans")
          .insert({ coach_id: coach.id, client_id: clientId, ...fields })
          .select("id")
          .single()
        if (error || !ins) return { ok: false, error: error?.message ?? "Save failed." }
        planId = ins.id
      }

      // Regenerate the materialized targets for this plan.
      await supabase.from("weight_plan_targets").delete().eq("plan_id", planId)
      if (projection.length > 0) {
        const { error } = await supabase.from("weight_plan_targets").insert(
          projection.map((p) => ({
            plan_id: planId,
            client_id: clientId,
            week_index: p.week_index,
            week_start: p.week_start,
            target_weight: p.target_weight,
            calorie_target: p.calorie_target,
            protein_target_g: p.protein_target_g,
            potassium_target_mg: p.potassium_target_mg,
          }))
        )
        if (error) return { ok: false, error: error.message }
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." }
  }

  revalidate(clientId)
  return { ok: true }
}

/** Delete the athlete's active weight plan (targets cascade). */
export async function deleteWeightPlanAction(
  clientId: string,
  planId: string
): Promise<ActionState> {
  try {
    if (DEV_AUTH_BYPASS) {
      const ok = deleteStoredWeightPlan(clientId)
      if (!ok) return { ok: false, error: "No plan to delete." }
    } else {
      await requireCoach()
      const supabase = await createServerSupabase()
      const { error } = await supabase
        .from("weight_plans")
        .delete()
        .eq("id", planId)
        .eq("client_id", clientId)
      if (error) return { ok: false, error: error.message }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed." }
  }
  revalidate(clientId)
  return { ok: true }
}
