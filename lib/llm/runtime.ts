export type {
  LLMToolCall,
  ContentPart,
  LLMMessage,
  CallLLMOptions,
  LLMResponse,
} from "./types";

export { costTracker } from "./cost-tracker";

import { AsyncLocalStorage } from "node:async_hooks";
import type { CallLLMOptions, LLMResponse } from "./types";
import type { LLMProvider } from "./provider";
import { callLLMJsonWith } from "./json";

const globalForRequestProvider = globalThis as typeof globalThis & {
  __lumenRequestProviderStorage?: AsyncLocalStorage<LLMProvider | null>;
};

function getRequestProviderStorage() {
  return (
    globalForRequestProvider.__lumenRequestProviderStorage ??
    (globalForRequestProvider.__lumenRequestProviderStorage =
      new AsyncLocalStorage<LLMProvider | null>())
  );
}

const requestProviderStorage = getRequestProviderStorage();

export function runWithRequestProvider<T>(
  provider: LLMProvider,
  fn: () => T
): T {
  return requestProviderStorage.run(provider, fn);
}

export function setRequestProvider(provider: LLMProvider) {
  requestProviderStorage.enterWith(provider);
}

export function clearRequestProvider() {
  requestProviderStorage.enterWith(null);
}

function getActiveProvider(): LLMProvider {
  const requestProvider = requestProviderStorage.getStore();
  if (requestProvider) return requestProvider;

  throw new Error(
    "No OpenAI provider available for this request. Connect your OpenAI account and retry."
  );
}

export async function callLLM(options: CallLLMOptions): Promise<LLMResponse> {
  return getActiveProvider().callLLM(options);
}

export async function callLLMJson<T = unknown>(
  options: CallLLMOptions
): Promise<{ data: T; raw: LLMResponse }> {
  return callLLMJsonWith<T>(getActiveProvider(), options);
}
