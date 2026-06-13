"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireCoach } from "@/lib/auth"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { rosterClientSchema } from "@/lib/validations/roster"
import {
  createRosterClient,
  removeRosterClient,
  updateRosterClient,
} from "@/lib/data/client-repo"
import type { ActionState } from "@/lib/actions/types"

const AFFECTED = [
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
]

function revalidateAll(extra: string[] = []) {
  for (const p of [...AFFECTED, ...extra]) revalidatePath(p)
}

async function ensureCoach() {
  if (!DEV_AUTH_BYPASS) await requireCoach()
}

/**
 * Create or update a client. Persists to Supabase in real mode and to the
 * local roster store in dev bypass — either way the demo data is replaced.
 */
export async function saveClientAction(
  clientId: string | null,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await ensureCoach()
  const parsed = rosterClientSchema.safeParse(
    Object.fromEntries(formData.entries())
  )
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    if (clientId) {
      await updateRosterClient(clientId, parsed.data)
      revalidateAll([`/clients/${clientId}`])
      return { ok: true }
    }
    await createRosterClient(parsed.data)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." }
  }

  revalidateAll()
  redirect("/clients/manage")
}

/** Permanently delete a client. */
export async function deleteClientAction(clientId: string): Promise<ActionState> {
  await ensureCoach()
  try {
    await removeRosterClient(clientId)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed." }
  }
  revalidateAll([`/clients/${clientId}`])
  return { ok: true }
}
