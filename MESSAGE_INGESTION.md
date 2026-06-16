# CoachOS Message Ingestion

How athlete messages become **coach-reviewed** suggestions — and the design for
an optional, local-only Mac iMessage bridge.

> **Nothing is ever written to an athlete's record automatically.** Every signal
> extracted from a message becomes a *pending* suggestion that a coach must
> approve. This is enforced in `lib/actions/inbox.ts` (`reviewSuggestionAction`).

---

## Pipeline (today)

```
message text
  → parse        (lib/messages/parse.ts  — CSV / JSON / iMessage / WhatsApp transcript)
  → match        (lib/messages/match.ts  — phone → email → name)
  → analyze      (lib/messages/analyze.ts = extract.ts + classify.ts)
  → suggested_actions (status 'pending')
  → COACH REVIEW (approve / edit / reject)
       ├─ weight report  → weight_logs row(s)        (details.action = create_weight_log)
       └─ everything else → prescription + coach task
```

### What the analyzer detects (`lib/messages/extract.ts`)

| Signal | Domain | On approval |
|---|---|---|
| Morning / evening / body weight | `body_composition` | **suggested `weight_logs` entries** |
| Supplement compliance (took / missed) | `supplementation` | prescription + task (sensitive) |
| Hydration | `hydration` | prescription + task |
| AltoLab usage | `altolab` | prescription + task |
| Low Base completion | `low_base` | prescription + task |
| Recovery notes (sleep/soreness/fatigue) | `recovery` | prescription + task |
| Injury / pain | `recovery` | prescription + task (sensitive, flagged for review) |
| Nutrition update | `diet` | prescription + task |

Coarser keyword classification (`classify.ts`) still runs for anything the
structured extractor doesn't cover; `analyze.ts` de-dupes by domain so the coach
never sees a structured signal and a generic one for the same domain.

**Example.** Julian Ramirez texts `"Morning weight 128.4, evening 130.1"`. After
matching Julian by phone, the inbox shows one pending **Body Composition**
suggestion. Approving it writes two `weight_logs` rows for Julian (morning @ 7:00
= 128.4 lb, evening @ 19:00 = 130.1 lb), dated from the message.

### Manual import (available now)

Coach → **Inbox → Import messages**. Paste an **iMessage** or WhatsApp transcript,
or a CSV/JSON export, then **Ingest & suggest**. iMessage/WhatsApp transcripts are
parsed by `lib/messages/sources/chat-export.ts`; the sender line attributes each
message, and matching links it to the athlete.

To copy an iMessage thread: open Messages.app, select the messages, Copy, and
paste. (A cleaner path is the Mac bridge below.)

---

## Future: optional local Mac iMessage bridge

Apple provides **no** iMessage API and **no** cloud connector — and CoachOS will
never claim one. The only correct way to ingest iMessage is a small program that
runs **on the coach's own Mac, with the coach's explicit permission**, reads the
local Messages database read-only, and pushes only the relevant snippets to
CoachOS. This section is the design; the bridge is **not built yet**.

### How it works

- A local CLI/menu-bar app (e.g. `tools/imessage-bridge/`, run by the coach).
- Reads `~/Library/Messages/chat.db` (SQLite) **read-only**. macOS requires the
  user to grant **Full Disk Access** to the runner (Terminal or the app) in
  System Settings → Privacy & Security → Full Disk Access. The user does this
  manually; the bridge cannot grant itself access.
- Loads the coach's **known athlete phone numbers / emails** from CoachOS (or a
  local allow-list) and **filters the Messages DB to only those handles**.
  Messages from anyone else never leave the Mac.
- Extracts only the **text snippet + handle + timestamp** for matched handles —
  not attachments, not unrelated threads.
- POSTs those snippets to a CoachOS ingest endpoint, which runs the exact same
  `analyze → suggested_actions (pending)` pipeline. Coach approval is still
  required for anything to be written.
- Stores a **last-synced timestamp** locally (e.g. `~/.coachos-bridge/state.json`)
  and only reads `message.date > lastSynced` on the next run, so each message is
  ingested once.

### Auth & secrets

- The bridge authenticates to CoachOS with a **scoped bridge token** (bearer),
  the same pattern as the Gmail cron (`CRON_SECRET`). Planned endpoint:
  `POST /api/ingest` guarded by `Authorization: Bearer <BRIDGE_TOKEN>` mapping to
  a single coach via an env var (e.g. `BRIDGE_COACH_ID`), reusing
  `runIngest({ coachId })`.
- **No Apple ID / iCloud credentials are ever read, stored, or transmitted.** The
  bridge only touches the local SQLite file the user already has on disk.
- The bridge token lives only on the coach's Mac (keychain or a local env file),
  never in the repo.

### State & data flow summary

| Item | Where it lives | Leaves the Mac? |
|---|---|---|
| Apple ID / iCloud password | not accessed | never |
| Full Messages database | `~/Library/Messages/chat.db` (read-only) | never |
| Messages from non-athletes | filtered out locally | never |
| Matched athlete snippets (text + handle + time) | transient | yes → CoachOS ingest |
| Last-synced timestamp | `~/.coachos-bridge/state.json` | never |
| Bridge token | local keychain / env | never (sent only as bearer to CoachOS) |

---

## Privacy & consent

- **Local, opt-in, coach-run.** The bridge only runs when the coach installs and
  starts it on their own Mac and grants Full Disk Access themselves.
- **Data minimization.** Only messages from **matched athlete handles** are read
  out; only the text snippet, handle, and timestamp are sent. No attachments, no
  unrelated conversations, no group-chat third parties.
- **No credential storage.** No Apple credentials are accessed or stored. The
  CoachOS bridge token is the only secret and stays on the Mac.
- **Coach approval is mandatory.** Ingestion only ever creates **pending**
  suggestions. Weight logs, prescriptions, and tasks are written **only** after
  the coach approves — see `reviewSuggestionAction`.
- **Athlete awareness.** Coaches should tell athletes that messages they send may
  be reviewed in CoachOS to support their programming, and honor any athlete who
  asks not to be ingested (remove their handle from the allow-list).
- **Sensitive content.** Supplement, lab, and injury/pain signals are flagged
  `sensitive` and surfaced for explicit manual review; medical content is never
  auto-actioned.

---

## Files

| File | Role |
|---|---|
| `lib/messages/parse.ts` | CSV / JSON / iMessage / WhatsApp → normalized messages |
| `lib/messages/sources/chat-export.ts` | iMessage / WhatsApp transcript parser |
| `lib/messages/match.ts` | Athlete matcher (phone → email → name) |
| `lib/messages/extract.ts` | Structured signal extractor (weights + observations) |
| `lib/messages/classify.ts` | Coarse keyword → domain classifier |
| `lib/messages/analyze.ts` | Merge of extract + classify (de-duped by domain) |
| `lib/messages/ingest.ts` | match → analyze → persist pending suggestions |
| `lib/actions/inbox.ts` | Manual import + **approval** (writes weight_logs / prescriptions) |
| `components/coach/message-import.tsx` | Coach paste/import UI |
| `tools/imessage-bridge/` | _(future)_ local Mac bridge |
