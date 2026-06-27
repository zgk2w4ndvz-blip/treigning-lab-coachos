// ============================================================================
// discover-recovery.ts — capture the REAL Treigning Lab recovery data shape so
// the recovery connector can map the exact fields the app exposes (HRV, resting
// HR, sleep, readiness, soreness, fatigue, recovery score, daily notes, ...)
// instead of guessing.
//
// Like discover-metabolic.ts: opens a real browser with a PERSISTENT profile —
// YOU log in manually and navigate to an athlete's recovery / daily view. It
// records every JSON/XHR response and a page snapshot each time you press Enter.
// Read-only — it only observes (GET); it NEVER writes to Treigning Lab and NEVER
// reads or stores your credentials (auth lives in the browser profile on disk).
//
//   npx tsx tools/treigning-import/discover-recovery.ts
//   (or: npm run import:discover-recovery)
//
// Output → raw-backup/recovery-discovery/
//   network-json.json    every application/json response (url, status, body)
//   network-urls.json    every XHR/fetch URL seen (endpoint discovery)
//   snapshot-NN.json     per-Enter page capture (url, __NEXT_DATA__, inline JSON)
//   recovery-schema.json **SHARE THIS** — field PATHS + value TYPES only (no
//                        athlete values), for any object that looks recovery-
//                        related. Safe to share for connector calibration.
//
// Privacy: the raw files contain your athletes' data — keep them local. For
// building the connector I only need recovery-schema.json (shapes, not values).
// ============================================================================

import fs from "node:fs"
import path from "node:path"
import readline from "node:readline"

import { chromium, type BrowserContext, type Page } from "playwright"

const OUT_DIR = path.join(__dirname, "raw-backup", "recovery-discovery")
const SESSION_DIR =
  process.env.TREIGNING_USER_DATA_DIR ?? path.join(__dirname, ".session")

// Keys that mark an object as recovery-related (case-insensitive substring).
const RECOVERY_KEY_HINTS = [
  "hrv", "resting_hr", "rhr", "resting", "heart_rate", "readiness", "recovery",
  "sleep", "soreness", "sore", "fatigue", "stress", "body_battery", "strain",
  "respiratory", "spo2", "temperature", "note", "measured_at", "date",
]

interface CapturedResponse {
  url: string
  status: number
  contentType: string
  json: unknown
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true })
}

function save(name: string, data: unknown) {
  ensureDir(OUT_DIR)
  fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(data, null, 2))
  console.log(`  saved raw-backup/recovery-discovery/${name}`)
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) =>
    rl.question(question, (a) => {
      rl.close()
      resolve(a.trim())
    })
  )
}

function attachCapture(context: BrowserContext, json: CapturedResponse[], urls: Set<string>) {
  context.on("response", async (res) => {
    const url = res.url()
    const req = res.request()
    if (req.resourceType() === "xhr" || req.resourceType() === "fetch") urls.add(url)
    const ct = res.headers()["content-type"] ?? ""
    if (!ct.includes("application/json")) return
    try {
      json.push({ url, status: res.status(), contentType: ct, json: await res.json() })
    } catch {
      /* already consumed / not parseable — ignore */
    }
  })
}

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const scripts = Array.from(
      document.querySelectorAll<HTMLScriptElement>('script[type="application/json"]')
    ).map((s) => {
      try {
        return JSON.parse(s.textContent ?? "")
      } catch {
        return null
      }
    })
    const nextData = (() => {
      const el = document.getElementById("__NEXT_DATA__")
      try {
        return el ? JSON.parse(el.textContent ?? "") : null
      } catch {
        return null
      }
    })()
    return {
      url: location.href,
      title: document.title,
      nextData,
      jsonScripts: scripts.filter(Boolean),
    }
  })
}

const valueType = (v: unknown): string =>
  v === null ? "null" : Array.isArray(v) ? "array" : typeof v

/** Walk all captured JSON and emit, for every object that has ≥1 recovery-ish
 *  key, a map of field path → value TYPE (never the value). Deduped. This is
 *  the safe-to-share schema. */
function buildSchema(responses: CapturedResponse[]): Record<string, string> {
  const fields: Record<string, string> = {}
  const looksRecovery = (o: Record<string, unknown>) => {
    const keys = Object.keys(o).join(",").toLowerCase()
    return RECOVERY_KEY_HINTS.some((h) => keys.includes(h))
  }
  const walk = (node: unknown, prefix: string) => {
    if (Array.isArray(node)) {
      node.slice(0, 3).forEach((n) => walk(n, `${prefix}[]`))
    } else if (node && typeof node === "object") {
      const obj = node as Record<string, unknown>
      if (looksRecovery(obj)) {
        for (const [k, v] of Object.entries(obj)) {
          if (v && typeof v === "object") walk(v, `${prefix}.${k}`)
          else fields[`${prefix}.${k}`.replace(/^\./, "")] = valueType(v)
        }
      } else {
        for (const [k, v] of Object.entries(obj)) walk(v, `${prefix}.${k}`)
      }
    }
  }
  for (const r of responses) walk(r.json, "")
  return Object.fromEntries(Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)))
}

async function main() {
  ensureDir(SESSION_DIR)
  const jsonResponses: CapturedResponse[] = []
  const urls = new Set<string>()

  const context = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    viewport: { width: 1400, height: 900 },
  })
  attachCapture(context, jsonResponses, urls)
  const page = context.pages()[0] ?? (await context.newPage())

  const start = process.env.TREIGNING_TEAM_URL
  if (start) {
    console.log(`▶ Opening ${start}`)
    await page.goto(start, { waitUntil: "domcontentloaded" }).catch(() => {})
  } else {
    console.log("▶ Browser open. Navigate to Treigning Lab and log in.")
  }

  console.log(
    "\n  Log in, then open an athlete's RECOVERY / daily-readiness view (HRV,\n" +
      "  resting HR, sleep, readiness, soreness, notes...). Each time a recovery\n" +
      "  view is fully loaded, return here and press Enter to snapshot it. Visit\n" +
      "  a couple of athletes and a couple of days so we capture the full set.\n"
  )

  let n = 0
  for (;;) {
    const answer = await ask(
      `→ Press Enter to snapshot (captured so far: ${jsonResponses.length} JSON responses), or 'q' then Enter to finish: `
    )
    if (answer.toLowerCase() === "q") break
    n++
    try {
      const snap = await snapshot(page)
      save(`snapshot-${String(n).padStart(2, "0")}.json`, snap)
      console.log(`  ✓ snapshot ${n}: ${snap.url}`)
    } catch (e) {
      console.warn(`  ! snapshot failed: ${e instanceof Error ? e.message : e}`)
    }
  }

  save("network-json.json", jsonResponses)
  save("network-urls.json", [...urls].sort())
  const schema = buildSchema(jsonResponses)
  save("recovery-schema.json", schema)

  console.log(
    `\n✓ Done. ${n} snapshot(s); ${jsonResponses.length} JSON response(s); ` +
      `${urls.size} XHR/fetch URL(s); ${Object.keys(schema).length} recovery field(s).\n` +
      `  SHARE raw-backup/recovery-discovery/recovery-schema.json (field shapes,\n` +
      `  no athlete values) so the recovery connector can be mapped exactly.\n` +
      `  Keep network-json.json / snapshots local — they contain athlete data.`
  )
  await context.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
