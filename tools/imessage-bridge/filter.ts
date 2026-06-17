// Privacy filter: only messages whose sender handle matches an athlete on the
// allow-list are ever processed. Everything else is dropped and never stored.

import type { Handle } from "./api"

export interface AllowList {
  phones: Set<string> // normalized last-10 digits
  emails: Set<string> // lowercased
}

export function buildAllowList(handles: Handle[]): AllowList {
  const phones = new Set<string>()
  const emails = new Set<string>()
  for (const h of handles) {
    if (h.phoneLast10) phones.add(h.phoneLast10)
    if (h.email) emails.add(h.email.toLowerCase())
  }
  return { phones, emails }
}

/** Last 10 digits of a phone handle (matches the server + lib/messages/match). */
export function last10(handle: string): string | null {
  const d = handle.replace(/\D/g, "")
  return d.length >= 7 ? d.slice(-10) : null
}

/** Canonical display form, mirroring the server: +1XXXXXXXXXX or lowercased email. */
export function normalizeHandle(handle: string): string | null {
  if (handle.includes("@")) return handle.trim().toLowerCase()
  const d = handle.replace(/\D/g, "")
  return d.length >= 10 ? `+1${d.slice(-10)}` : null
}

/** The comparison key for matching: last-10 digits, or lowercased email. */
export function matchKey(handle: string): { kind: "phone" | "email"; key: string } | null {
  if (handle.includes("@")) return { kind: "email", key: handle.trim().toLowerCase() }
  const t = last10(handle)
  return t ? { kind: "phone", key: t } : null
}

export interface AthleteRef {
  clientId: string
  name: string
}

/**
 * Index of allow-listed athletes keyed by match key (phone last-10 / email).
 * A key that maps to MORE THAN ONE athlete is ambiguous — used by the safety
 * check so a shared handle never silently picks one athlete.
 */
export function buildAthleteIndex(handles: Handle[]): Map<string, AthleteRef[]> {
  const index = new Map<string, AthleteRef[]>()
  const add = (key: string | null, ref: AthleteRef) => {
    if (!key) return
    const list = index.get(key) ?? []
    if (!list.some((r) => r.clientId === ref.clientId)) list.push(ref)
    index.set(key, list)
  }
  for (const h of handles) {
    const ref = { clientId: h.clientId, name: h.name }
    if (h.phoneLast10) add(h.phoneLast10, ref)
    if (h.email) add(h.email.toLowerCase(), ref)
  }
  return index
}

export type ResolveResult =
  | { status: "matched"; clientId: string; name: string; normalized: string; key: string }
  | { status: "ambiguous"; key: string; normalized: string }
  | { status: "none" }

/** Resolve a message handle to exactly one allow-listed athlete, or flag it
 *  as non-athlete (none) or shared (ambiguous). Allow-list keys ONLY — never
 *  name, conversation title, or any prior selection. */
export function resolveAthlete(handle: string, index: Map<string, AthleteRef[]>): ResolveResult {
  const mk = matchKey(handle)
  if (!mk) return { status: "none" }
  const refs = index.get(mk.key)
  if (!refs || refs.length === 0) return { status: "none" }
  const normalized = normalizeHandle(handle) ?? mk.key
  if (refs.length > 1) return { status: "ambiguous", key: mk.key, normalized }
  return { status: "matched", clientId: refs[0].clientId, name: refs[0].name, normalized, key: mk.key }
}

export type HandleMatch = { kind: "phone" | "email"; value: string }

/** Normalize a --handle query to its comparable form (last-10 / lowercased email). */
export function normalizeHandleQuery(h: string): HandleMatch | null {
  if (h.includes("@")) return { kind: "email", value: h.trim().toLowerCase() }
  const t = last10(h)
  return t ? { kind: "phone", value: t } : null
}

/**
 * Narrow the fetched athlete handles to a single athlete for testing, by name
 * (--athlete) and/or handle (--handle). Both narrow within the allow-list, so
 * non-athletes can never slip through. Returns the filtered subset.
 */
export function narrowHandles(
  handles: Handle[],
  opts: { athlete?: string | null; handle?: string | null }
): Handle[] {
  let out = handles
  if (opts.athlete) {
    const q = opts.athlete.trim().toLowerCase()
    out = out.filter((h) => {
      const n = h.name.trim().toLowerCase()
      return n === q || n.includes(q)
    })
  }
  if (opts.handle) {
    const nq = normalizeHandleQuery(opts.handle)
    out = nq
      ? out.filter((h) =>
          nq.kind === "phone"
            ? h.phoneLast10 === nq.value
            : h.email?.toLowerCase() === nq.value
        )
      : []
  }
  return out
}

/** Classify a sender handle against the allow-list, or null if not an athlete. */
export function classifyHandle(handle: string, allow: AllowList): HandleMatch | null {
  if (handle.includes("@")) {
    const e = handle.trim().toLowerCase()
    return allow.emails.has(e) ? { kind: "email", value: e } : null
  }
  const t = last10(handle)
  return t && allow.phones.has(t) ? { kind: "phone", value: handle } : null
}
