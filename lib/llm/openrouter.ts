import {
  RetryableRequestError,
  TimeoutError,
  retryAsync,
  withTimeout,
} from "@/lib/utils/async";

export interface LLMToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  /** Content text or multimodal content parts — null on assistant messages that only contain tool_calls (per OpenAI spec) */
  content: string | ContentPart[] | null;
  /** Present on assistant messages that invoke tools */
  tool_calls?: LLMToolCall[];
  /** Present on tool-result messages — must match the tool_call id */
  tool_call_id?: string;
}

export interface CallLLMOptions {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  jsonSchema?: {
    name: string;
    schema: Record<string, unknown>;
  };
}

export interface LLMResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
}

// ─── Cost Tracker ──────────────────────────────────────────────────────────

/** Per-million-token pricing for models used in the pipeline */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "google/gemini-3-flash-preview": { input: 0.50, output: 3.00 },
  "google/gemini-3.1-flash-lite-preview": { input: 0.25, output: 1.50 },
  "google/gemini-3.1-pro": { input: 2.50, output: 15.00 },
  "google/gemini-2.5-flash-lite": { input: 0.10, output: 0.40 },
  "google/gemini-2.5-flash": { input: 0.15, output: 0.60 },
  "anthropic/claude-sonnet-4": { input: 3.00, output: 15.00 },
  "anthropic/claude-sonnet-4.6": { input: 3.00, output: 15.00 },
  "openai/gpt-5.4": { input: 2.50, output: 10.00 },
};

interface ModelUsage {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
}

interface CostSnapshot {
  byModel: Record<string, ModelUsage>;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCalls: number;
}

class CostTracker {
  private usage: Record<string, ModelUsage> = {};

  record(model: string, inputTokens: number, outputTokens: number) {
    if (!this.usage[model]) {
      this.usage[model] = {
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        inputCostUsd: 0,
        outputCostUsd: 0,
        totalCostUsd: 0,
      };
    }

    const pricing = MODEL_PRICING[model] ?? { input: 0.50, output: 3.00 };
    const inputCost = (inputTokens * pricing.input) / 1_000_000;
    const outputCost = (outputTokens * pricing.output) / 1_000_000;

    const u = this.usage[model];
    u.calls++;
    u.inputTokens += inputTokens;
    u.outputTokens += outputTokens;
    u.inputCostUsd += inputCost;
    u.outputCostUsd += outputCost;
    u.totalCostUsd += inputCost + outputCost;
  }

  snapshot(): CostSnapshot {
    let totalCost = 0;
    let totalInput = 0;
    let totalOutput = 0;
    let totalCalls = 0;

    for (const u of Object.values(this.usage)) {
      totalCost += u.totalCostUsd;
      totalInput += u.inputTokens;
      totalOutput += u.outputTokens;
      totalCalls += u.calls;
    }

    return {
      byModel: { ...this.usage },
      totalCostUsd: totalCost,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalCalls,
    };
  }

  reset() {
    this.usage = {};
  }
}

export const costTracker = new CostTracker();

const MAX_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 60_000;

export async function callLLM(options: CallLLMOptions): Promise<LLMResponse> {
  const {
    messages,
    model = "google/gemini-3-flash-preview",
    temperature = 0.3,
    maxTokens = 8192,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    jsonSchema,
  } = options;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

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
          fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://research-cursor.app",
              "X-OpenRouter-Title": "Research Cursor",
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
        throw new Error(
          message
        );
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
}

/** Strip markdown code fences (```json ... ```) that lighter models often wrap around JSON */
function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    // Remove opening fence (```json or ```) and closing fence (```)
    return trimmed.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  return trimmed;
}

export async function callLLMJson<T = unknown>(
  options: CallLLMOptions
): Promise<{ data: T; raw: LLMResponse }> {
  const response = await callLLM(options);
  try {
    const data = JSON.parse(stripCodeFences(response.content)) as T;
    return { data, raw: response };
  } catch {
    // Retry once asking the model to fix the JSON
    const retryResponse = await callLLM({
      ...options,
      messages: [
        ...options.messages,
        { role: "assistant", content: response.content },
        {
          role: "user",
          content:
            "Your previous response was not valid JSON. Please return ONLY valid JSON matching the requested schema, with no other text.",
        },
      ],
    });
    const data = JSON.parse(stripCodeFences(retryResponse.content)) as T;
    return { data, raw: retryResponse };
  }
}
