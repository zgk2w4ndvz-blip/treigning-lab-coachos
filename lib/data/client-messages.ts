import "server-only"

import { createServerSupabase } from "@/lib/supabase/server"
import { DEV_AUTH_BYPASS } from "@/lib/dev"
import type { MessageIngest } from "@/types/models"

/** Effective timestamp for ordering: the message time, else when it was ingested. */
function ts(m: MessageIngest): string {
  return m.received_at ?? m.created_at
}

/**
 * All ingested messages for one athlete (both directions), oldest → newest, so
 * the tab reads like a conversation. Read-only; sourced from message_ingest.
 */
export async function getClientMessages(clientId: string): Promise<MessageIngest[]> {
  if (DEV_AUTH_BYPASS) return []

  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from("message_ingest")
    .select("*")
    .eq("client_id", clientId)
  return (data ?? []).sort((a, b) => ts(a).localeCompare(ts(b)))
}
