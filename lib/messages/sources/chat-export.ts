// ============================================================================
// Chat-export adapter — WhatsApp / SMS / iMessage text transcripts → messages.
// Pure + unit-testable. Handles the common WhatsApp "_chat.txt" line formats
// and dash-separated SMS/iMessage style exports; multi-line messages continue
// until the next timestamped line.
// ============================================================================

import type { ParsedMessage } from "@/lib/messages/parse"
import type { MessageSource } from "@/types/database"

// A new message line, in either of WhatsApp's two common shapes:
//   [2/14/26, 8:01:23 AM] Jordan Vance: text
//   2/14/26, 20:01 - Jordan Vance: text
const BRACKET = /^\[(.+?)\]\s+([^:]{1,80}):\s?(.*)$/
const DASH = /^(\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[APap][Mm])?)\s+-\s+([^:]{1,80}):\s?(.*)$/
// A line that starts with a timestamp but has no "Name:" — a system notice
// (e.g. "Messages and calls are end-to-end encrypted"). Ends the current message.
const TS_PREFIX = /^(\[.+?\]\s|\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4},?\s+\d{1,2}:\d{2})/

const SKIP_BODIES = new Set(["<media omitted>", "image omitted", "video omitted", "null", "this message was deleted", "missed voice call", "missed video call"])

/** Remove WhatsApp's invisible LTR/RTL direction marks. */
function stripMarks(s: string): string {
  return s.replace(/[‎‏‪-‮]/g, "").trim()
}

function toIso(ts: string): string | null {
  const cleaned = ts.replace(/[ ‎]/g, " ").trim()
  const t = Date.parse(cleaned)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

interface Draft {
  timestamp: string
  sender: string
  lines: string[]
}

/** Parse a WhatsApp / SMS / iMessage text export into ParsedMessage[]. */
export function parseChatExport(text: string, source: MessageSource = "whatsapp"): ParsedMessage[] {
  const lines = (text ?? "").replace(/\r\n/g, "\n").split("\n")
  const drafts: Draft[] = []
  let current: Draft | null = null

  for (const line of lines) {
    const m = line.match(BRACKET) ?? line.match(DASH)
    if (m) {
      if (current) drafts.push(current)
      current = { timestamp: m[1].trim(), sender: m[2].trim(), lines: [m[3] ?? ""] }
    } else if (TS_PREFIX.test(line)) {
      // Timestamped system notice (no "Name:") — ends the current message.
      if (current) drafts.push(current)
      current = null
    } else if (current) {
      current.lines.push(line) // continuation of a multi-line message
    }
    // Lines before the first timestamp (export headers) are ignored.
  }
  if (current) drafts.push(current)

  const out: ParsedMessage[] = []
  for (const d of drafts) {
    const body = stripMarks(d.lines.join("\n"))
    if (!body || SKIP_BODIES.has(body.toLowerCase())) continue
    // A sender that looks like a phone number populates senderPhone; else name.
    const isPhone = /^[+()\d][\d()\s.-]{5,}$/.test(d.sender)
    out.push({
      source,
      externalId: null,
      senderName: isPhone ? null : d.sender,
      senderPhone: isPhone ? d.sender : null,
      senderEmail: null,
      body,
      receivedAt: toIso(d.timestamp),
    })
  }
  return out
}
