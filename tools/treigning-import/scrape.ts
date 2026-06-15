// ============================================================================
// scrape.ts — capture your Treigning Lab roster + biometrics into raw-backup/.
//
// Opens a REAL browser with a persistent profile so YOU log in manually (no
// credentials are ever read or stored by this script). It then records every
// JSON response the app fetches, follows each athlete-detail link, and saves
// everything to raw-backup/. Read-only: it only navigates (GET), never writes.
//
//   npx tsx tools/treigning-import/scrape.ts
//
// Env (see README): TREIGNING_TEAM_URL, TREIGNING_USER_DATA_DIR?,
//                   IMPORT_MAX_ATHLETES?, IMPORT_DELAY_MS?
// ============================================================================

import fs from "node:fs"
import path from "node:path"
import readline from "node:readline"

import { chromium, type BrowserContext, type Page } from "playwright"

import { SCRAPE } from "./config"

const OUT_DIR = path.join(__dirname, "raw-backup")
const SESSION_DIR =
  process.env.TREIGNING_USER_DATA_DIR ?? path.join(__dirname, ".session")
const MAX = Number(process.env.IMPORT_MAX_ATHLETES ?? "0") || Infinity
const DELAY_MS = Number(process.env.IMPORT_DELAY_MS ?? "1500")

interface CapturedResponse {
  url: string
  status: number
  json: unknown
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true })
}

function save(name: string, data: unknown) {
  ensureDir(OUT_DIR)
  fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(data, null, 2))
  console.log(`  saved raw-backup/${name}`)
}

function prompt(question: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(question, () => { rl.close(); resolve() }))
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Record JSON responses whose URL looks relevant. */
function attachCapture(context: BrowserContext, sink: CapturedResponse[]) {
  context.on("response", async (res) => {
    const url = res.url()
    if (!SCRAPE.jsonResponseUrlIncludes.some((s) => url.toLowerCase().includes(s))) return
    const ct = res.headers()["content-type"] ?? ""
    if (!ct.includes("application/json")) return
    try {
      sink.push({ url, status: res.status(), json: await res.json() })
    } catch {
      /* non-JSON or already consumed — ignore */
    }
  })
}

/** Heuristic: pull arrays-of-objects that look like athlete records. */
function extractAthleteArrays(responses: CapturedResponse[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  const looksLikeAthlete = (o: unknown): o is Record<string, unknown> =>
    !!o && typeof o === "object" && !Array.isArray(o) &&
    /name|first|last|athlete/i.test(Object.keys(o as object).join(","))

  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      if (node.length && node.every(looksLikeAthlete)) out.push(...(node as Record<string, unknown>[]))
      else node.forEach(walk)
    } else if (node && typeof node === "object") {
      Object.values(node).forEach(walk)
    }
  }
  for (const r of responses) walk(r.json)
  // De-dupe by a stable JSON signature.
  const seen = new Set<string>()
  return out.filter((o) => {
    const sig = JSON.stringify(o)
    if (seen.has(sig)) return false
    seen.add(sig)
    return true
  })
}

async function collectAthleteLinks(page: Page): Promise<string[]> {
  const hrefs = await page.evaluate((selectors) => {
    const set = new Set<string>()
    for (const sel of selectors)
      document.querySelectorAll<HTMLAnchorElement>(sel).forEach((a) => set.add(a.href))
    return [...set]
  }, SCRAPE.athleteLinkSelectors)
  return hrefs.filter((h) => SCRAPE.athleteLinkUrlPattern.test(h))
}

async function main() {
  const teamUrl = process.env[SCRAPE.teamUrlEnv]
  if (!teamUrl) {
    console.error(`✗ Set ${SCRAPE.teamUrlEnv} in .env.local (the athlete-list URL).`)
    process.exit(1)
  }

  ensureDir(SESSION_DIR)
  const responses: CapturedResponse[] = []
  const context = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    viewport: { width: 1400, height: 900 },
  })
  attachCapture(context, responses)
  const page = context.pages()[0] ?? (await context.newPage())

  console.log(`▶ Opening ${teamUrl}`)
  await page.goto(teamUrl, { waitUntil: "domcontentloaded" }).catch(() => {})

  // Manual login: you authenticate in the opened window, then continue here.
  if (SCRAPE.loginUrlIncludes.some((s) => page.url().toLowerCase().includes(s))) {
    console.log("\n  A login screen is showing. Log in in the browser window…")
  }
  await prompt("\n→ When the athlete list is fully visible, press Enter here to scrape… ")

  await page.goto(teamUrl, { waitUntil: "networkidle" }).catch(() => {})
  await sleep(1000)

  const links = await collectAthleteLinks(page)
  console.log(`\n▶ Found ${links.length} athlete link(s).`)
  save("athlete-links.json", links)

  const domDir = path.join(OUT_DIR, "athletes-dom")
  ensureDir(domDir)
  let visited = 0
  for (const href of links) {
    if (visited >= MAX) break
    visited++
    console.log(`  [${visited}/${Math.min(links.length, MAX)}] ${href}`)
    try {
      await page.goto(href, { waitUntil: "networkidle", timeout: 30_000 })
      await sleep(500)
      const text = await page.evaluate(() => document.body.innerText)
      const slug = href.replace(/[^a-z0-9]+/gi, "-").slice(-80)
      fs.writeFileSync(path.join(domDir, `${slug}.txt`), text)
    } catch (e) {
      console.warn(`    ! failed: ${e instanceof Error ? e.message : e}`)
    }
    await sleep(DELAY_MS) // be polite
  }

  // Persist everything captured + a best-effort consolidated athlete array.
  save("network-responses.json", responses)
  const athletes = extractAthleteArrays(responses)
  save("athletes.json", athletes)

  console.log(
    `\n✓ Done. Captured ${responses.length} JSON response(s); ` +
      `extracted ${athletes.length} candidate athlete record(s).\n` +
      `  Review raw-backup/athletes.json + network-responses.json, calibrate\n` +
      `  config.ts if needed, then run transform.ts.`
  )
  await context.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
