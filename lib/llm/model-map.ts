/**
 * Maps OpenRouter model IDs (used throughout the codebase) to OpenAI Codex equivalents.
 * All call sites continue to use OpenRouter model IDs — the Codex provider maps at the boundary.
 */

const CODEX_MODEL_MAP: Record<string, string> = {
  // Agent chat models (default: gpt-5.4)
  "google/gemini-3-flash-preview": "gpt-5.4",
  "google/gemini-3.1-pro": "gpt-5.4",
  "anthropic/claude-sonnet-4": "gpt-5.4",
  "anthropic/claude-sonnet-4.6": "gpt-5.4",
  "openai/gpt-5.4": "gpt-5.4",
  // Pipeline / lightweight models → gpt-5.4-mini
  "google/gemini-3.1-flash-lite-preview": "gpt-5.4-mini",
  "google/gemini-2.5-flash-lite": "gpt-5.4-mini",
  "google/gemini-2.5-flash": "gpt-5.4-mini",
  "openai/gpt-5.4-mini": "gpt-5.4-mini",
};

/** Codex default models for each tier */
export const CODEX_MODEL_AGENT = "gpt-5.4";
export const CODEX_MODEL_PIPELINE = "gpt-5.4-mini";

export function mapModelToCodex(openRouterModel?: string): string {
  const model = openRouterModel ?? "google/gemini-3-flash-preview";
  return CODEX_MODEL_MAP[model] ?? "gpt-5.4";
}
