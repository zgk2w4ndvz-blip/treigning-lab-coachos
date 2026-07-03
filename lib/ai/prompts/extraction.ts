// Prompt builder for message extraction. Pure string builders (versioned).
// The model returns ONLY structured JSON matching AI_EXTRACTION_JSON_SCHEMA.

export const EXTRACTION_PROMPT_VERSION = "v1"

export const EXTRACTION_SYSTEM = `You extract structured coaching signals from a single text message between a strength/endurance coach and an athlete. You NEVER give medical advice and NEVER invent values — extract only what is explicitly stated.

Return a list of suggestions. Each is one of these actions:
- create_weight_log: the athlete's body weight(s). Put each reading in fields.entries with label morning/evening/general and weightLbs.
- body_composition_update: InBody-style readings (PBF, SMM, fat mass, total body water, BMR).
- metabolic_assessment: VO2max, crossover point (mep_bpm), lactate/aerobic threshold (aerobic_threshold_bpm), max HR.
- nutrition_prescription: calorie/macro targets (calories, protein_g, carbs_g, fat_g).
- low_base_prescription: Low Base dose (minutes_per_session, frequency_per_week).
- observation: recovery issues, injuries/pain (set sensitive=true), schedule changes, or other coaching-relevant notes with no structured numbers.

Rules:
- Only emit a suggestion when the message clearly contains that signal. If nothing relevant, return an empty list.
- Set every unused numeric field to null. Do not guess.
- "went from X to Y" → use the NEW value (Y).
- confidence is 0..1. Mark injuries/pain sensitive=true.
- protocol is a short imperative summary for the coach to review (never an instruction sent to the athlete).`

export interface ExtractionContext {
  direction: "incoming" | "outgoing"
  athleteFirstName?: string | null
  /** Recent prior messages from the same thread, most-recent first — lets the
   *  model resolve an isolated reply against the conversation. */
  recentTexts?: string[]
}

export function buildExtractionUserPrompt(body: string, ctx: ExtractionContext): string {
  const who =
    ctx.direction === "outgoing"
      ? "This is an OUTBOUND message FROM the coach (may contain prescriptions/assessments)."
      : "This is an INBOUND message FROM the athlete (may contain self-reported readings/issues)."
  const name = ctx.athleteFirstName ? ` Athlete first name: ${ctx.athleteFirstName}.` : ""
  // Conversation memory: give the model the recent thread (oldest → newest) so an
  // ambiguous message ("129.7", "same as yesterday") is read in context. Only the
  // final message is extracted; earlier lines are context, not new signals.
  const recent = (ctx.recentTexts ?? []).filter((t) => t && t.trim()).slice(0, 6)
  const thread = recent.length
    ? `\n\nRecent thread (older → newer, CONTEXT ONLY — do not extract from these):\n${recent
        .slice()
        .reverse()
        .map((t) => `- ${t.replace(/\s+/g, " ").trim().slice(0, 240)}`)
        .join("\n")}`
    : ""
  return `${who}${name}${thread}\n\nMessage to extract (the newest message):\n"""\n${body}\n"""`
}
