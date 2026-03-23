// Re-export shared types for backward compatibility
export type {
  LLMToolCall,
  ContentPart,
  LLMMessage,
  CallLLMOptions,
  LLMResponse,
} from "./types";

// Re-export cost tracker for backward compatibility
export { costTracker } from "./cost-tracker";

import type { CallLLMOptions, LLMResponse } from "./types";
import type { LLMProvider } from "./provider";
import { createOpenRouterProvider } from "./providers/openrouter";
import { callLLMJsonWith } from "./json";

// ─── Default Provider (backward-compatible thin wrappers) ────────────────────

let _defaultProvider: LLMProvider | null = null;

function getServerProvider(): LLMProvider {
  if (!_defaultProvider) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");
    _defaultProvider = createOpenRouterProvider(apiKey);
  }
  return _defaultProvider;
}

/** Get the default server-level provider (for use in provider-factory) */
export function getDefaultOpenRouterProvider(): LLMProvider {
  return getServerProvider();
}

// ─── Request-scoped provider override ────────────────────────────────────────
// Call setRequestProvider() before running engine pipeline or agent code.
// The global callLLM/callLLMJson will use it if set, falling back to server default.

let _requestProvider: LLMProvider | null = null;

/**
 * Set a per-request provider override. Call clearRequestProvider() when done.
 * This allows engine pipeline nodes to use the user's provider without
 * threading it through LangGraph state.
 */
export function setRequestProvider(provider: LLMProvider) {
  _requestProvider = provider;
}

export function clearRequestProvider() {
  _requestProvider = null;
}

function getActiveProvider(): LLMProvider {
  return _requestProvider ?? getServerProvider();
}

export async function callLLM(options: CallLLMOptions): Promise<LLMResponse> {
  return getActiveProvider().callLLM(options);
}

export async function callLLMJson<T = unknown>(
  options: CallLLMOptions
): Promise<{ data: T; raw: LLMResponse }> {
  return callLLMJsonWith<T>(getActiveProvider(), options);
}
