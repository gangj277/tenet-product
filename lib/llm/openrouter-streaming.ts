// Re-export shared types for backward compatibility
export type {
  StreamChunk,
  AccumulatedToolCall,
  StreamingLLMOptions,
} from "./types";

import type { StreamingLLMOptions, StreamChunk } from "./types";
import { getDefaultOpenRouterProvider } from "./openrouter";

/**
 * Streaming LLM call via the default OpenRouter provider.
 * Backward-compatible wrapper — new code should use provider.callLLMStreaming() directly.
 */
export async function* callLLMStreaming(
  options: StreamingLLMOptions
): AsyncGenerator<StreamChunk> {
  yield* getDefaultOpenRouterProvider().callLLMStreaming(options);
}
