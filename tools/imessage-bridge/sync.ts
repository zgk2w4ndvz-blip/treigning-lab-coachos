// CoachOS iMessage bridge — local sync entry point.
//
// Flow (privacy-first):
//   1. Fetch the athlete allow-list from CoachOS (abort if unavailable/empty).
//   2. Read inbound TEXT messages from the local chat.db newer than the cursor.
//   3. Keep ONLY messages from allow-listed athlete handles; drop the rest
//      (never stored, never uploaded).
//   4. POST the survivors to /api/ingest → pending suggestions (coach approves).
//   5. Advance the local cursor (idempotent across restarts; server also dedups
//      by message GUID).
//
// The bridge NEVER writes to weight_logs / prescriptions / any athlete table.
// All athlete data flows through POST /api/ingest and coach approval only.
//
// Flags: --dry-run (no persistence), --since <date> (backfill, cursor untouched),
//        --verbose, --limit <n>.

import { loadConfig } from "./config"
import { readState, writeState } from "./state"
import { appleDateToIso, decodeBody, queryNewMessages } from "./chatdb"
import { fetchHandles, postIngest, type IngestMessage } from "./api"
import { buildAthleteIndex, resolveAthlete, narrowHandles } from "./filter"
import type { IngestResultItem } from "./api"

const APPLE_EPOCH = 978_307_200

