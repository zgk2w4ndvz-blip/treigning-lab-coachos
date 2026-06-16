// Bridge configuration + CLI flag parsing. Local-only; reads its token and URL
// from the bridge dir (~/.coachos-bridge) or the environment. Never touches the
// app's .env.

import os from "node:os"
import path from "node:path"
import fs from "node:fs"

export interface BridgeFlags {
  dryRun: boolean
  verbose: boolean
  since: string | null // ISO date / YYYY-MM-DD — backfill mode, cursor untouched
  limit: number
}

export interface BridgeConfig {
  baseUrl: string
  token: string
  chatDbPath: string
  statePath: string
  bridgeDir: string
  flags: BridgeFlags
}

export const BRIDGE_DIR = path.join(os.homedir(), ".coachos-bridge")

function readTrim(p: string): string | null {
  try {
    return fs.readFileSync(p, "utf8").trim()
  } catch {
    return null
  }
}

export function parseFlags(argv: string[]): BridgeFlags {
  const flags: BridgeFlags = { dryRun: false, verbose: false, since: null, limit: 500 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--dry-run") flags.dryRun = true
    else if (a === "--verbose" || a === "-v") flags.verbose = true
    else if (a === "--since") flags.since = argv[++i] ?? null
    else if (a === "--limit") flags.limit = Math.max(1, Number(argv[++i] ?? "500") || 500)
  }
  return flags
}

export function loadConfig(argv: string[]): BridgeConfig {
  const flags = parseFlags(argv)

  const token =
    process.env.BRIDGE_TOKEN?.trim() || readTrim(path.join(BRIDGE_DIR, "bridge_token"))
  if (!token) {
    throw new Error(
      "Missing bridge token — set BRIDGE_TOKEN or write it to ~/.coachos-bridge/bridge_token"
    )
  }

  let baseUrl = process.env.COACHOS_URL?.trim() || null
  if (!baseUrl) {
    const cfg = readTrim(path.join(BRIDGE_DIR, "config.json"))
    if (cfg) {
      try {
        baseUrl = (JSON.parse(cfg) as { url?: string }).url?.trim() ?? null
      } catch {
        /* ignore malformed config */
      }
    }
  }
  if (!baseUrl) {
    throw new Error(
      'Missing CoachOS URL — set COACHOS_URL or ~/.coachos-bridge/config.json {"url":"https://…"}'
    )
  }

  const chatDbPath =
    process.env.COACHOS_CHATDB?.trim() ||
    path.join(os.homedir(), "Library", "Messages", "chat.db")

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    token,
    chatDbPath,
    statePath: path.join(BRIDGE_DIR, "state.json"),
    bridgeDir: BRIDGE_DIR,
    flags,
  }
}
