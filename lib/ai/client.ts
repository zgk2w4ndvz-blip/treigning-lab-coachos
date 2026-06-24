import "server-only"

import OpenAI from "openai"

import { getAiConfig } from "@/lib/ai/config"

let cached: OpenAI | null = null

/** The OpenAI client, or null when AI is disabled or no key is configured. */
export function getOpenAi(): OpenAI | null {
  const cfg = getAiConfig()
  if (!cfg.enabled || !cfg.apiKey) return null
  if (!cached) cached = new OpenAI({ apiKey: cfg.apiKey })
  return cached
}
