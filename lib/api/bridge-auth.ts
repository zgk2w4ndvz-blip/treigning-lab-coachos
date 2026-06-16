import "server-only"

import { timingSafeEqual } from "node:crypto"

// ============================================================================
// Bearer-token auth for trusted local agents (the iMessage bridge, future
// desktop syncers). A presented token resolves to the coach (profiles.id) the
// agent acts for — so the ingest/handles endpoints are NOT bound to a single
// hard-coded coach. v1 ships one coach via env; multi-coach is a config change,
// no code change.
//
// Resolution order:
//   1. BRIDGE_TOKENS — JSON object { "<token>": "<coachProfileId>", ... }.
//      The canonical multi-coach mechanism (later: back this with a DB table).
//   2. BRIDGE_TOKEN + BRIDGE_COACH_ID — single-coach convenience for v1.
//
// If BRIDGE_TOKENS is set, only tokens in that map are accepted (no silent
// fallback to the single-token env).
// ============================================================================

export type BridgeAuthResult =
  | { ok: true; coachId: string }
  | { ok: false; status: number; error: string }

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/** Resolve the coach a bridge token acts for, or an auth error. */
export function resolveBridgeCoach(authHeader: string | null): BridgeAuthResult {
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null
  if (!token) return { ok: false, status: 401, error: "Missing bearer token." }

  // 1) Multi-coach token map.
  const mapRaw = process.env.BRIDGE_TOKENS
  if (mapRaw) {
    let map: Record<string, string>
    try {
      map = JSON.parse(mapRaw) as Record<string, string>
    } catch {
      return { ok: false, status: 500, error: "BRIDGE_TOKENS is not valid JSON." }
    }
    for (const [t, coachId] of Object.entries(map)) {
      if (coachId && safeEqual(token, t)) return { ok: true, coachId }
    }
    return { ok: false, status: 401, error: "Invalid bridge token." }
  }

  // 2) Single-coach fallback.
  const single = process.env.BRIDGE_TOKEN
  const coachId = process.env.BRIDGE_COACH_ID
  if (!single || !coachId) {
    return { ok: false, status: 500, error: "Bridge auth is not configured." }
  }
  if (safeEqual(token, single)) return { ok: true, coachId }
  return { ok: false, status: 401, error: "Invalid bridge token." }
}
