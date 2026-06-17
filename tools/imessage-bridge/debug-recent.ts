// Inspect recent inbound Messages rows WITHOUT uploading anything and WITHOUT
// printing message bodies (a 20-char preview only with --preview). Read-only:
// never advances the cursor, never writes, never calls /api/ingest.
//
// Shows per row: rowid, timestamp, handle, whether it matched an athlete, the
// matched athlete name, and whether the body was decodable.
//
// Flags: --since <date>, --limit <n> (default 20), --athlete "<name>",
//        --handle "<phone|email>", --preview.

import { loadConfig } from "./config"
import { appleDateToIso, decodeBody, queryRecentInbound } from "./chatdb"
import { fetchHandles } from "./api"
import { buildAllowList, narrowHandles, normalizeHandleQuery } from "./filter"

const APPLE_EPOCH = 978_307_200

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length)
}

async function main() {
  const argv = process.argv.slice(2)
  const cfg = loadConfig(argv)
  const { flags } = cfg
  const preview = argv.includes("--preview")
  // Debug defaults to a small window unless --limit was explicitly passed.
  const limit = argv.includes("--limit") ? flags.limit : 20

  // Allow-list (for match labeling) + a normalized-handle → athlete-name map.
  const allHandles = await fetchHandles(cfg.baseUrl, cfg.token)
  const allow = buildAllowList(allHandles)
  const nameByPhone = new Map<string, string>()
  const nameByEmail = new Map<string, string>()
  for (const h of allHandles) {
    if (h.phoneLast10) nameByPhone.set(h.phoneLast10, h.name)
    if (h.email) nameByEmail.set(h.email.toLowerCase(), h.name)
  }

  // Optional single-athlete scoping → a set of normalized target values.
  let targets: Set<string> | null = null
  if (flags.athlete || flags.handle) {
    const scoped = narrowHandles(allHandles, { athlete: flags.athlete, handle: flags.handle })
    if (scoped.length === 0) {
      console.error(
        `No allow-listed athlete matches ${flags.athlete ? `--athlete "${flags.athlete}" ` : ""}${flags.handle ? `--handle "${flags.handle}"` : ""}`.trim()
      )
      process.exit(2)
    }
    targets = new Set<string>()
    for (const h of scoped) {
      if (h.phoneLast10) targets.add(h.phoneLast10)
      if (h.email) targets.add(h.email.toLowerCase())
    }
  }

  let sinceAppleNs: number | null = null
  if (flags.since) {
    const t = Date.parse(flags.since)
    if (Number.isNaN(t)) {
      console.error(`Invalid --since date: ${flags.since}`)
      process.exit(2)
    }
    sinceAppleNs = (t / 1000 - APPLE_EPOCH) * 1e9
  }

  const rows = queryRecentInbound({ chatDbPath: cfg.chatDbPath, sinceAppleNs, limit })

  console.log(
    `Inspecting recent inbound rows (read-only — no upload, cursor untouched)` +
      `${flags.since ? `, since ${flags.since}` : ""}.\n`
  )
  console.log(
    `${pad("ROWID", 8)} ${pad("TIMESTAMP", 22)} ${pad("HANDLE", 24)} ${pad("MATCH", 6)} ${pad("ATHLETE", 18)} ${pad("DECODE", 7)}${preview ? " PREVIEW(20)" : ""}`
  )

  let shown = 0
  for (const m of rows) {
    const handle = m.handle ?? "(unknown)"
    const nq = m.handle ? normalizeHandleQuery(m.handle) : null
    const key = nq?.value ?? null
    const matched =
      key != null && (nq!.kind === "phone" ? allow.phones.has(key) : allow.emails.has(key))

    if (targets && !(key != null && targets.has(key))) continue

    const name = matched
      ? (nq!.kind === "phone" ? nameByPhone.get(key!) : nameByEmail.get(key!)) ?? "?"
      : "—"
    const body = decodeBody(m.text, m.bodyHex)
    const decodable = body != null && body.length > 0
    const prev = preview && decodable ? ` ${body!.slice(0, 20).replace(/\s+/g, " ")}` : ""

    console.log(
      `${pad(String(m.rowid), 8)} ${pad(appleDateToIso(m.date), 22)} ${pad(handle, 24)} ${pad(matched ? "yes" : "no", 6)} ${pad(name, 18)} ${pad(decodable ? "ok" : "no", 7)}${prev}`
    )
    shown++
  }

  console.log(`\n${shown} row(s) shown${targets ? " (scoped)" : ""}. Nothing uploaded.`)
}

main().catch((e) => {
  console.error("debug-recent error:", e instanceof Error ? e.message : e)
  process.exit(1)
})
