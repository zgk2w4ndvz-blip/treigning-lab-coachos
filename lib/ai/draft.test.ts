// Coach reply drafting — PURE pieces only (deterministic template + prompt
// builder). No live API. Run: `npm run test:aidraft`.

import assert from "node:assert/strict"

import { draftReplyTemplate, buildDraftUserPrompt } from "@/lib/ai/prompts/draft"

// ── Deterministic template picks a sensible reply per message type ────────────
{
  const weight = draftReplyTemplate({
    athleteFirstName: "Griffin",
    messageBody: "This morning I was 129.7",
    suggestionSummaries: ["Body weight report"],
  })
  assert.ok(weight.startsWith("Hey Griffin,"), "greets by first name")
  assert.ok(/weigh/i.test(weight), "weight reply mentions weighing")
}
{
  // Injury language → cautious, non-advisory, asks a question, no diagnosis.
  const injury = draftReplyTemplate({
    athleteFirstName: "Sam Nguyen",
    messageBody: "my knee is really sore and sharp when I squat",
    suggestionSummaries: ["Injury / pain report"],
  })
  assert.ok(injury.startsWith("Hey Sam,"), "uses first token of the name")
  assert.ok(/looked at|smart about this/i.test(injury), "cautious framing")
  assert.ok(injury.includes("?"), "asks a clarifying question")
}
{
  const comp = draftReplyTemplate({
    messageBody: "Wrestling July 18",
    suggestionSummaries: ["Upcoming competition"],
  })
  assert.ok(comp.startsWith("Hey,"), "no-name greeting")
  assert.ok(/calendar|competition/i.test(comp))
}
{
  const fallback = draftReplyTemplate({ messageBody: "hey coach just checking in" })
  assert.ok(/follow up/i.test(fallback), "generic fallback")
}

// ── Prompt builder includes voice examples + the message ──────────────────────
{
  const p = buildDraftUserPrompt({
    athleteFirstName: "Griffin",
    messageBody: "129.7 this morning",
    suggestionSummaries: ["Body weight report"],
    voiceExamples: ["Nice work today — keep the protein up.", "Rest up, big session tomorrow."],
  })
  assert.ok(/129\.7 this morning/.test(p), "includes the athlete message")
  assert.ok(/keep the protein up/i.test(p), "includes coach voice examples")
  assert.ok(/first name: Griffin/.test(p), "includes athlete first name")
}

console.log("✓ coach draft: template (4) + prompt builder assertions passed")
