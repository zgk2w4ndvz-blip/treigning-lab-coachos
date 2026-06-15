// Continuous Gmail sync — invoked by Vercel Cron (see vercel.json).
// Self-authenticated via CRON_SECRET (not Clerk); runs as the coach named by
// CRON_COACH_ID using the service-role client inside runIngest.

import { NextResponse } from "next/server"

import { runIngest } from "@/lib/messages/ingest"
import { fetchGmailMessages } from "@/lib/messages/sources/gmail"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const provided = req.headers.get("authorization")
  // Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` when the env is set.
  if (!secret || provided !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const coachId = process.env.CRON_COACH_ID
  if (!coachId) {
    return NextResponse.json({ ok: false, error: "CRON_COACH_ID is not set." }, { status: 500 })
  }

  try {
    const messages = await fetchGmailMessages()
    const result = await runIngest(messages, [], { coachId })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
