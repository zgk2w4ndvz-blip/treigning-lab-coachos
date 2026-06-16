// POST /api/ingest
// Trusted ingest endpoint for local agents (the iMessage bridge). Bearer-authed;
// the token resolves which coach the batch belongs to. Reuses the existing
// runIngest pipeline (match → analyze → PENDING suggested_actions). Supports
// `dryRun` to preview without persisting.
//
// NOTHING is ever written to athlete records here. The pipeline only ever
// creates pending suggestions; weight logs / prescriptions are written elsewhere
// and only after a coach approves.

import { NextResponse } from "next/server"
import { z } from "zod"

import { resolveBridgeCoach } from "@/lib/api/bridge-auth"
import { runIngest } from "@/lib/messages/ingest"
import type { ParsedMessage } from "@/lib/messages/parse"
import type { MessageSource } from "@/types/database"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const SOURCES = ["gmail", "sms", "imessage", "whatsapp", "manual", "csv", "json"] as const
const MAX_MESSAGES = 1000

const toIso = (v: string | undefined | null) => {
  if (!v) return null
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

const messageSchema = z.object({
  source: z.enum(SOURCES).optional(),
  external_id: z.string().trim().min(1).optional(),
  sender_name: z.string().trim().min(1).optional(),
  sender_phone: z.string().trim().min(1).optional(),
  sender_email: z.string().trim().min(1).optional(),
  body: z.string().min(1),
  received_at: z.string().optional(),
})

const bodySchema = z.object({
  dryRun: z.boolean().optional(),
  messages: z.array(messageSchema).min(1).max(MAX_MESSAGES),
})

export async function POST(req: Request) {
  const auth = resolveBridgeCoach(req.headers.get("authorization"))
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid payload.", issues: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const messages: ParsedMessage[] = parsed.data.messages.map((m) => ({
    source: (m.source ?? "imessage") as MessageSource,
    externalId: m.external_id ?? null,
    senderName: m.sender_name ?? null,
    senderPhone: m.sender_phone ?? null,
    senderEmail: m.sender_email ?? null,
    body: m.body,
    receivedAt: toIso(m.received_at),
  }))

  try {
    const result = await runIngest(messages, [], {
      coachId: auth.coachId,
      dryRun: parsed.data.dryRun,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
