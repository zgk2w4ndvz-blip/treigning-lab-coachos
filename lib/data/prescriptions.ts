import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { getStoredPrescriptions, type StoredPrescription } from "@/lib/dev-prescription-store"
import type { Prescription, SuggestionDomain } from "@/types/models"

const COACH = "00000000-0000-0000-0000-0000000000c0"

/** A couple of seeded prescriptions so the tab isn't empty for demo athletes. */
function mockSeed(clientId: string): StoredPrescription[] {
  const seed: Record<string, StoredPrescription[]> = {
    "c-jordan": [
      {
        id: `rx-seed-${clientId}-1`,
        domain: "hydration",
        title: "Hydration question / adjustment",
        protocol: "Add 16oz + 500mg sodium pre-session; reassess cramping in 1 week.",
        status: "active",
        createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      },
    ],
  }
  return seed[clientId] ?? []
}

function toPrescription(clientId: string, p: StoredPrescription): Prescription {
  return {
    id: p.id,
    coach_id: COACH,
    client_id: clientId,
    domain: p.domain as SuggestionDomain,
    title: p.title,
    protocol: p.protocol,
    details: null,
    source_suggestion_id: null,
    status: p.status,
    starts_on: null,
    ends_on: null,
    created_at: p.createdAt,
    updated_at: p.createdAt,
  }
}

/** Prescriptions for one athlete, newest first. */
export async function getPrescriptions(clientId: string): Promise<Prescription[]> {
  if (DEV_AUTH_BYPASS) {
    const all = [...getStoredPrescriptions(clientId), ...mockSeed(clientId)]
    return all
      .map((p) => toPrescription(clientId, p))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }

  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from("prescriptions")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
  return data ?? []
}
