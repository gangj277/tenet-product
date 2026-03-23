import type { CallLLMOptions, LLMResponse, StreamingLLMOptions, StreamChunk } from "./types";

/**
 * An LLM provider encapsulates how to make completion calls.
 * Two implementations: OpenRouter (BYOK) and Codex (ChatGPT OAuth).
 */
export interface LLMProvider {
  readonly kind: "openrouter" | "codex";
  callLLM(options: CallLLMOptions): Promise<LLMResponse>;
  callLLMStreaming(options: StreamingLLMOptions): AsyncGenerator<StreamChunk>;
}
