# CoachOS iMessage Bridge

A **local-only** macOS agent that reads your Messages database, keeps only the
conversations with **matched athletes**, and forwards those text snippets to
CoachOS as **pending suggestions** for your review. Apple provides no iMessage
API and no cloud connector — this runs on **your Mac, with your permission**.

> **Nothing is ever written to athlete records automatically.** The bridge only
> ever POSTs to `/api/ingest`, which creates *pending* suggestions. Weight logs,
> prescriptions, etc. are written **only after you approve** them in CoachOS.

---

## What it does (and doesn't)

**Does**
- Reads `~/Library/Messages/chat.db` **read-only** via the system `sqlite3`.
- Fetches your athlete allow-list from `GET /api/ingest/handles` **before** doing
  anything else.
- Processes **only** inbound messages whose sender's phone (last-10 match) or
  email is on the allow-list.
- Forwards text + handle + timestamp to `POST /api/ingest`.
- Tracks a local cursor so each message is processed once; idempotent across
  restarts (the server also de-dups by message GUID).

**Doesn't**
- ❌ No Apple ID / iCloud credentials are read, stored, or sent.
- ❌ Non-athlete conversations are never uploaded or stored anywhere.
- ❌ Outbound (your own) messages are ignored in v1.
- ❌ Attachments, photos, videos, reactions, and tapbacks are ignored — **text only**.
- ❌ It never writes to `weight_logs`, `prescriptions`, or any athlete table.

---

## Requirements

- macOS with **Node.js** and **sqlite3** (sqlite3 ships with macOS).
- **Full Disk Access** for whatever runs the bridge (Terminal, or the launchd
  runner) — System Settings → Privacy & Security → Full Disk Access. macOS
  requires you to grant this yourself.
- A CoachOS deploy with `BRIDGE_TOKEN` + `BRIDGE_COACH_ID` set (see the main
  `.env.local.example`), and your athletes' phone numbers/emails on their client
  records so matching works.

## Setup

```bash
# 1. one-time setup (creates ~/.coachos-bridge, stores your URL, checks deps)
COACHOS_URL=https://your-app.vercel.app bash tools/imessage-bridge/setup.sh

# 2. token — same secret you set as BRIDGE_TOKEN in Vercel (kept local, 0600)
openssl rand -base64 32 | tr -d '\n' > ~/.coachos-bridge/bridge_token
chmod 600 ~/.coachos-bridge/bridge_token
#    (if you already generated it earlier, this file may already exist)
```

Config the bridge reads (all local):

| Source | Value |
|---|---|
| `~/.coachos-bridge/config.json` `{ "url": … }` or `COACHOS_URL` | CoachOS base URL |
| `~/.coachos-bridge/bridge_token` or `BRIDGE_TOKEN` | bearer token |
| `COACHOS_CHATDB` (optional) | override chat.db path |
| `~/.coachos-bridge/state.json` | sync cursor (auto-managed) |

## Usage

```bash
npm run bridge:dry-run         # analyze + match, NOTHING persisted (server dry-run)
npm run bridge:sync            # real sync → pending suggestions for coach review

# advanced
npx tsx tools/imessage-bridge/sync.ts --since 2026-06-01   # backfill (cursor untouched)
npx tsx tools/imessage-bridge/sync.ts --verbose            # detailed logging
npx tsx tools/imessage-bridge/sync.ts --limit 1000         # messages per run (default 500)
```

### Flags
- `--dry-run` — runs the full pipeline but the server persists nothing and the
  cursor is not advanced.
- `--since <date>` — process messages on/after a date (e.g. `2026-06-01`) for a
  one-off backfill; does **not** move the steady-state cursor.
- `--verbose` / `-v` — per-step logging (counts, cursor, per-batch results).
- `--limit <n>` — max messages read per run (default 500). Catch-up happens over
  successive runs.

## Run every 5 minutes (launchd)

Edit the `REPLACE_ME` paths in `com.coachos.bridge.plist`, then:

```bash
cp tools/imessage-bridge/com.coachos.bridge.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.coachos.bridge.plist
# stop:
launchctl unload ~/Library/LaunchAgents/com.coachos.bridge.plist
```

`StartInterval` is 300s. The sync is incremental + idempotent, so a 5-minute
cadence is safe. The launchd runner also needs Full Disk Access.

## Privacy & consent

- Local, opt-in, coach-run; read-only access to a DB already on your Mac.
- **Data minimization:** only allow-listed athlete messages are read out; only
  the text snippet, handle, and timestamp are sent. No attachments, no
  non-athlete threads, no group-chat third parties.
- The only secret is the bridge token, kept on your Mac.
- Coaches should disclose to athletes that messages may be reviewed in CoachOS,
  and remove a handle from the roster to stop ingesting them.

## How sync state works

`~/.coachos-bridge/state.json` stores `{ lastRowId, lastSyncedAt }` — the highest
Messages `ROWID` processed (a number) and a timestamp. **No message content is
stored.** Each run reads `ROWID > lastRowId`. Even if the state file is lost, the
server's unique index on the message GUID prevents duplicate ingestion.

## Limitations (v1)

- **`attributedBody` decoding is best-effort.** On modern macOS the body lives in
  a typedstream blob when `text` is NULL; the bridge extracts plain text
  heuristically and skips anything it can't decode (visible with `--verbose`).
- Inbound only; SMS and iMessage both work, group messages from an athlete match
  on the sender.
- One coach per token (multi-coach supported server-side via `BRIDGE_TOKENS`).

## Files

| File | Role |
|---|---|
| `sync.ts` | entry point / orchestrator |
| `config.ts` | env + flag loading |
| `chatdb.ts` | read-only chat.db query + attributedBody decode |
| `filter.ts` | allow-list build + handle matching |
| `api.ts` | `/api/ingest/handles` + `/api/ingest` client |
| `state.ts` | local sync cursor |
| `setup.sh` | one-time local setup |
| `com.coachos.bridge.plist` | launchd example (5-min interval) |
