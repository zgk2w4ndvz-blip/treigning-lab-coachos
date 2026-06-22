// Tests for the inbox grouping helpers. Run: `npm run test:groupinbox` (tsx).

import assert from "node:assert/strict"

import { groupByMessage, uniqueByMessage, messageKeyOf } from "@/lib/messages/group-inbox"
import type { ReviewQueueItem } from "@/types/models"

let n = 0
function item(over: Partial<ReviewQueueItem>): ReviewQueueItem {
  return {
    id: `s-${++n}`,
    domain: "training",
    intent: null,
    suggestedProtocol: "Review training block; adjust session/load.",
    confidence: 0.6,
    sensitive: false,
    status: "pending",
    clientId: "c-julian",
    athleteName: "Julian Ramirez",
    matchMethod: "phone",
    matchConfidence: 0.95,
    source: "imessage",
    senderLabel: "+17862622180",
    messageSnippet: "feeling sore and dehydrated, weighed 171",
    receivedAt: "2026-06-20T12:00:00Z",
    createdAt: "2026-06-20T12:00:00Z",
    messageId: "m-1",
    ...over,
  }
}

// 1. One message → two domains collapses to ONE group with both actions.
{
  const hydration = item({ id: "h1", domain: "hydration", messageId: "m-1" })
  const recovery = item({ id: "r1", domain: "recovery", messageId: "m-1" })
  const groups = groupByMessage([hydration, recovery])
  assert.equal(groups.length, 1, "one message → one group")
  assert.equal(groups[0].actions.length, 2, "group holds both actions")
  assert.deepEqual(
    groups[0].actions.map((a) => a.domain).sort(),
    ["hydration", "recovery"],
    "both domains present"
  )
  // Each action keeps its own id so per-action approve/deny still targets it.
  assert.deepEqual(groups[0].actions.map((a) => a.id), ["h1", "r1"])
  // Sensitivity bubbles up if any action is sensitive.
  const withSensitive = groupByMessage([
    item({ id: "a", messageId: "m-x", sensitive: false }),
    item({ id: "b", messageId: "m-x", sensitive: true }),
  ])
  assert.equal(withSensitive[0].sensitive, true, "group sensitive if any action is")
}

// 2. Two different messages with identical protocol text stay as TWO groups.
{
  const a = item({ id: "a1", messageId: "m-A", suggestedProtocol: "Review training block; adjust session/load." })
  const b = item({ id: "b1", messageId: "m-B", suggestedProtocol: "Review training block; adjust session/load." })
  const groups = groupByMessage([a, b])
  assert.equal(groups.length, 2, "distinct messages → two groups even with same protocol")
}

// 3. Composite fallback: items without ids group by natural message fields.
{
  const base = { messageId: undefined, sourceMessageId: undefined }
  const a = item({ id: "x", domain: "hydration", ...base })
  const b = item({ id: "y", domain: "recovery", ...base }) // same snippet/sender/time
  const c = item({ id: "z", ...base, messageSnippet: "different message entirely" })
  const groups = groupByMessage([a, b, c])
  assert.equal(groups.length, 2, "same natural fields group; different snippet splits")
  assert.equal(messageKeyOf(a), messageKeyOf(b), "composite keys match for same message")
  // sourceMessageId is used when messageId is absent.
  const s1 = item({ id: "s", messageId: undefined, sourceMessageId: "GUID-1" })
  const s2 = item({ id: "t", messageId: undefined, sourceMessageId: "GUID-1", domain: "diet" })
  assert.equal(groupByMessage([s1, s2]).length, 1, "groups by sourceMessageId")
}

// 4. uniqueByMessage keeps one representative per message (for Recent Messages).
{
  const a = item({ id: "a", messageId: "m-1", domain: "hydration" })
  const b = item({ id: "b", messageId: "m-1", domain: "recovery" })
  const c = item({ id: "c", messageId: "m-2" })
  const unique = uniqueByMessage([a, b, c])
  assert.equal(unique.length, 2, "two messages → two rows (not three)")
  assert.deepEqual(unique.map((i) => i.id), ["a", "c"], "keeps first occurrence per message")
}

// Order of first appearance is preserved across groups.
{
  const groups = groupByMessage([
    item({ id: "1", messageId: "m-2" }),
    item({ id: "2", messageId: "m-1" }),
    item({ id: "3", messageId: "m-2" }),
  ])
  assert.deepEqual(groups.map((g) => g.key), ["m-2", "m-1"], "first-seen order preserved")
}

console.log("✓ group-inbox: grouping, dedupe, composite-key, and ordering assertions passed")
