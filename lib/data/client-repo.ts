import "server-only"

import { requireCoach } from "@/lib/auth"
import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import {
  addImportedAthlete,
  getImportedAthleteById,
  readImportedAthletes,
  removeImportedAthlete,
  updateImportedAthlete,
  writeImportedAthletes,
} from "@/lib/dev-roster-store"
import type { Client, ImportedAthlete } from "@/types/models"
import type { InsertDto } from "@/types/database"

/** Admin input for a client (the roster/CSV shape, without an id). */
export type RosterClientInput = Omit<ImportedAthlete, "id">

// ---- mapping ---------------------------------------------------------------

function rowToAthlete(row: Client): ImportedAthlete {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    sport: row.sport,
    weightClass: row.current_weight_class,
    currentWeight: row.current_weight,
    goalWeight: row.goal_weight,
    nextCompetition: row.next_competition,
    competitionDate: row.competition_date,
    coachNotes: row.notes,
  }
}

function inputToInsert(
  input: RosterClientInput,
  coachId: string
): InsertDto<"clients"> {
  return {
    coach_id: coachId,
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email,
    phone: input.phone,
    sport: input.sport,
    current_weight_class: input.weightClass,
    current_weight: input.currentWeight,
    goal_weight: input.goalWeight,
    next_competition: input.nextCompetition,
    competition_date: input.competitionDate,
    notes: input.coachNotes,
    status: "active",
  }
}

function slugId(input: RosterClientInput, existing: Set<string>): string {
  const base =
    `${input.firstName}-${input.lastName}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "athlete"
  let id = `imp-${base}`
  let n = 2
  while (existing.has(id)) id = `imp-${base}-${n++}`
  return id
}

// ---- repository ------------------------------------------------------------

export async function listRosterClients(): Promise<ImportedAthlete[]> {
  if (DEV_AUTH_BYPASS) return readImportedAthletes() ?? []

  // RLS scopes rows to the current coach; the explicit coach_id filter is
  // belt-and-suspenders and documents intent.
  const coach = await requireCoach()
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("coach_id", coach.id)
    .neq("status", "archived")
    .order("first_name", { ascending: true })
  // This read runs during page render (roster + import status card). Degrade
  // gracefully instead of crashing the page; the import *action* is what
  // surfaces write errors loudly to the user.
  if (error) {
    console.error("listRosterClients: clients read failed —", error.message)
    return []
  }
  return (data ?? []).map(rowToAthlete)
}

export async function getRosterClient(id: string): Promise<ImportedAthlete | null> {
  if (DEV_AUTH_BYPASS) return getImportedAthleteById(id)

  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  return data ? rowToAthlete(data) : null
}

export async function createRosterClient(
  input: RosterClientInput
): Promise<{ id: string }> {
  if (DEV_AUTH_BYPASS) {
    const existing = new Set((readImportedAthletes() ?? []).map((a) => a.id))
    const id = slugId(input, existing)
    addImportedAthlete({ ...input, id })
    return { id }
  }

  const coach = await requireCoach()
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("clients")
    .insert(inputToInsert(input, coach.id))
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return { id: data.id }
}

export async function updateRosterClient(
  id: string,
  input: RosterClientInput
): Promise<void> {
  if (DEV_AUTH_BYPASS) {
    updateImportedAthlete(id, input)
    return
  }

  const supabase = await createServerSupabase()
  const { error } = await supabase
    .from("clients")
    .update({
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone,
      sport: input.sport,
      current_weight_class: input.weightClass,
      current_weight: input.currentWeight,
      goal_weight: input.goalWeight,
      next_competition: input.nextCompetition,
      competition_date: input.competitionDate,
      notes: input.coachNotes,
    })
    .eq("id", id)
  if (error) throw new Error(error.message)
}

export async function removeRosterClient(id: string): Promise<void> {
  if (DEV_AUTH_BYPASS) {
    removeImportedAthlete(id)
    return
  }

  const supabase = await createServerSupabase()
  const { error } = await supabase.from("clients").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

/** Bulk import. Bypass replaces the roster; real appends rows. */
export async function importRosterClients(
  athletes: ImportedAthlete[]
): Promise<number> {
  if (DEV_AUTH_BYPASS) {
    writeImportedAthletes(athletes)
    return athletes.length
  }

  // User-facing write goes through RLS (same path as createRosterClient). The
  // insert's WITH CHECK (coach_id = current_profile_id()) must pass, so a token
  // misconfiguration surfaces as a real error here instead of being hidden by
  // the service-role client.
  const coach = await requireCoach()
  const supabase = await createServerSupabase()
  const rows = athletes.map((a) => inputToInsert({ ...a }, coach.id))
  const { data, error } = await supabase.from("clients").insert(rows).select("id")
  if (error) throw new Error(error.message)
  return data?.length ?? 0
}
