// Prompt + schema for coach reply drafting. The model returns ONLY a short
// reply string as JSON { reply }. This is a DRAFT the coach edits before
// sending — it is never sent automatically.

export const DRAFT_PROMPT_VERSION = "v1"

export const DRAFT_SYSTEM = `You draft a short reply that a strength & endurance coach could send to their athlete, written in the coach's own voice.

Hard rules:
- This is a DRAFT ONLY. It is never sent automatically — the coach reviews and edits it first.
- NEVER give medical advice. For injuries, pain, or illness: acknowledge it, ask one clarifying question, and suggest seeing a professional if it's serious.
- Never invent numbers, prescriptions, or facts the coach didn't state.
- Keep it concise (1–3 sentences), warm, and practical. Match the tone of the provided example messages when available.

Return JSON: { "reply": "<the drafted message>" }.`

export const DRAFT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply"],
  properties: { reply: { type: "string" } },
} as const

export interface DraftPromptContext {
  athleteFirstName?: string | null
  messageBody: string
  /** Short labels of what the system read in the message (for the coach). */
  suggestionSummaries?: string[]
  /** Recent OUTBOUND coach messages, used purely as voice/style examples. */
  voiceExamples?: string[]
}

const firstName = (n?: string | null) => (n ? n.split(/\s+/)[0] : null)

// Injury / medical language → a cautious, non-advisory reply.
const INJURY_RE =
  /\b(injur\w*|pain|hurts?|tweaked|strain\w*|sprain\w*|pulled|sore|sharp|swollen|swelling|concussion|sick|ill)\b/i

/** Deterministic reply draft when AI is off/capped/unavailable. Pure + testable.
 *  A sensible coaching-voice starting point the coach edits before sending. */
export function draftReplyTemplate(ctx: DraftPromptContext): string {
  const hi = firstName(ctx.athleteFirstName)
  const greeting = hi ? `Hey ${hi},` : "Hey,"
  const summaries = (ctx.suggestionSummaries ?? []).map((s) => s.toLowerCase())
  const has = (kw: string) => summaries.some((s) => s.includes(kw))

  let body: string
  if (INJURY_RE.test(ctx.messageBody) || has("injury") || has("pain")) {
    body =
      "thanks for letting me know — let's be smart about this. How's it feeling now, and did anything specific set it off? We'll adjust your week around it, and if it's sharp or not improving please get it looked at."
  } else if (has("weight") || has("body weight") || has("weigh")) {
    body = "thanks for sending your weight — got it logged. Keep the morning weigh-ins consistent and we'll adjust from there."
  } else if (has("body composition")) {
    body = "appreciate the body-comp numbers — I'll factor those into your plan and follow up with any tweaks."
  } else if (has("competition") || has("weigh-in")) {
    body = "noted the competition — I'll get it on the calendar and we'll map out the lead-up and weigh-in together."
  } else if (has("travel")) {
    body = "thanks for the heads up on travel — I'll adjust the training week around it so you don't lose momentum."
  } else if (has("nutrition") || has("diet")) {
    body = "thanks — I'll review your nutrition and get you updated targets shortly."
  } else if (has("hydration")) {
    body = "good call flagging that — let's tighten up hydration and electrolytes. I'll send specifics."
  } else {
    body = "thanks for the update — I'll take a look and follow up shortly."
  }
  return `${greeting} ${body}`
}

export function buildDraftUserPrompt(ctx: DraftPromptContext): string {
  const name = ctx.athleteFirstName ? ` (first name: ${ctx.athleteFirstName})` : ""
  const examples = (ctx.voiceExamples ?? []).filter((t) => t && t.trim()).slice(0, 5)
  const voice = examples.length
    ? `\n\nThe coach's own recent messages (match this voice/tone):\n${examples
        .map((t) => `- ${t.replace(/\s+/g, " ").trim().slice(0, 240)}`)
        .join("\n")}`
    : ""
  const signals = (ctx.suggestionSummaries ?? []).filter(Boolean)
  const context = signals.length ? `\n\nWhat the athlete's message appears to contain: ${signals.join("; ")}.` : ""
  return `Draft a reply to this athlete${name}.${context}${voice}\n\nAthlete's message:\n"""\n${ctx.messageBody}\n"""`
}
