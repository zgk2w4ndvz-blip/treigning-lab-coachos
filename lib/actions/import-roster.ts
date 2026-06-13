"use server"

import { revalidatePath } from "next/cache"

import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { parseRosterCsv } from "@/lib/import/csv"
import { importRosterClients } from "@/lib/data/client-repo"
import {
  clearImportedAthletes,
  writeImportedAthletes,
} from "@/lib/dev-roster-store"
import type { ImportedAthlete } from "@/types/models"

const AFFECTED_PATHS = [
  "/clients",
  "/clients/manage",
  "/dashboard",
  "/agenda",
  "/tasks",
  "/calendar",
  "/competitions",
  "/combat",
  "/wrestling",
  "/alerts",
  "/settings/import",
]

export interface ImportResult {
  ok: boolean
  count?: number
  error?: string
  rowErrors?: string[]
  /** True when a Supabase failure caused a fall back to local dev storage. */
  fellBackToLocal?: boolean
  /** Where the rows were actually written (for the debug panel). */
  savedTo?: "local" | "supabase"
  /** The raw Supabase/Clerk error, surfaced even when we fell back. */
  supabaseError?: string
  /** True iff DEV_AUTH_BYPASS was active for this request. */
  bypass?: boolean
}

function revalidate() {
  for (const p of AFFECTED_PATHS) revalidatePath(p)
}

/** Save straight to the local dev roster store (never touches the network). */
function saveLocal(athletes: ImportedAthlete[]): ImportResult {
  writeImportedAthletes(athletes)
  revalidate()
  return { ok: true, count: athletes.length, savedTo: "local" }
}

/**
 * Parse the pasted/uploaded CSV and save it to client storage. This action
 * never throws — every failure returns a friendly `ImportResult`.
 *
 * - Dev bypass → local roster store (`.dev-data/roster.json`).
 * - Real mode  → Supabase `clients` rows; if Supabase/Clerk is unavailable
 *   (e.g. a failed fetch), it falls back to local storage so the import never
 *   crashes the page.
 */
export async function importRosterAction(csvText: string): Promise<ImportResult> {
  let athletes: ImportedAthlete[]
  let errors: string[]
  try {
    ;({ athletes, errors } = parseRosterCsv(csvText ?? ""))
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? `Could not read CSV: ${e.message}` : "Could not read CSV.",
    }
  }
  if (athletes.length === 0) {
    return { ok: false, error: errors[0] ?? "No valid athlete rows found." }
  }

  // Dev bypass: local storage only, no network.
  if (DEV_AUTH_BYPASS) {
    try {
      return { ...saveLocal(athletes), rowErrors: errors, bypass: true }
    } catch (e) {
      return {
        ok: false,
        bypass: true,
        savedTo: "local",
        error: e instanceof Error ? e.message : "Could not save roster locally.",
      }
    }
  }

  // Real mode: try Supabase, then fall back to local storage on any failure.
  try {
    const count = await importRosterClients(athletes)
    revalidate()
    return { ok: true, count, rowErrors: errors, savedTo: "supabase", bypass: false }
  } catch (e) {
    const supabaseError = e instanceof Error ? e.message : String(e)
    try {
      return {
        ...saveLocal(athletes),
        rowErrors: errors,
        fellBackToLocal: true,
        supabaseError,
        bypass: false,
      }
    } catch (e2) {
      return {
        ok: false,
        bypass: false,
        error: e2 instanceof Error ? e2.message : "Import failed.",
        supabaseError,
      }
    }
  }
}

/** Remove the imported roster and restore the demo athletes (dev bypass only). */
export async function clearRosterAction(): Promise<ImportResult> {
  if (!DEV_AUTH_BYPASS) {
    return {
      ok: false,
      error:
        "Restoring demo data is a dev-bypass action. In production, delete clients individually.",
    }
  }
  clearImportedAthletes()
  revalidate()
  return { ok: true }
}
