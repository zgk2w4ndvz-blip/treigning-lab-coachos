// Deterministic athlete matching for recovery sync. Pure. Priority:
// 1) established external→client map (covers prior matches + manual overrides),
// 2) unique email, 3) unique phone, 4) unique exact name, else unmatched.
// Ambiguous (>1 candidate) never matches — we never guess and never duplicate.

import { normalizePhone, type MatchClient } from "@/lib/messages/match"
import type { ExternalAthlete } from "@/lib/recovery/types"

export type RecoveryMatchMethod = "map" | "email" | "phone" | "name" | "unmatched"

export interface RecoveryMatch {
  clientId: string | null
  method: RecoveryMatchMethod
}

const lower = (s: string | null | undefined) => (s ? s.trim().toLowerCase() : "")
const normName = (s: string | null | undefined) =>
  lower(s).replace(/\s+/g, " ")

/**
 * @param externalMap connector-scoped external id → client id (from
 *        external_athlete_map: established auto-matches + manual overrides).
 */
export function matchRecoveryAthlete(
  ext: ExternalAthlete,
  roster: MatchClient[],
  externalMap: Map<string, string>
): RecoveryMatch {
  // 1) Established / manual mapping by the connector's external id.
  if (ext.id && externalMap.has(ext.id)) {
    return { clientId: externalMap.get(ext.id) as string, method: "map" }
  }

  // 2) Unique email.
  const email = lower(ext.email)
  if (email) {
    const hits = roster.filter((c) => lower(c.email) === email)
    if (hits.length === 1) return { clientId: hits[0].id, method: "email" }
  }

  // 3) Unique phone (normalized).
  const phone = normalizePhone(ext.phone)
  if (phone) {
    const hits = roster.filter((c) => normalizePhone(c.phone) === phone)
    if (hits.length === 1) return { clientId: hits[0].id, method: "phone" }
  }

  // 4) Unique exact normalized full name.
  const name = normName(ext.name)
  if (name) {
    const hits = roster.filter(
      (c) => normName(`${c.first_name} ${c.last_name}`) === name
    )
    if (hits.length === 1) return { clientId: hits[0].id, method: "name" }
  }

  // 5) Unmatched — coach maps manually (recorded in external_athlete_map).
  return { clientId: null, method: "unmatched" }
}
