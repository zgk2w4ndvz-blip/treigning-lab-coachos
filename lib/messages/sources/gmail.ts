// ============================================================================
// Gmail source adapter — fetch a coach's recent emails and normalize them into
// ParsedMessage[] for the shared ingest pipeline.
//
// Auth (server-side, never in code — see .env.local):
//   • GMAIL_ACCESS_TOKEN                              (short-lived; quickest), or
//   • GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET + GMAIL_REFRESH_TOKEN
//     (preferred: exchanged for an access token on each run)
//   • GMAIL_QUERY  (optional Gmail search, default "newer_than:7d -in:chats")
//
// The normalizer (gmailToParsedMessage) is pure and unit-testable; the network
// calls are isolated in fetchGmailMessages.
// ============================================================================

import type { ParsedMessage } from "@/lib/messages/parse"

// ---- minimal Gmail API shapes ----------------------------------------------

interface GmailHeader {
  name: string
  value: string
}
interface GmailPart {
  mimeType?: string
  body?: { data?: string; size?: number }
  parts?: GmailPart[]
}
export interface GmailMessage {
  id: string
  threadId?: string
  snippet?: string
  internalDate?: string // ms epoch as string
  payload?: GmailPart & { headers?: GmailHeader[] }
}

// ---- pure normalizer -------------------------------------------------------

function header(headers: GmailHeader[] | undefined, name: string): string | null {
  const h = headers?.find((x) => x.name.toLowerCase() === name.toLowerCase())
  return h?.value ?? null
}

/** Parse a `From:` header into a display name + email. */
export function parseFrom(value: string | null): { name: string | null; email: string | null } {
  if (!value) return { name: null, email: null }
  const m = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  if (m) return { name: m[1].trim() || null, email: m[2].trim().toLowerCase() }
  if (/^[^@\s]+@[^@\s]+$/.test(value.trim())) return { name: null, email: value.trim().toLowerCase() }
  return { name: value.trim() || null, email: null }
}

function decodeBase64Url(data: string): string {
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/")
  try {
    return Buffer.from(b64, "base64").toString("utf8")
  } catch {
    return ""
  }
}

/** Depth-first: prefer the first text/plain part; fall back to snippet. */
function extractBody(part: GmailPart | undefined): string {
  if (!part) return ""
  if (part.mimeType === "text/plain" && part.body?.data) return decodeBase64Url(part.body.data)
  for (const child of part.parts ?? []) {
    const body = extractBody(child)
    if (body) return body
  }
  return ""
}

/** Strip quoted replies / signatures to a concise snippet. */
function cleanBody(raw: string, fallback: string): string {
  const text = (raw || fallback || "").replace(/\r\n/g, "\n")
  // Drop everything from a quoted-reply marker onward.
  const cut = text.search(/\n>|\nOn .+ wrote:|\n-{2,}\n|\n_{2,}\n/)
  const head = (cut > 0 ? text.slice(0, cut) : text).trim()
  return head.length ? head : fallback.trim()
}

/** Gmail API message → normalized ParsedMessage. */
export function gmailToParsedMessage(msg: GmailMessage): ParsedMessage | null {
  const headers = msg.payload?.headers
  const from = parseFrom(header(headers, "From"))
  const body = cleanBody(extractBody(msg.payload), msg.snippet ?? "")
  if (!body) return null
  const dateHeader = header(headers, "Date")
  const receivedAt =
    msg.internalDate && !Number.isNaN(Number(msg.internalDate))
      ? new Date(Number(msg.internalDate)).toISOString()
      : dateHeader && !Number.isNaN(Date.parse(dateHeader))
        ? new Date(dateHeader).toISOString()
        : null
  return {
    source: "gmail",
    externalId: msg.id,
    senderName: from.name,
    senderPhone: null,
    senderEmail: from.email,
    body,
    receivedAt,
  }
}

// ---- network ---------------------------------------------------------------

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me/messages"

/** Resolve an access token from env (direct token or refresh-token exchange). */
async function resolveAccessToken(): Promise<string> {
  const direct = process.env.GMAIL_ACCESS_TOKEN
  if (direct) return direct

  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Gmail not configured. Set GMAIL_ACCESS_TOKEN, or GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET + GMAIL_REFRESH_TOKEN."
    )
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: refreshToken, grant_type: "refresh_token",
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`)
  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) throw new Error("Token exchange returned no access_token.")
  return json.access_token
}

/** Fetch recent Gmail messages → normalized ParsedMessage[]. */
export async function fetchGmailMessages(opts?: {
  query?: string
  maxResults?: number
}): Promise<ParsedMessage[]> {
  const token = await resolveAccessToken()
  const query = opts?.query ?? process.env.GMAIL_QUERY ?? "newer_than:7d -in:chats"
  const maxResults = Math.min(opts?.maxResults ?? 25, 100)
  const auth = { Authorization: `Bearer ${token}` }

  const listRes = await fetch(`${GMAIL_API}?q=${encodeURIComponent(query)}&maxResults=${maxResults}`, { headers: auth })
  if (!listRes.ok) throw new Error(`Gmail list failed (${listRes.status}): ${await listRes.text()}`)
  const list = (await listRes.json()) as { messages?: { id: string }[] }
  const ids = (list.messages ?? []).map((m) => m.id)

  const out: ParsedMessage[] = []
  for (const id of ids) {
    const res = await fetch(`${GMAIL_API}/${id}?format=full`, { headers: auth })
    if (!res.ok) continue
    const normalized = gmailToParsedMessage((await res.json()) as GmailMessage)
    if (normalized) out.push(normalized)
  }
  return out
}
