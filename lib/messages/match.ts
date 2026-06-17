// ============================================================================
// Athlete matcher — links a message sender to a client by phone, then email,
// then name. Pure; no I/O.
// ============================================================================

import type { MessageMatch } from "@/types/database"

export interface SenderInfo {
  name: string | null
  phone: string | null
  email: string | null
}

export interface MatchClient {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
}

export interface MatchResult {
  clientId: string | null
  method: MessageMatch
  confidence: number
}

const digits = (s: string | null | undefined) => (s ? s.replace(/\D/g, "") : "")
const lower = (s: string | null | undefined) => (s ? s.trim().toLowerCase() : "")

/** Canonical phone form for storage/display: NANP +1XXXXXXXXXX (last 10). Null
 *  if too short. Strips spaces/dashes/parens and a leading +1 country code, so
 *  4055551234, +14055551234, (405) 555-1234 and 405-555-1234 are all equal. */
export function normalizePhone(raw: string | null | undefined): string | null {
  const d = digits(raw)
  if (d.length < 10) return null
  return `+1${d.slice(-10)}`
}

/** Canonical handle for a sender: normalized phone, else lowercased email. */
export function normalizeHandle(sender: {
  phone?: string | null
  email?: string | null
}): string | null {
  const p = normalizePhone(sender.phone)
  if (p) return p
  const e = lower(sender.email)
  return e || null
}

/** Match a sender to a client. Phone > email; name ONLY when no handle exists.
 *  A phone/email handle never falls through to a name match, so a sender's
 *  handle can never be overridden by a name appearing in the message. */
export function matchAthlete(sender: SenderInfo, clients: MatchClient[]): MatchResult {
  // 1) Phone — compare the last 10 digits.
  const sp = digits(sender.phone)
  if (sp.length >= 7) {
    const tail = sp.slice(-10)
    const hit = clients.find((c) => {
      const cp = digits(c.phone)
      return cp.length >= 7 && cp.slice(-10) === tail
    })
    if (hit) return { clientId: hit.id, method: "phone", confidence: 0.95 }
  }

  // 2) Email — exact, case-insensitive.
  const se = lower(sender.email)
  if (se) {
    const hit = clients.find((c) => lower(c.email) === se)
    if (hit) return { clientId: hit.id, method: "email", confidence: 0.97 }
  }

  // 3) Name — ONLY as a last resort when the sender carries no phone/email
  //    handle at all (e.g. a manually pasted name-only row). Never used to
  //    override or second-guess a handle.
  const sn = lower(sender.name)
  if (sn && !sender.phone && !sender.email) {
    const exact = clients.find(
      (c) => lower(`${c.first_name} ${c.last_name}`) === sn
    )
    if (exact) return { clientId: exact.id, method: "name", confidence: 0.8 }

    const lastTok = sn.split(/\s+/).pop() ?? ""
    if (lastTok.length >= 3) {
      const byLast = clients.filter((c) => lower(c.last_name) === lastTok)
      if (byLast.length === 1)
        return { clientId: byLast[0].id, method: "name", confidence: 0.5 }
    }
  }

  return { clientId: null, method: "unmatched", confidence: 0 }
}
