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

export interface ImportOutcome {
  inserted: number
  updated: number
}

/** Normalized name dedupe key: "first|last" lower-cased + trimmed. */
function nameKey(first: string, last: string): string {
  return `${first.trim().toLowerCase()}|${last.trim().toLowerCase()}`
}

/**
 * Bulk import — IDEMPOTENT. Bypass replaces the local roster. Real mode matches
 * each athlete against the coach's existing clients by (coach_id, email) first,
 * then (coach_id, normalized first+last name), and UPDATES the match instead of
 * inserting a duplicate. New athletes are inserted. In-batch dedupe too, so the
 * same person appearing twice in one CSV doesn't create a duplicate.
 */
export async function importRosterClients(
  athletes: ImportedAthlete[]
): Promise<ImportOutcome> {
  if (DEV_AUTH_BYPASS) {
    writeImportedAthletes(athletes)
    return { inserted: athletes.length, updated: 0 }
  }

  // RLS-scoped (same path as createRosterClient) so a token misconfiguration
  // surfaces as a real error rather than being hidden by the service-role client.
  const coach = await requireCoach()
  const supabase = await createServerSupabase()

  const { data: existing, error: readErr } = await supabase
    .from("clients")
    .select("id, email, first_name, last_name")
    .eq("coach_id", coach.id)
  if (readErr) throw new Error(readErr.message)

  const byEmail = new Map<string, string>()
  const byName = new Map<string, string>()
  for (const c of existing ?? []) {
    if (c.email) byEmail.set(c.email.toLowerCase(), c.id)
    byName.set(nameKey(c.first_name, c.last_name), c.id)
  }

  let inserted = 0
  let updated = 0
  for (const a of athletes) {
    const email = a.email ? a.email.toLowerCase() : null
    const nk = nameKey(a.firstName, a.lastName)
    const matchId = (email && byEmail.get(email)) || byName.get(nk) || null

    // Roster fields only — never reassign coach_id, and don't reset status.
    const fields = {
      first_name: a.firstName,
      last_name: a.lastName,
      email: a.email,
      phone: a.phone,
      sport: a.sport,
      current_weight_class: a.weightClass,
      current_weight: a.currentWeight,
      goal_weight: a.goalWeight,
      next_competition: a.nextCompetition,
      competition_date: a.competitionDate,
      notes: a.coachNotes,
    }

    if (matchId) {
      const { error } = await supabase
        .from("clients")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", matchId)
      if (error) throw new Error(error.message)
      updated++
    } else {
      const { data, error } = await supabase
        .from("clients")
        .insert(inputToInsert(a, coach.id))
        .select("id")
        .single()
      if (error) throw new Error(error.message)
      inserted++
      if (email) byEmail.set(email, data.id)
      byName.set(nk, data.id) // so a duplicate later in the same CSV updates
    }
  }

  return { inserted, updated }
}
