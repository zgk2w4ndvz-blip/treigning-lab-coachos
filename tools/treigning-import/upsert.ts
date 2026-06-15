// ============================================================================
// upsert.ts — load out/coachos-rows.json into Supabase, without duplicates.
//
//   npx tsx tools/treigning-import/upsert.ts            # DRY RUN (default)
//   npx tsx tools/treigning-import/upsert.ts --apply    # actually write
//
// Dedupe: existing client matched by (coach_id, lower(email)) when an email is
// present, else (coach_id, lower(first_name), lower(last_name)). Matches →
// UPDATE; no match → INSERT. Body-composition snapshots are written to
// weight_logs and tagged notes='treigning-import' so re-runs refresh rather
// than duplicate. NON-DESTRUCTIVE: this script never deletes.
//
// Uses SUPABASE_SERVICE_ROLE_KEY — appropriate for a local admin migration that
// sets coach_id explicitly. Never commit your keys; they live in .env.local.
// ============================================================================

import fs from "node:fs"
import path from "node:path"

import { createClient } from "@supabase/supabase-js"

import type { ImportRow } from "./types"

const APPLY = process.argv.includes("--apply")
const ROWS = path.join(__dirname, "out", "coachos-rows.json")
const SNAPSHOT_TAG = "treigning-import"

function env(name: string, ...fallbacks: string[]): string {
  for (const n of [name, ...fallbacks]) {
    const v = process.env[n]
    if (v) return v
  }
  console.error(`✗ Missing env var ${name} (see tools/treigning-import/README.md).`)
  process.exit(1)
}

async function main() {
  if (!fs.existsSync(ROWS)) {
    console.error(`✗ ${ROWS} not found — run transform.ts first.`)
    process.exit(1)
  }
  const rows = JSON.parse(fs.readFileSync(ROWS, "utf8")) as ImportRow[]

  const url = env("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
  const key = env("SUPABASE_SERVICE_ROLE_KEY")
  const coachId = env("COACH_ID")
  const db = createClient(url, key, { auth: { persistSession: false } })

  // Pull this coach's existing clients once for fast, read-only matching.
  const { data: existing, error } = await db
    .from("clients")
    .select("id, email, first_name, last_name")
    .eq("coach_id", coachId)
  if (error) {
    console.error("✗ Could not read existing clients:", error.message)
    process.exit(1)
  }
  const byEmail = new Map<string, string>()
  const byName = new Map<string, string>()
  for (const c of existing ?? []) {
    if (c.email) byEmail.set(c.email.toLowerCase(), c.id)
    byName.set(`${(c.first_name ?? "").toLowerCase()}|${(c.last_name ?? "").toLowerCase()}`, c.id)
  }

  const plan = rows.map((r) => {
    const id = (r.email && byEmail.get(r.email)) || byName.get(r.nameKey) || null
    return { row: r, existingId: id, op: id ? ("update" as const) : ("insert" as const) }
  })
  const inserts = plan.filter((p) => p.op === "insert").length
  const updates = plan.filter((p) => p.op === "update").length
  const snapshots = plan.filter((p) => p.row.bodyComp).length
  const biomarkers = plan.reduce((n, p) => n + p.row.biomarkers.length, 0)

  console.log(`\n${APPLY ? "APPLY" : "DRY RUN"} — coach_id=${coachId}`)
  console.log("Plan:")
  console.log(`  clients to INSERT       : ${inserts}`)
  console.log(`  clients to UPDATE       : ${updates}`)
  console.log(`  body-comp snapshots     : ${snapshots} (insert or refresh)`)
  console.log(`  biomarker readings      : ${biomarkers} (insert or refresh)`)
  console.log(`  deletes                 : 0 (this tool never deletes)`)
  console.log("  sample:")
  for (const p of plan.slice(0, 8)) {
    console.log(`    ${p.op.toUpperCase().padEnd(6)} ${p.row.client.first_name} ${p.row.client.last_name}` +
      `${p.row.email ? ` <${p.row.email}>` : ""}${p.row.bodyComp ? "  +bodycomp" : ""}`)
  }
  fs.writeFileSync(
    path.join(__dirname, "out", "plan.json"),
    JSON.stringify(plan.map((p) => ({ op: p.op, existingId: p.existingId, name: `${p.row.client.first_name} ${p.row.client.last_name}`, email: p.row.email })), null, 2)
  )

  if (!APPLY) {
    console.log(`\n  Dry run only — nothing written. Wrote out/plan.json.`)
    console.log(`  Re-run with --apply to execute the plan above.`)
    return
  }

  console.log(`\n▶ Applying…`)
  let done = 0
  for (const p of plan) {
    const payload = { ...p.row.client, coach_id: coachId, status: "active" as const }
    let clientId = p.existingId

    if (clientId) {
      const { error: upErr } = await db.from("clients").update(p.row.client).eq("id", clientId)
      if (upErr) { console.warn(`  ! update ${payload.first_name}: ${upErr.message}`); continue }
    } else {
      const { data: ins, error: insErr } = await db.from("clients").insert(payload).select("id").single()
      if (insErr || !ins) { console.warn(`  ! insert ${payload.first_name}: ${insErr?.message}`); continue }
      clientId = ins.id
    }

    // Body-comp snapshot: refresh the tagged row if present, else insert one.
    if (p.row.bodyComp && clientId) {
      const log = { ...p.row.bodyComp, client_id: clientId, notes: SNAPSHOT_TAG }
      const { data: existingLog } = await db
        .from("weight_logs")
        .select("id")
        .eq("client_id", clientId)
        .eq("notes", SNAPSHOT_TAG)
        .maybeSingle()
      if (existingLog?.id) await db.from("weight_logs").update(log).eq("id", existingLog.id)
      else await db.from("weight_logs").insert(log)
    }

    // Biomarker readings → labs vertical. Dedupe by (client, marker, source) so
    // re-runs refresh a marker's value rather than appending duplicates.
    if (clientId) {
      for (const b of p.row.biomarkers) {
        const reading = { ...b, client_id: clientId, source: SNAPSHOT_TAG }
        const { data: existingReading } = await db
          .from("biomarker_readings")
          .select("id")
          .eq("client_id", clientId)
          .eq("marker", b.marker)
          .eq("source", SNAPSHOT_TAG)
          .maybeSingle()
        if (existingReading?.id)
          await db.from("biomarker_readings").update(reading).eq("id", existingReading.id)
        else await db.from("biomarker_readings").insert(reading)
      }
    }
    done++
  }
  console.log(`\n✓ Applied ${done}/${plan.length} athlete(s). Check /clients in CoachOS.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
