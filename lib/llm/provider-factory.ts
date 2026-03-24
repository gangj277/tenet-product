import type { LLMProvider } from "./provider";
import { createOpenAIAuthProvider } from "./providers/openai-auth";
import {
  getUserLLMCredentials,
  upsertUserLLMCredentials,
} from "@/lib/db/user-credentials";
import { resolveOpenAIModel } from "./model-map";

/**
 * Create an LLM provider for a specific user.
 * OpenAI auth is the only supported runtime provider.
 */
export async function createProviderForUser(
  userId: string
): Promise<LLMProvider> {
  const creds = await getUserLLMCredentials(userId);

  if (creds?.kind === "openai_auth") {
    let currentValidation = { ...creds.validation };
    let currentTokens = {
      access: creds.access,
      refresh: creds.refresh,
      expires: creds.expires,
      accountId: creds.accountId,
    };

    const persistCredentials = async () => {
      await upsertUserLLMCredentials(userId, {
        kind: "openai_auth",
        ...currentTokens,
        validation: currentValidation,
      });
    };

    const baseProvider = createOpenAIAuthProvider(
      {
        accessToken: creds.access,
        refreshToken: creds.refresh,
        expiresAt: creds.expires,
        accountId: creds.accountId,
      },
      async (newCreds) => {
        currentTokens = {
          access: newCreds.accessToken,
          refresh: newCreds.refreshToken,
          expires: newCreds.expiresAt,
          accountId: newCreds.accountId,
        };
        currentValidation = {
          ...currentValidation,
          validatedAt: currentValidation.validatedAt ?? new Date().toISOString(),
        };
        await persistCredentials();
      },
      async (validation) => {
        currentValidation = validation;
        await persistCredentials();
      }
    );

    const resolveModel = (requestedModel?: string) => {
      const model = resolveOpenAIModel(requestedModel);
      if (model === "gpt-5.4-mini" && !creds.validation.capabilities.liteModel) {
        return "gpt-5.4";
      }
      return model;
    };

    const provider: LLMProvider = {
      kind: "openai_auth",
      callLLM(options) {
        return baseProvider.callLLM({
          ...options,
          model: resolveModel(options.model),
        });
      },
      callLLMStreaming(options) {
        return baseProvider.callLLMStreaming({
          ...options,
          model: resolveModel(options.model),
        });
      },
    };

    return provider;
  }

  throw new Error(
    "No LLM provider configured. Connect your OpenAI account to continue."
  );
}
