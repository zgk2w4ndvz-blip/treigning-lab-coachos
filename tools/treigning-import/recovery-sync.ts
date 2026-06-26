// ============================================================================
// recovery-sync.ts — TreigningLab recovery connector (LOCAL agent).
//
// Runs on your machine (like the iMessage bridge): opens the persistent,
// already-logged-in browser profile, loads the team view to capture the app's
// authenticated GetAthleteAvatars JSON (read-only GET), normalizes each athlete
// to a recovery sample (HRV, resting HR, recovery score, hydration, anomalies),
// and POSTs them to CoachOS /api/recovery/ingest. The server matches athletes
// and creates PENDING suggested_actions — nothing is auto-written.
//
//   npx tsx tools/treigning-import/recovery-sync.ts            (real sync)
//   npx tsx tools/treigning-import/recovery-sync.ts --dry-run  (preview only)
//
// Secrets: the bridge bearer token is read from BRIDGE_TOKEN or
// ~/.coachos-bridge/bridge_token — NEVER hardcoded. TreigningLab auth lives in
// the browser profile on disk; no credentials are read or stored by this script.
//
// SECURITY: this whitelists ONLY recovery/identity fields from the athlete
// records. It never reads, forwards, or stores Firebase auth / users[] /
// passwordHash data, even though the app fetches it elsewhere.
// ============================================================================

import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { chromium, type BrowserContext } from "playwright"

const SESSION_DIR =
  process.env.TREIGNING_USER_DATA_DIR ?? path.join(__dirname, ".session")
const DRY_RUN = process.argv.includes("--dry-run")
const CONNECTOR = "treigninglab"
const INGEST_URL =
  process.env.RECOVERY_INGEST_URL ??
  `${(process.env.COACHOS_APP_URL ?? "https://portal.treigninglaboklahoma.com").replace(/\/$/, "")}/api/recovery/ingest`

// The team biometric endpoint that carries per-athlete recovery fields.
const AVATAR_URL_HINT = "athleteavatar"

interface RecoverySample {
  connector: string
  external: { id?: string | null; email?: string | null; phone?: string | null; name?: string | null }
  date: string
  metrics: Record<string, number | boolean | null>
  measuredAt?: string | null
}

function bridgeToken(): string {
  const fromEnv = process.env.BRIDGE_TOKEN?.trim()
  if (fromEnv) return fromEnv
  const file = path.join(os.homedir(), ".coachos-bridge", "bridge_token")
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim()
  throw new Error("No bridge token: set BRIDGE_TOKEN or ~/.coachos-bridge/bridge_token")
}

const numOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null
const boolOrNull = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null)
const strOrNull = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null

function dateOf(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === "string" && /^\d{4}-\d{2}-\d{2}/.test(c)) return c.slice(0, 10)
    const t = typeof c === "string" ? Date.parse(c) : NaN
    if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10)
  }
  return new Date().toISOString().slice(0, 10)
}

/** Whitelist ONLY recovery + identity fields. Never touches auth/users data. */
function toSample(a: Record<string, unknown>): RecoverySample | null {
  const id = strOrNull(a.Id) ?? strOrNull(a.UserId)
  if (!id) return null
  const metrics: Record<string, number | boolean | null> = {
    recoveryScore: numOrNull(a.Recovery),
    hrvRmssd: numOrNull(a.RrmssdssAvg),
    restingHr: numOrNull(a.RHR),
    hydration: numOrNull(a.Hydration),
    hydrationStandard: numOrNull(a.HydrationStandard),
    hrvAnomaly: boolOrNull(a.DailyHrvAnomaly),
    trendHrvAnomaly: boolOrNull(a.TrendHrvAnomaly),
    mentalHealthAnomaly: boolOrNull(a.MentalHealthAnomaly),
  }
  // Drop samples with no recovery signal at all.
  if (Object.values(metrics).every((v) => v == null)) return null
  return {
    connector: CONNECTOR,
    external: { id, name: strOrNull(a.Name), email: strOrNull(a.Email), phone: strOrNull(a.Phone) },
    date: dateOf(a.ReportDateTime, a.Modified, a.Updated),
    metrics,
    measuredAt: strOrNull(a.ReportDateTime) ?? strOrNull(a.Modified),
  }
}

function attachAvatarCapture(context: BrowserContext, sink: Record<string, unknown>[]) {
  context.on("response", async (res) => {
    if (!res.url().toLowerCase().includes(AVATAR_URL_HINT)) return
    if (!(res.headers()["content-type"] ?? "").includes("application/json")) return
    try {
      const body = await res.json()
      const arr = Array.isArray(body) ? body : Array.isArray((body as { data?: unknown }).data) ? (body as { data: unknown[] }).data : []
      for (const item of arr) if (item && typeof item === "object") sink.push(item as Record<string, unknown>)
    } catch {
      /* ignore non-JSON */
    }
  })
}

async function main() {
  const token = bridgeToken() // resolve early so we fail before opening a browser
  const teamUrl = process.env.TREIGNING_TEAM_URL
  fs.mkdirSync(SESSION_DIR, { recursive: true })
  const captured: Record<string, unknown>[] = []
  const context = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    viewport: { width: 1400, height: 900 },
  })
  attachAvatarCapture(context, captured)
  const page = context.pages()[0] ?? (await context.newPage())

  if (teamUrl) {
    console.log(`▶ Opening ${teamUrl}`)
    await page.goto(teamUrl, { waitUntil: "networkidle" }).catch(() => {})
  } else {
    console.log("▶ Browser open. Log in and open the team/athlete-list view.")
  }
  // Give the app a moment to fire the avatar XHR (and allow manual login).
  await page.waitForTimeout(6000)

  // De-dupe athlete records by Id, then normalize (recovery fields only).
  const byId = new Map<string, Record<string, unknown>>()
  for (const a of captured) {
    const key = String(a.Id ?? a.UserId ?? "")
    if (key) byId.set(key, a)
  }
  const samples = [...byId.values()].map(toSample).filter((s): s is RecoverySample => s !== null)
  await context.close()

  console.log(`Captured ${byId.size} athlete record(s) → ${samples.length} recovery sample(s).`)
  if (samples.length === 0) {
    console.error("✗ No recovery samples captured. Make sure you're logged in and the team view loaded.")
    process.exit(1)
  }

  const res = await fetch(INGEST_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ connector: CONNECTOR, dryRun: DRY_RUN, samples }),
  })
  const out = await res.json().catch(() => ({}))
  console.log(`\n${DRY_RUN ? "[dry-run] " : ""}POST ${INGEST_URL} → ${res.status}`)
  console.log(JSON.stringify(out, null, 2))
  if (!res.ok) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
