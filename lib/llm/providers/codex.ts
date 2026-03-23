import { costTracker } from "../cost-tracker";
import { mapModelToCodex } from "../model-map";
import { refreshAccessToken } from "@/lib/auth/openai-oauth";
import type { LLMProvider } from "../provider";
import type {
  CallLLMOptions,
  LLMResponse,
  LLMMessage,
  StreamingLLMOptions,
  StreamChunk,
  AccumulatedToolCall,
} from "../types";

const CODEX_URL = "https://chatgpt.com/backend-api/codex/responses";

export interface CodexCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix ms
  accountId: string;
}

type OnTokenRefresh = (newCreds: CodexCredentials) => Promise<void>;

// ─── Helpers: convert chat/completions format → Responses API format ─────────

function extractSystemAndInput(messages: LLMMessage[]): {
  instructions: string;
  input: Array<{ role: string; content: unknown }>;
} {
  let instructions = "You are a helpful assistant.";
  const input: Array<{ role: string; content: unknown }> = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      instructions = typeof msg.content === "string" ? msg.content : instructions;
    } else if (msg.role === "tool") {
      // Responses API uses "function_call_output" for tool results
      input.push({
        role: "function_call_output",
        content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
      });
    } else if (msg.role === "assistant" && msg.tool_calls?.length) {
      // Convert assistant tool_calls to function_call items
      for (const tc of msg.tool_calls) {
        input.push({
          role: "function_call",
          content: JSON.stringify({
            id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments,
          }),
        });
      }
      // Also include text content if present
      if (msg.content) {
        input.push({ role: "assistant", content: msg.content });
      }
    } else {
      input.push({ role: msg.role, content: msg.content ?? "" });
    }
  }

  return { instructions, input };
}

function convertToolsForResponsesAPI(
  tools?: Array<{ type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }>
): Array<Record<string, unknown>> | undefined {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    type: "function",
    name: t.function.name,
    description: t.function.description,
    parameters: t.function.parameters,
  }));
}

// ─── SSE Parser for Responses API ────────────────────────────────────────────

interface ParsedResponsesStream {
  content: string;
  toolCalls: AccumulatedToolCall[];
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  model: string;
}

