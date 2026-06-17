// ============================================================================
// analyzeMessage — single entry point the ingest pipeline calls per message.
//
// Combines the structured extractor (extract.ts) with the coarse keyword
// classifier (classify.ts). The extractor wins per-domain: if it produced a
// precise, pre-labelled signal for a domain (e.g. a body-weight report), the
// classifier's generic suggestion for that same domain is dropped so the coach
// doesn't see a duplicate. Pure; no I/O.
// ============================================================================

import { classifyMessage, type ClassifiedSuggestion } from "@/lib/messages/classify"
import { extractSignals, type ExtractOptions } from "@/lib/messages/extract"

/** Structured signals first, then any non-overlapping domain suggestions. */
export function analyzeMessage(body: string, opts: ExtractOptions = {}): ClassifiedSuggestion[] {
  const structured = extractSignals(body, opts)
  const covered = new Set(structured.map((s) => s.domain))
  const generic = classifyMessage(body).filter((s) => !covered.has(s.domain))
  return [...structured, ...generic].sort((a, b) => b.confidence - a.confidence)
}
