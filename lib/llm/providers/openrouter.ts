import {
  RetryableRequestError,
  TimeoutError,
  retryAsync,
  withTimeout,
} from "@/lib/utils/async";
import { costTracker } from "../cost-tracker";
import type { LLMProvider } from "../provider";
import type {
  CallLLMOptions,
  LLMResponse,
  StreamingLLMOptions,
  StreamChunk,
  AccumulatedToolCall,
} from "../types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 60_000;

const OPENROUTER_HEADERS = {
  "Content-Type": "application/json",
  "HTTP-Referer": "https://research-cursor.app",
  "X-OpenRouter-Title": "Research Cursor",
};

export function createOpenRouterProvider(apiKey: string): LLMProvider {
  return {
    kind: "openrouter",

    async callLLM(options: CallLLMOptions): Promise<LLMResponse> {
      const {
        messages,
        model = "google/gemini-3-flash-preview",
        temperature = 0.3,
        maxTokens = 8192,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        jsonSchema,
      } = options;

      return retryAsync({
        retries: MAX_RETRIES,
        shouldRetry: (error) =>
          error instanceof RetryableRequestError ||
          error instanceof TimeoutError ||
          error instanceof TypeError,
        getDelayMs: (attempt) => 1000 * attempt,
        operation: async () => {
          const start = Date.now();
          const body: Record<string, unknown> = {
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
          };

          if (jsonSchema) {
            body.response_format = {
              type: "json_schema",
              json_schema: {
                name: jsonSchema.name,
                strict: true,
                schema: jsonSchema.schema,
              },
            };
          }

          const response = await withTimeout(
            (signal) =>
              fetch(OPENROUTER_URL, {
                method: "POST",
                headers: {
                  ...OPENROUTER_HEADERS,
                  Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify(body),
                signal,
              }),
            timeoutMs,
            `OpenRouter timed out (${model}) after ${Math.round(timeoutMs / 1000)}s`
          );

          if (!response.ok) {
            const errorBody = await response.text();
            const message = `OpenRouter ${response.status}: ${errorBody}`;
            if (response.status === 429 || response.status >= 500) {
              throw new RetryableRequestError(message);
            }
            throw new Error(message);
          }

          const data = await response.json();
          const latencyMs = Date.now() - start;

          const content = data.choices?.[0]?.message?.content ?? "";
          const promptTokens = data.usage?.prompt_tokens ?? 0;
          const completionTokens = data.usage?.completion_tokens ?? 0;

          costTracker.record(data.model ?? model, promptTokens, completionTokens);

          return {
            content,
            model: data.model ?? model,
            usage: {
              promptTokens,
              completionTokens,
              totalTokens: data.usage?.total_tokens ?? 0,
            },
            latencyMs,
          };
        },
      });
    },

    async *callLLMStreaming(
      options: StreamingLLMOptions
    ): AsyncGenerator<StreamChunk> {
      const {
        messages,
        tools,
        model = "anthropic/claude-sonnet-4",
        temperature = 0.3,
        maxTokens = 4096,
      } = options;

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
        ...OPENROUTER_HEADERS,
        Authorization: `Bearer ${apiKey}`,
      };

      // Retry on 429/5xx before streaming
      let response: Response | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        response = await fetch(OPENROUTER_URL, {
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
        const delay = retryAfter
          ? Number(retryAfter) * 1000
          : 1000 * (attempt + 1);
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

      let fullContent = "";
      const toolCalls = new Map<number, AccumulatedToolCall>();
      let usage:
        | {
            promptTokens: number;
            completionTokens: number;
            totalTokens: number;
          }
        | undefined;
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
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

            if (parsed.error) {
              const err = parsed.error as Record<string, unknown>;
              throw new Error(
                `OpenRouter stream error: ${err.message ?? JSON.stringify(err)}`
              );
            }

            if (parsed.usage) {
              const u = parsed.usage as Record<string, number>;
              usage = {
                promptTokens: u.prompt_tokens ?? 0,
                completionTokens: u.completion_tokens ?? 0,
                totalTokens: u.total_tokens ?? 0,
              };
            }

            const choices = parsed.choices as
              | Array<Record<string, unknown>>
              | undefined;
            if (!choices || choices.length === 0) continue;

            const delta = choices[0].delta as
              | Record<string, unknown>
              | undefined;
            if (!delta) continue;

            if (delta.content && typeof delta.content === "string") {
              fullContent += delta.content;
              yield { type: "text_delta", content: delta.content };
            }

            if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls as Array<
                Record<string, unknown>
              >) {
                const index = (tc.index as number) ?? 0;
                const fn = tc.function as
                  | Record<string, string>
                  | undefined;

                if (!toolCalls.has(index)) {
                  toolCalls.set(index, {
                    id: (tc.id as string) ?? `call_${index}`,
                    name: fn?.name ?? "",
                    arguments: fn?.arguments ?? "",
                  });
                  if (fn?.name) {
                    yield {
                      type: "tool_call_start",
                      index,
                      id: (tc.id as string) ?? `call_${index}`,
                      name: fn.name,
                    };
                  }
                } else {
                  const existing = toolCalls.get(index)!;
                  if (fn?.name && !existing.name) {
                    existing.name = fn.name;
                    yield {
                      type: "tool_call_start",
                      index,
                      id: existing.id,
                      name: fn.name,
                    };
                  }
                  if (fn?.arguments) {
                    existing.arguments += fn.arguments;
                    yield {
                      type: "tool_call_delta",
                      index,
                      arguments: fn.arguments,
                    };
                  }
                }
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      if (usage) {
        costTracker.record(model, usage.promptTokens, usage.completionTokens);
      }

      yield {
        type: "done",
        content: fullContent,
        toolCalls: Array.from(toolCalls.values()),
        usage,
      };
    },
  };
}
