import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import { getStoredLowBase } from "@/lib/dev-low-base-store"
import type { LowBasePrescription } from "@/types/models"

const DEV_COACH = "00000000-0000-0000-0000-0000000000c0"

/** The athlete's current Low Base prescription, or null if none set. */
export async function getLowBasePrescription(
  clientId: string
): Promise<LowBasePrescription | null> {
  if (DEV_AUTH_BYPASS) {
    const s = getStoredLowBase(clientId)
    if (!s) return null
    return {
      id: `lb-${clientId}`,
      coach_id: DEV_COACH,
      client_id: clientId,
      mep_bpm: s.mep_bpm,
      frequency_per_week: s.frequency_per_week,
      minutes_per_session: s.minutes_per_session,
      notes: s.notes,
      start_date: s.start_date ?? null,
      end_date: s.end_date ?? null,
      schedule: (s.schedule ?? []) as unknown as LowBasePrescription["schedule"],
      created_at: s.created_at,
      updated_at: s.updated_at,
    }
  }

  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from("low_base_prescriptions")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle()
  return data ?? null
}

/** Low Base range = MEP ± 10 bpm. Pure (client-safe). */
export function lowBaseRange(mepBpm: number): { low: number; high: number } {
  return { low: mepBpm - 10, high: mepBpm + 10 }
}

/** Total weekly minutes = frequency × session minutes. Pure. */
export function weeklyMinutes(frequencyPerWeek: number, minutesPerSession: number): number {
  return frequencyPerWeek * minutesPerSession
}
