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

export type HandleMatch = { kind: "phone" | "email"; value: string }

/** Classify a sender handle against the allow-list, or null if not an athlete. */
export function classifyHandle(handle: string, allow: AllowList): HandleMatch | null {
  if (handle.includes("@")) {
    const e = handle.trim().toLowerCase()
    return allow.emails.has(e) ? { kind: "email", value: e } : null
  }
  const t = last10(handle)
  return t && allow.phones.has(t) ? { kind: "phone", value: handle } : null
}