async function* parseResponsesSSE(
  body: ReadableStream<Uint8Array>,
  onTextDelta?: (text: string) => void,
  onToolCallStart?: (index: number, id: string, name: string) => void,
  onToolCallDelta?: (index: number, args: string) => void,
): AsyncGenerator<{ type: string; data: Record<string, unknown> }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      let currentEvent = "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("event: ")) {
          currentEvent = trimmed.slice(7);
        } else if (trimmed.startsWith("data: ")) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            yield { type: currentEvent, data };
          } catch {
            // skip malformed data
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function createCodexProvider(
  credentials: CodexCredentials,
  onTokenRefresh: OnTokenRefresh
): LLMProvider {
  let creds = { ...credentials };

  async function ensureValidToken(): Promise<string> {
    const now = Date.now();
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

  async function makeRequest(
    token: string,
    body: Record<string, unknown>
  ): Promise<Response> {
    const response = await fetch(CODEX_URL, {
      method: "POST",
      headers: buildHeaders(token),
      body: JSON.stringify(body),
    });

    if (response.status === 401) {
      const freshToken = await ensureValidToken();
      return fetch(CODEX_URL, {
        method: "POST",
        headers: buildHeaders(freshToken),
        body: JSON.stringify(body),
      });
    }

    return response;
  }

  return {
    kind: "codex",

    async callLLM(options: CallLLMOptions): Promise<LLMResponse> {
      const token = await ensureValidToken();
      const model = mapModelToCodex(options.model);
      const { instructions, input } = extractSystemAndInput(options.messages);

      const body: Record<string, unknown> = {
        model,
        instructions,
        input,
        store: false,
        stream: true,
      };

      if (options.reasoningEffort && options.reasoningEffort !== "none") {
        body.reasoning = { effort: options.reasoningEffort };
      }

      if (options.jsonSchema) {
        body.text = {
          format: {
            type: "json_schema",
            name: options.jsonSchema.name,
            strict: true,
            schema: options.jsonSchema.schema,
          },
        };
      }

      const start = Date.now();
      const response = await makeRequest(token, body);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Codex ${response.status}: ${errorBody}`);
      }

      // Parse streaming response to collect full content
      let fullContent = "";
      let usageData: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;
      let responseModel = model;

      for await (const event of parseResponsesSSE(response.body!)) {
        if (event.type === "response.output_text.delta") {
          fullContent += (event.data as { delta?: string }).delta ?? "";
        } else if (event.type === "response.completed") {
          const resp = event.data.response as Record<string, unknown> | undefined;
          if (resp?.usage) {
            const u = resp.usage as Record<string, number>;
            usageData = {
              promptTokens: u.input_tokens ?? 0,
              completionTokens: u.output_tokens ?? 0,
              totalTokens: (u.input_tokens ?? 0) + (u.output_tokens ?? 0),
            };
          }
          if (resp?.model) responseModel = resp.model as string;
        }
      }

      const latencyMs = Date.now() - start;
      if (usageData) {
        costTracker.record(responseModel, usageData.promptTokens, usageData.completionTokens);
      }

      return {
        content: fullContent,
        model: responseModel,
        usage: usageData ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs,
      };
    },

    async *callLLMStreaming(
      options: StreamingLLMOptions
    ): AsyncGenerator<StreamChunk> {
      const token = await ensureValidToken();
      const model = mapModelToCodex(options.model);
      const { instructions, input } = extractSystemAndInput(options.messages);

      const body: Record<string, unknown> = {
        model,
        instructions,
        input,
        store: false,
        stream: true,
      };

      if (options.reasoningEffort && options.reasoningEffort !== "none") {
        body.reasoning = { effort: options.reasoningEffort };
      }

      const codexTools = convertToolsForResponsesAPI(options.tools);
      if (codexTools) {
        body.tools = codexTools;
      }

      const response = await makeRequest(token, body);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Codex streaming ${response.status}: ${errorBody}`);
      }

      if (!response.body) {
        throw new Error("No response body from Codex streaming");
      }

      let fullContent = "";
      const toolCalls = new Map<number, AccumulatedToolCall>();
      let toolCallIndex = 0;
      let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;

      for await (const event of parseResponsesSSE(response.body)) {
        switch (event.type) {
          case "response.output_text.delta": {
            const delta = (event.data as { delta?: string }).delta ?? "";
            fullContent += delta;
            yield { type: "text_delta", content: delta };
            break;
          }

          case "response.function_call_arguments.delta": {
            // Tool call argument streaming
            const callId = (event.data as { call_id?: string }).call_id ?? "";
            const argDelta = (event.data as { delta?: string }).delta ?? "";

            // Find existing tool call by ID or create new one
            let idx = -1;
            for (const [i, tc] of toolCalls) {
              if (tc.id === callId) { idx = i; break; }
            }
            if (idx === -1) {
              idx = toolCallIndex++;
              toolCalls.set(idx, { id: callId, name: "", arguments: argDelta });
            } else {
              toolCalls.get(idx)!.arguments += argDelta;
            }
            yield { type: "tool_call_delta", index: idx, arguments: argDelta };
            break;
          }

          case "response.function_call_arguments.done": {
            // Tool call complete — name should be in the data
            const callId = (event.data as { call_id?: string }).call_id ?? "";
            const name = (event.data as { name?: string }).name ?? "";
            for (const [idx, tc] of toolCalls) {
              if (tc.id === callId) {
                tc.name = name || tc.name;
                yield { type: "tool_call_start", index: idx, id: tc.id, name: tc.name };
                break;
              }
            }
            break;
          }

          case "response.output_item.added": {
            // New output item — could be a function call
            const item = (event.data as { item?: Record<string, unknown> }).item;
            if (item?.type === "function_call") {
              const callId = (item.call_id as string) ?? `call_${toolCallIndex}`;
              const name = (item.name as string) ?? "";
              const idx = toolCallIndex++;
              toolCalls.set(idx, { id: callId, name, arguments: "" });
              if (name) {
                yield { type: "tool_call_start", index: idx, id: callId, name };
              }
            }
            break;
          }

          case "response.completed": {
            const resp = event.data.response as Record<string, unknown> | undefined;
            if (resp?.usage) {
              const u = resp.usage as Record<string, number>;
              usage = {
                promptTokens: u.input_tokens ?? 0,
                completionTokens: u.output_tokens ?? 0,
                totalTokens: (u.input_tokens ?? 0) + (u.output_tokens ?? 0),
              };
            }
            break;
          }
        }
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
