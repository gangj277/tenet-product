import type { LLMProvider } from "./provider";
import type { CallLLMOptions, LLMResponse } from "./types";

/** Strip markdown code fences (```json ... ```) that lighter models often wrap around JSON */
function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  return trimmed;
}

/**
 * Provider-agnostic JSON completion with retry on parse failure.
 */
export async function callLLMJsonWith<T = unknown>(
  provider: LLMProvider,
  options: CallLLMOptions
): Promise<{ data: T; raw: LLMResponse }> {
  const response = await provider.callLLM(options);
  try {
    const data = JSON.parse(stripCodeFences(response.content)) as T;
    return { data, raw: response };
  } catch {
    // Retry once asking the model to fix the JSON
    const retryResponse = await provider.callLLM({
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
