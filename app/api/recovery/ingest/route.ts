// POST /api/recovery/ingest
// Trusted ingest endpoint for recovery connectors (local agents or server crons).
// Bearer-authed (same bridge tokens as /api/ingest); the token resolves which
// coach the batch belongs to. Accepts normalized RecoverySample[] and runs the
// generic recovery-sync engine: match athlete → PENDING suggested_action (coach
// approval). NOTHING is auto-written to athlete records. Supports `dryRun`.

import { NextResponse } from "next/server"
import { z } from "zod"

import { resolveBridgeCoach } from "@/lib/api/bridge-auth"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { runRecoverySync } from "@/lib/recovery/sync"
import type { RecoverySample } from "@/lib/recovery/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_SAMPLES = 5000
const num = z.number().finite().nullable().optional()
const bool = z.boolean().nullable().optional()

const sampleSchema = z.object({
  connector: z.string().trim().min(1).optional(),
  external: z.object({
    id: z.string().trim().min(1).nullable().optional(),
    email: z.string().trim().min(1).nullable().optional(),
    phone: z.string().trim().min(1).nullable().optional(),
    name: z.string().trim().min(1).nullable().optional(),
  }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  metrics: z
    .object({
      recoveryScore: num, hrvRmssd: num, restingHr: num, hydration: num,
      hydrationStandard: num, hrvAnomaly: bool, trendHrvAnomaly: bool,
      mentalHealthAnomaly: bool, sleepHours: num, sleepQuality: num,
      readiness: num, soreness: num, fatigue: num, bodyBattery: num,
    })
    .partial(),
  notes: z.string().nullable().optional(),
  measuredAt: z.string().nullable().optional(),
})

const bodySchema = z.object({
  connector: z.string().trim().min(1),
  dryRun: z.boolean().optional(),
  samples: z.array(sampleSchema).min(1).max(MAX_SAMPLES),
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

  // The top-level connector is authoritative; stamp it on every sample so the
  // idempotency/source keys are consistent.
  const { connector, dryRun } = parsed.data
  const samples: RecoverySample[] = parsed.data.samples.map((s) => ({
    connector,
    external: s.external,
    date: s.date,
    metrics: s.metrics,
    notes: s.notes ?? null,
    measuredAt: s.measuredAt ?? null,
  }))

  try {
    const supabase = createAdminSupabase()
    const result = await runRecoverySync(supabase, auth.coachId, connector, samples, { dryRun })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
