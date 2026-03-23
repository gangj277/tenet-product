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

function getDefaultProvider(): LLMProvider {
  if (!_defaultProvider) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");
    _defaultProvider = createOpenRouterProvider(apiKey);
  }
  return _defaultProvider;
}

/** Get the default server-level provider (for use in provider-factory) */
export function getDefaultOpenRouterProvider(): LLMProvider {
  return getDefaultProvider();
}

export async function callLLM(options: CallLLMOptions): Promise<LLMResponse> {
  return getDefaultProvider().callLLM(options);
}

export async function callLLMJson<T = unknown>(
  options: CallLLMOptions
): Promise<{ data: T; raw: LLMResponse }> {
  return callLLMJsonWith<T>(getDefaultProvider(), options);
}
