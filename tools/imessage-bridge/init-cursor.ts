// Initialize the sync cursor to the CURRENT latest Messages ROWID, so the first
// `bridge:sync` starts from now forward and never backfills old iMessages.
//
// Local-only: reads chat.db read-only and writes ~/.coachos-bridge/state.json.
// Uploads nothing and needs no token/URL. Safe to rerun — overwriting an
// existing cursor requires an interactive [y/N] confirmation or --force.

import readline from "node:readline"

import { resolvePaths } from "./config"
import { readState, writeState } from "./state"
import { maxRowId } from "./chatdb"

function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (ans) => {
      rl.close()
      resolve(/^y(es)?$/i.test(ans.trim()))
    })
  })
}

async function main() {
  const force = process.argv.includes("--force")
  const { chatDbPath, statePath } = resolvePaths()

  const existing = readState(statePath)
  const max = maxRowId(chatDbPath)

  if (existing.lastRowId > 0 && !force) {
    console.log(
      `A cursor already exists: ROWID ${existing.lastRowId} (last sync ${existing.lastSyncedAt ?? "never"}).`
    )
    if (process.stdin.isTTY) {
      const ok = await confirm(`Overwrite and set cursor to current max ROWID ${max}? [y/N] `)
      if (!ok) {
        console.log("Aborted. Cursor unchanged.")
        return
      }
    } else {
      console.error(
        `Refusing to overwrite without confirmation. Re-run with --force to set the cursor to ${max}.`
      )
      process.exit(2)
    }
  }

  writeState(statePath, { lastRowId: max, lastSyncedAt: new Date().toISOString() })
  console.log(
    `Cursor initialized to ROWID ${max}. The next 'bridge:sync' will only process ` +
      `messages after this point — no backfill. (Nothing was uploaded.)`
  )
}

main().catch((e) => {
  console.error("init-cursor error:", e instanceof Error ? e.message : e)
  process.exit(1)
})
