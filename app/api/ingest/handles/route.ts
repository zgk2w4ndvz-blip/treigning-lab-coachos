// GET /api/ingest/handles
// Returns the resolved coach's athlete contact handles (phone/email) so a local
// agent (the iMessage bridge) can filter Messages to athletes BEFORE anything
// leaves the device — the privacy keystone. Bearer-authed; service-role read.
// Read-only: never writes.

import { NextResponse } from "next/server"

import { resolveBridgeCoach } from "@/lib/api/bridge-auth"
import { createAdminSupabase } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Last 10 digits, matching lib/messages/match.ts phone comparison. */
function last10(phone: string | null): string | null {
  if (!phone) return null
  const d = phone.replace(/\D/g, "")
  return d.length >= 7 ? d.slice(-10) : null
}

export async function GET(req: Request) {
  const auth = resolveBridgeCoach(req.headers.get("authorization"))
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  try {
    const supabase = createAdminSupabase()
    const { data, error } = await supabase
      .from("clients")
      .select("id, first_name, last_name, phone, email, status")
      .eq("coach_id", auth.coachId)
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    const handles = (data ?? []).map((c) => ({
      clientId: c.id,
      name: `${c.first_name} ${c.last_name}`.trim(),
      phone: c.phone ?? null,
      phoneLast10: last10(c.phone),
      email: c.email ? c.email.trim().toLowerCase() : null,
      status: c.status,
    }))

    return NextResponse.json({ ok: true, coachId: auth.coachId, count: handles.length, handles })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
