// CoachOS API client for the bridge. Bearer-authed; talks only to the two
// Phase-1 ingest endpoints. The token resolves which coach the batch is for.

export interface Handle {
  clientId: string
  name: string
  phone: string | null
  phoneLast10: string | null
  email: string | null
  status?: string
}

export interface IngestMessage {
  source: "imessage"
  external_id: string
  sender_phone?: string
  sender_email?: string
  body: string
  received_at: string
}

export interface IngestResult {
  ok: boolean
  messageCount?: number
  suggestionCount?: number
  matched?: number
  dryRun?: boolean
  error?: string
}

/** GET the coach's athlete allow-list (phones/emails) — the privacy gate. */
export async function fetchHandles(baseUrl: string, token: string): Promise<Handle[]> {
  const res = await fetch(`${baseUrl}/api/ingest/handles`, {
    headers: { authorization: `Bearer ${token}` },
  })
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; handles?: Handle[]; error?: string }
  if (!res.ok || !json.ok) {
    throw new Error(`handles fetch failed (${res.status}): ${json.error ?? "unknown error"}`)
  }
  return json.handles ?? []
}

/** POST a batch of athlete messages to the ingest pipeline (pending suggestions). */
export async function postIngest(
  baseUrl: string,
  token: string,
  messages: IngestMessage[],
  dryRun: boolean
): Promise<IngestResult> {
  const res = await fetch(`${baseUrl}/api/ingest`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ dryRun, messages }),
  })
  const json = (await res.json().catch(() => ({}))) as IngestResult
  if (!res.ok || !json.ok) {
    throw new Error(`ingest failed (${res.status}): ${json.error ?? JSON.stringify(json)}`)
  }
  return json
}
