import { costTracker, type LLMMessage } from "./openrouter";
import type { ToolDefinition } from "@/lib/agent/tools";

// ── Stream Chunk Types ──

export type StreamChunk =
  | { type: "text_delta"; content: string }
  | { type: "tool_call_start"; index: number; id: string; name: string }
  | { type: "tool_call_delta"; index: number; arguments: string }
  | {
      type: "done";
      content: string;
      toolCalls: AccumulatedToolCall[];
      usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    };

export interface AccumulatedToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface StreamingLLMOptions {
  messages: LLMMessage[];
  tools?: ToolDefinition[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Streaming LLM call via OpenRouter with tool support.
 * Yields typed chunks for token-by-token SSE streaming.
 * Accumulates tool_call arguments across delta chunks.
 */
export async function* callLLMStreaming(
  options: StreamingLLMOptions
): AsyncGenerator<StreamChunk> {
  const {
    messages,
    tools,
    model = "anthropic/claude-sonnet-4",
    temperature = 0.3,
    maxTokens = 4096,
  } = options;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://research-cursor.app",
    "X-OpenRouter-Title": "Research Cursor",
  };

  // Retry on 429/5xx before streaming (max 2 retries with exponential backoff)
  let response: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (response.ok) break;

    const isRetryable = response.status === 429 || response.status >= 500;
    if (!isRetryable || attempt === 2) {
      const errorBody = await response.text();
      throw new Error(`OpenRouter ${response.status}: ${errorBody}`);
    }

    const retryAfter = response.headers.get("Retry-After");
    const delay = retryAfter ? Number(retryAfter) * 1000 : 1000 * (attempt + 1);
    await new Promise((r) => setTimeout(r, delay));
  }

  if (!response) {
    throw new Error("OpenRouter streaming: no response after retries");
  }

  if (!response.body) {
    throw new Error("No response body from OpenRouter streaming");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  // Accumulators
  let fullContent = "";
  const toolCalls = new Map<number, AccumulatedToolCall>();
  let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE lines
      const lines = buffer.split("\n");
      // Keep incomplete last line in buffer
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") continue;

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }

        // Check for mid-stream errors (OpenRouter can return errors inside SSE chunks)
        if (parsed.error) {
          const err = parsed.error as Record<string, unknown>;
          throw new Error(`OpenRouter stream error: ${err.message ?? JSON.stringify(err)}`);
        }

        // Extract usage from final chunk if present
        if (parsed.usage) {
          const u = parsed.usage as Record<string, number>;
          usage = {
            promptTokens: u.prompt_tokens ?? 0,
            completionTokens: u.completion_tokens ?? 0,
            totalTokens: u.total_tokens ?? 0,
          };
        }

        const choices = parsed.choices as Array<Record<string, unknown>> | undefined;
        if (!choices || choices.length === 0) continue;

        const delta = choices[0].delta as Record<string, unknown> | undefined;
        if (!delta) continue;

        // Text content delta
        if (delta.content && typeof delta.content === "string") {
          fullContent += delta.content;
          yield { type: "text_delta", content: delta.content };
        }

        // Tool call deltas
        if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls as Array<Record<string, unknown>>) {
            const index = (tc.index as number) ?? 0;
            const fn = tc.function as Record<string, string> | undefined;

            if (!toolCalls.has(index)) {
              // New tool call start
              toolCalls.set(index, {
                id: (tc.id as string) ?? `call_${index}`,
                name: fn?.name ?? "",
                arguments: fn?.arguments ?? "",
              });
              if (fn?.name) {
                yield { type: "tool_call_start", index, id: (tc.id as string) ?? `call_${index}`, name: fn.name };
              }
            } else {
              // Accumulate argument deltas
              const existing = toolCalls.get(index)!;
              if (fn?.name && !existing.name) {
                existing.name = fn.name;
                yield { type: "tool_call_start", index, id: existing.id, name: fn.name };
              }
              if (fn?.arguments) {
                existing.arguments += fn.arguments;
                yield { type: "tool_call_delta", index, arguments: fn.arguments };
              }
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Record usage
  if (usage) {
    costTracker.record(model, usage.promptTokens, usage.completionTokens);
  }

  // Yield final done chunk
  yield {
    type: "done",
    content: fullContent,
    toolCalls: Array.from(toolCalls.values()),
    usage,
  };
}
