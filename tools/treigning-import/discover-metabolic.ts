// ============================================================================
// discover-metabolic.ts — capture the REAL Treigning Lab metabolic / stat
// tracker so we can mirror its exact fields, calculations, and layout instead
// of inventing a generic dashboard.
//
// Unlike scrape.ts (which filters responses by URL and only walks the athlete
// list), this is a DISCOVERY tool: it opens a real browser with a persistent
// profile, you log in and navigate manually to the metabolic / testing pages,
// and it records EVERY JSON/XHR response plus a full snapshot of whatever page
// you're on each time you press Enter. Read-only — it only observes (GET); it
// never writes to Treigning Lab and never reads or stores your credentials.
//
//   npx tsx tools/treigning-import/discover-metabolic.ts
//   (or: npm run import:discover)
//
// Output → raw-backup/metabolic-discovery/
//   network-json.json   every application/json response (url, status, body)
//   network-urls.json   every XHR/fetch URL seen (endpoint discovery)
//   snapshot-NN.json    per-Enter page capture: url, innerText, __NEXT_DATA__,
//                       and any JSON embedded in <script> tags
//
// Privacy: this captures your own athletes' data locally. Review the files
// before sharing — for calibration I only need the FIELD NAMES / SHAPES, so you
// can redact values if you prefer.
// ============================================================================

import fs from "node:fs"
import path from "node:path"
import readline from "node:readline"

import { chromium, type BrowserContext, type Page } from "playwright"

const OUT_DIR = path.join(__dirname, "raw-backup", "metabolic-discovery")
const SESSION_DIR =
  process.env.TREIGNING_USER_DATA_DIR ?? path.join(__dirname, ".session")

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
  console.log(`  saved raw-backup/metabolic-discovery/${name}`)
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

/** Record every JSON response, plus the URL of every XHR/fetch (for discovery). */
function attachCapture(
  context: BrowserContext,
  json: CapturedResponse[],
  urls: Set<string>
) {
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

/** Snapshot the current page: text, Next.js data, and inline JSON script blobs. */
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
      innerText: document.body?.innerText ?? "",
      nextData,
      jsonScripts: scripts.filter(Boolean),
    }
  })
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
    "\n  Log in, then open an athlete's METABOLIC / stat-tracker page (the one\n" +
      "  with VO2 / MEP / thresholds / curves). Each time a metabolic view is\n" +
      "  fully loaded, come back here and press Enter to snapshot it. Visit a\n" +
      "  couple of different athletes/tests so we see the full field set.\n"
  )

  let n = 0
  for (;;) {
    const answer = await ask(
      `→ Press Enter to snapshot the current page (captured so far: ${jsonResponses.length} JSON responses), or type 'q' then Enter to finish: `
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

  console.log(
    `\n✓ Done. ${n} page snapshot(s); ${jsonResponses.length} JSON response(s); ` +
      `${urls.size} XHR/fetch URL(s).\n` +
      `  Review raw-backup/metabolic-discovery/ and share the field shapes so the\n` +
      `  metabolic module can be rebuilt to match the real tracker.`
  )
  await context.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