async function main() {
  const cfg = loadConfig(process.argv.slice(2))
  const { flags } = cfg
  const vlog = (...a: unknown[]) => {
    if (flags.verbose) console.log("[bridge]", ...a)
  }

  console.log(
    `CoachOS iMessage bridge — ${flags.dryRun ? "DRY RUN (nothing persisted)" : "live"}` +
      `${flags.since ? ` · backfill since ${flags.since}` : ""}`
  )

  // 1. Allow-list FIRST. If we can't get it, we upload nothing.
  const allHandles = await fetchHandles(cfg.baseUrl, cfg.token)

  // Optional single-athlete scoping for testing. Narrows WITHIN the allow-list,
  // so non-athletes can never be included regardless of these flags.
  let handles = allHandles
  if (flags.athlete || flags.handle) {
    handles = narrowHandles(allHandles, { athlete: flags.athlete, handle: flags.handle })
    if (handles.length === 0) {
      const what = [
        flags.athlete ? `--athlete "${flags.athlete}"` : null,
        flags.handle ? `--handle "${flags.handle}"` : null,
      ]
        .filter(Boolean)
        .join(" ")
      console.error(`No allow-listed athlete matches ${what}. Aborting (nothing uploaded).`)
      process.exit(2)
    }
    console.log(`Scoped to ${handles.length} athlete(s): ${handles.map((h) => h.name).join(", ")}`)
  }

  const index = buildAthleteIndex(handles)
  vlog(`allow-list index: ${index.size} handle key(s) across ${handles.length} athlete(s)`)
  if (index.size === 0) {
    console.error("Allow-list is empty — no athlete handles to match. Aborting (nothing uploaded).")
    process.exit(2)
  }

  // 2. Cursor / range.
  const state = readState(cfg.statePath)
  let sinceAppleNs: number | null = null
  if (flags.since) {
    const t = Date.parse(flags.since)
    if (Number.isNaN(t)) {
      console.error(`Invalid --since date: ${flags.since}`)
      process.exit(2)
    }
    sinceAppleNs = (t / 1000 - APPLE_EPOCH) * 1e9
    vlog(`--since ${new Date(t).toISOString()} (cursor will NOT advance)`)
  } else {
    vlog(`cursor: ROWID > ${state.lastRowId} (last sync ${state.lastSyncedAt ?? "never"})`)
  }

  // 3. Read local messages (both directions).
  const raw = queryNewMessages({
    chatDbPath: cfg.chatDbPath,
    sinceRowId: state.lastRowId,
    sinceAppleNs,
    limit: flags.limit,
  })
  vlog(`read ${raw.length} text row(s) from chat.db (limit ${flags.limit})`)

  // 4. Resolve each message to EXACTLY one allow-listed athlete by handle. The
  //    handle is the athlete in both directions (sender inbound / recipient
  //    outbound). Non-athletes are dropped; a handle shared by >1 athlete is
  //    skipped as ambiguous — never matched by name/title/prior selection.
  interface DebugRow {
    rowid: number
    direction: "incoming" | "outgoing"
    rawHandle: string
    normalized: string
    name: string
    clientId: string
    guid: string
  }
  const toUpload: IngestMessage[] = []
  const debug: DebugRow[] = []
  let maxRowId = state.lastRowId
  let nonAthlete = 0
  let ambiguous = 0
  let empty = 0
  let inbound = 0
  let outbound = 0
  for (const m of raw) {
    if (m.rowid > maxRowId) maxRowId = m.rowid
    if (!m.handle) {
      nonAthlete++
      continue
    }
    const r = resolveAthlete(m.handle, index)
    if (r.status === "none") {
      nonAthlete++ // privacy: not an athlete — drop, never store
      continue
    }
    if (r.status === "ambiguous") {
      ambiguous++
      console.warn(
        `AMBIGUOUS HANDLE MATCH — ROWID ${m.rowid}, handle ${m.handle} (${r.normalized}) ` +
          `maps to multiple athletes; skipping (no suggestions created).`
      )
      continue
    }
    const body = decodeBody(m.text, m.bodyHex)
    if (!body) {
      empty++
      continue
    }
    const direction = m.isFromMe ? "outgoing" : "incoming"
    if (direction === "incoming") inbound++
    else outbound++
    const msg: IngestMessage = {
      source: "imessage",
      external_id: m.guid,
      body,
      received_at: appleDateToIso(m.date),
      direction,
    }
    // Send the NORMALIZED athlete handle the message resolved to.
    if (r.normalized.includes("@")) msg.sender_email = r.normalized
    else msg.sender_phone = r.normalized
    toUpload.push(msg)
    debug.push({
      rowid: m.rowid, direction, rawHandle: m.handle, normalized: r.normalized,
      name: r.name, clientId: r.clientId, guid: m.guid,
    })
  }
  vlog(
    `matched ${toUpload.length} athlete message(s) (${inbound} inbound, ${outbound} outbound); ` +
      `skipped ${nonAthlete} non-athlete, ${ambiguous} ambiguous, ${empty} empty/undecodable`
  )

  const advance = !flags.dryRun && !flags.since && maxRowId > state.lastRowId

  if (toUpload.length === 0) {
    console.log("Nothing to upload.")
    if (advance) {
      writeState(cfg.statePath, { lastRowId: maxRowId, lastSyncedAt: new Date().toISOString() })
      vlog(`cursor advanced to ROWID ${maxRowId}`)
    }
    return
  }

  // 5. Upload in chunks; collect per-message outcomes (by externalId).
  const CHUNK = 200
  let totalSug = 0
  let totalMatched = 0
  const resultByGuid = new Map<string, IngestResultItem>()
  for (let i = 0; i < toUpload.length; i += CHUNK) {
    const batch = toUpload.slice(i, i + CHUNK)
    const res = await postIngest(cfg.baseUrl, cfg.token, batch, flags.dryRun)
    totalSug += res.suggestionCount ?? 0
    totalMatched += res.matched ?? 0
    for (const r of res.results ?? []) if (r.externalId) resultByGuid.set(r.externalId, r)
    vlog(
      `POST /api/ingest (${batch.length}) → ${res.suggestionCount ?? 0} suggestion(s), ` +
        `${res.matched ?? 0} matched${res.dryRun ? " [dry-run, not persisted]" : ""}`
    )
  }

  // 6. Per-message debug table (verbose or dry-run).
  if (flags.verbose || flags.dryRun) {
    console.log("\nPer-message matching:")
    for (const d of debug) {
      const actions = resultByGuid.get(d.guid)?.actions ?? []
      console.log(
        `ROWID ${d.rowid}\n` +
          `  DIR ${d.direction === "outgoing" ? "out" : "in"}\n` +
          `  HANDLE ${d.rawHandle}\n` +
          `  NORMALIZED ${d.normalized}\n` +
          `  MATCH ${d.name}\n` +
          `  CLIENT_ID ${d.clientId}\n` +
          `  SUGGESTIONS ${actions.length ? actions.join(", ") : "(none)"}`
      )
    }
    console.log("")
  }

  console.log(
    `${flags.dryRun ? "[dry-run] would upload" : "Uploaded"} ${toUpload.length} message(s) ` +
      `(${inbound} inbound, ${outbound} outbound) → ${totalSug} pending suggestion(s); ` +
      `${totalMatched} matched${ambiguous ? `, ${ambiguous} ambiguous skipped` : ""}.`
  )

  // 6. Advance cursor (steady-state runs only).
  if (advance) {
    writeState(cfg.statePath, { lastRowId: maxRowId, lastSyncedAt: new Date().toISOString() })
    vlog(`cursor advanced to ROWID ${maxRowId}`)
  } else {
    vlog("cursor NOT advanced (dry-run or --since).")
  }
}

main().catch((e) => {
  console.error("bridge error:", e instanceof Error ? e.message : e)
  process.exit(1)
})
