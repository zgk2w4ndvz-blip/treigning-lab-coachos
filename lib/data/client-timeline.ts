import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { getBypassSnapshot } from "@/lib/dev-roster-store"
import { buildTimeline, type TimelineInput, type TimelineResult } from "@/lib/timeline/build"

/**
 * Athlete-Story timeline: pulls recent series from the EXISTING per-domain
 * tables and hands them to the pure assembler (lib/timeline/build.ts). Read-only,
 * coach-scoped by RLS. Does NOT read the Observation Store. In dev bypass it
 * builds a minimal input from the mock snapshot so the page still renders.
 */
export async function getClientTimeline(clientId: string): Promise<TimelineResult> {
  if (DEV_AUTH_BYPASS) {
    const snap = getBypassSnapshot(clientId)
    if (!snap) return { events: [], trends: [] }
    const input: TimelineInput = {
      weights: snap.latestWeight ? [snap.latestWeight] : [],
      recoveries: snap.latestRecovery ? [snap.latestRecovery] : [],
      competitions: snap.nextCompetition
        ? [{ id: snap.nextCompetition.id, name: snap.nextCompetition.name, competition_date: snap.nextCompetition.competition_date }]
        : [],
      alerts: (snap.openAlerts ?? []).map((a) => ({
        id: a.id, title: a.title, detail: a.detail, severity: a.severity, created_at: a.created_at,
      })),
      notes: snap.client.notes ? [{ id: `cn-${snap.client.id}`, text: snap.client.notes, at: snap.client.updated_at }] : [],
    }
    return buildTimeline(input)
  }

  const supabase = await createServerSupabase()

  const [weights, recoveries, nutrition, training, competitions, alerts, messages, client] = await Promise.all([
    supabase.from("weight_logs").select("id, weight_lbs, logged_at, body_fat_pct, skeletal_muscle_mass_lbs").eq("client_id", clientId).order("logged_at", { ascending: false }).limit(30),
    supabase.from("recovery_logs").select("id, logged_date, sleep_hours, energy, soreness, recovery_score").eq("client_id", clientId).order("logged_date", { ascending: false }).limit(21),
    supabase.from("nutrition_logs").select("id, logged_date, calories, protein_g").eq("client_id", clientId).order("logged_date", { ascending: false }).limit(21),
    supabase.from("training_sessions").select("id, scheduled_at, completed_at, session_type, duration_min, rpe").eq("client_id", clientId).order("scheduled_at", { ascending: false }).limit(15),
    supabase.from("competitions").select("id, name, competition_date").eq("client_id", clientId).order("competition_date", { ascending: false }).limit(8),
    supabase.from("alerts").select("id, title, detail, severity, created_at, status").eq("client_id", clientId).eq("status", "active").order("created_at", { ascending: false }).limit(10),
    supabase.from("message_ingest").select("id, body, source, received_at, created_at, direction").eq("client_id", clientId).order("received_at", { ascending: false }).limit(12),
    supabase.from("clients").select("id, notes, updated_at").eq("id", clientId).maybeSingle(),
  ])

  const notes =
    client.data?.notes && client.data.notes.trim()
      ? [{ id: `cn-${client.data.id}`, text: client.data.notes, at: client.data.updated_at }]
      : []

  return buildTimeline({
    weights: weights.data ?? [],
    recoveries: recoveries.data ?? [],
    nutrition: nutrition.data ?? [],
    training: training.data ?? [],
    competitions: competitions.data ?? [],
    alerts: (alerts.data ?? []).map((a) => ({ id: a.id, title: a.title, detail: a.detail, severity: a.severity, created_at: a.created_at })),
    messages: messages.data ?? [],
    notes,
  })
}
