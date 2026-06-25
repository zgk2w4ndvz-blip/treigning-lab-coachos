import "server-only"

import Anthropic from "@anthropic-ai/sdk"

import type {
  AiProvider,
  StructuredJsonArgs,
  StructuredJsonResult,
} from "@/lib/ai/provider"

// Cache one client per API key (the key only changes across deploys, not calls).
let cached: { key: string; client: Anthropic } | null = null
function clientFor(apiKey: string): Anthropic {
  if (!cached || cached.key !== apiKey) {
    cached = { key: apiKey, client: new Anthropic({ apiKey }) }
  }
  return cached.client
}

/**
 * Anthropic (Claude Messages API) implementation of AiProvider.
 *
 * Structured output is obtained by forcing a single tool call whose
 * `input_schema` is the extraction JSON Schema: with `tool_choice` pinned to
 * that tool, Claude responds with a `tool_use` block whose `input` is the
 * structured object and no prose. We hand that object back for zod validation
 * upstream — exactly like the previous Responses-API json_schema output.
 */
export function getAnthropicProvider(apiKey: string): AiProvider {
  const client = clientFor(apiKey)
  return {
    name: "anthropic",
    async structuredJson(args: StructuredJsonArgs): Promise<StructuredJsonResult> {
      const res = await client.messages.create(
        {
          model: args.model,
          max_tokens: args.maxOutputTokens,
          system: args.system,
          tools: [
            {
              name: args.schemaName,
              description: "Return the structured extraction result.",
              input_schema: args.jsonSchema as Anthropic.Tool.InputSchema,
            },
          ],
          tool_choice: { type: "tool", name: args.schemaName },
          messages: [{ role: "user", content: args.userPrompt }],
        },
        { timeout: args.timeoutMs, maxRetries: args.maxRetries }
      )

      const promptTokens = res.usage?.input_tokens ?? 0
      const completionTokens = res.usage?.output_tokens ?? 0

      const toolUse = res.content.find((b) => b.type === "tool_use")
      const parsed =
        toolUse && toolUse.type === "tool_use" ? (toolUse.input as unknown) : null

      return { parsed, promptTokens, completionTokens }
    },
  }
}
