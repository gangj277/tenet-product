import { costTracker } from "../cost-tracker";
import { mapModelToCodex } from "../model-map";
import { refreshAccessToken } from "@/lib/auth/openai-oauth";
import type { LLMProvider } from "../provider";
import type {
  CallLLMOptions,
  LLMResponse,
  StreamingLLMOptions,
  StreamChunk,
  AccumulatedToolCall,
} from "../types";

const CODEX_BASE_URL = "https://chatgpt.com/backend-api/wham";
const COMPLETIONS_PATH = "/v1/chat/completions";

export interface CodexCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix ms
  accountId: string;
}

type OnTokenRefresh = (newCreds: CodexCredentials) => Promise<void>;

export function createCodexProvider(
  credentials: CodexCredentials,
  onTokenRefresh: OnTokenRefresh
): LLMProvider {
  let creds = { ...credentials };

  async function ensureValidToken(): Promise<string> {
    const now = Date.now();
    // Refresh if less than 30 seconds remaining
    if (creds.expiresAt - now < 30_000) {
      try {
        const response = await refreshAccessToken(creds.refreshToken);
        creds = {
          accessToken: response.access_token,
          refreshToken: response.refresh_token || creds.refreshToken,
          expiresAt: Date.now() + response.expires_in * 1000,
          accountId: creds.accountId,
        };
        await onTokenRefresh(creds);
      } catch (err) {
        throw new Error(
          `Codex token refresh failed: ${err instanceof Error ? err.message : "unknown error"}. Please re-authenticate with OpenAI.`
        );
      }
    }
    return creds.accessToken;
  }

  function buildHeaders(token: string): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    if (creds.accountId) {
      headers["ChatGPT-Account-Id"] = creds.accountId;
    }
    return headers;
  }

  return {
    kind: "codex",

    async callLLM(options: CallLLMOptions): Promise<LLMResponse> {
      const token = await ensureValidToken();
      const model = mapModelToCodex(options.model);

      const {
        messages,
        temperature = 0.3,
        maxTokens = 8192,
        reasoningEffort,
        jsonSchema,
      } = options;

      const body: Record<string, unknown> = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      };

      if (reasoningEffort && reasoningEffort !== "none") {
        body.reasoning = { effort: reasoningEffort };
      }

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

      const start = Date.now();
      const response = await fetch(`${CODEX_BASE_URL}${COMPLETIONS_PATH}`, {
        method: "POST",
        headers: buildHeaders(token),
        body: JSON.stringify(body),
      });

      if (response.status === 401) {
        // Token might have expired mid-flight — retry once
        const freshToken = await ensureValidToken();
        const retryResponse = await fetch(
          `${CODEX_BASE_URL}${COMPLETIONS_PATH}`,
          {
            method: "POST",
            headers: buildHeaders(freshToken),
            body: JSON.stringify(body),
          }
        );
        if (!retryResponse.ok) {
          const errorBody = await retryResponse.text();
          throw new Error(`Codex ${retryResponse.status}: ${errorBody}`);
        }
        const data = await retryResponse.json();
        return parseCompletionResponse(data, model, Date.now() - start);
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Codex ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      return parseCompletionResponse(data, model, Date.now() - start);
    },

    async *callLLMStreaming(
      options: StreamingLLMOptions
    ): AsyncGenerator<StreamChunk> {
      const token = await ensureValidToken();
      const model = mapModelToCodex(options.model);

      const {
        messages,
        tools,
        temperature = 0.3,
        maxTokens = 4096,
        reasoningEffort,
      } = options;

      const body: Record<string, unknown> = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      };

      if (reasoningEffort && reasoningEffort !== "none") {
        body.reasoning = { effort: reasoningEffort };
      }

      if (tools && tools.length > 0) {
        body.tools = tools;
        body.tool_choice = "auto";
      }

      const response = await fetch(`${CODEX_BASE_URL}${COMPLETIONS_PATH}`, {
        method: "POST",
        headers: buildHeaders(token),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Codex streaming ${response.status}: ${errorBody}`);
      }

      if (!response.body) {
        throw new Error("No response body from Codex streaming");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let fullContent = "";
      const toolCalls = new Map<number, AccumulatedToolCall>();
      let usage:
        | { promptTokens: number; completionTokens: number; totalTokens: number }
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
                `Codex stream error: ${err.message ?? JSON.stringify(err)}`
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
              for (const tc of delta.tool_calls as Array<Record<string, unknown>>) {
                const index = (tc.index as number) ?? 0;
                const fn = tc.function as Record<string, string> | undefined;

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

function parseCompletionResponse(
  data: Record<string, unknown>,
  requestedModel: string,
  latencyMs: number
): LLMResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const choices = data.choices as any[];
  const content = choices?.[0]?.message?.content ?? "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usage = data.usage as Record<string, any> | undefined;
  const promptTokens = usage?.prompt_tokens ?? 0;
  const completionTokens = usage?.completion_tokens ?? 0;

  const model = (data.model as string) ?? requestedModel;
  costTracker.record(model, promptTokens, completionTokens);

  return {
    content,
    model,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens: usage?.total_tokens ?? 0,
    },
    latencyMs,
  };
}
