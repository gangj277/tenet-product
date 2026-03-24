import {
  getUserLLMCredentials,
  upsertUserLLMCredentials,
  type ProviderTokens,
} from "@/lib/db/user-credentials";
import { OPENAI_VALIDATION_STALE_MS } from "./config";
import { validateOpenAIConnection } from "./openai-connection";
import { createProviderForUser } from "./provider-factory";

function isValidationStale(validatedAt?: string | null): boolean {
  if (!validatedAt) return true;
  const ageMs = Date.now() - new Date(validatedAt).getTime();
  return ageMs >= OPENAI_VALIDATION_STALE_MS;
}

function getValidationErrorMessage(
  credentials: ProviderTokens
): string {
  const code = credentials.validation.lastErrorCode;
  const fallback =
    credentials.validation.lastErrorMessage ||
    "OpenAI authentication is not valid for the Codex runtime.";

  if (code === 401) {
    return "OpenAI session expired. Reconnect your OpenAI account and retry.";
  }
  if (code === 403) {
    return "This OpenAI account does not have permission to use the Codex runtime. Reconnect with a supported OpenAI account.";
  }
  if (code === 429) {
    return "OpenAI is throttling requests right now. Retry in a moment.";
  }

  return fallback;
}

export async function ensureOpenAIProviderAccess(
  userId: string,
  options?: { forceRevalidate?: boolean }
) {
  const credentials = await getUserLLMCredentials(userId);
  if (!credentials) {
    throw new Error("Connect your OpenAI account to continue.");
  }

  const shouldValidate =
    options?.forceRevalidate ||
    credentials.validation.status === "invalid" ||
    isValidationStale(credentials.validation.validatedAt);

  if (shouldValidate) {
    const validation = await validateOpenAIConnection({
      accessToken: credentials.access,
      refreshToken: credentials.refresh,
      expiresAt: credentials.expires,
      accountId: credentials.accountId,
    });

    const nextCredentials: ProviderTokens = {
      ...credentials,
      validation,
    };

    await upsertUserLLMCredentials(userId, nextCredentials);

    if (!validation.ok) {
      throw new Error(getValidationErrorMessage(nextCredentials));
    }
  } else if (credentials.validation.status === "invalid") {
    throw new Error(getValidationErrorMessage(credentials));
  }

  return createProviderForUser(userId);
}
