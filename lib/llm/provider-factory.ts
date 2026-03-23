import type { LLMProvider } from "./provider";
import { createOpenRouterProvider } from "./providers/openrouter";
import { createCodexProvider } from "./providers/codex";
import {
  getUserLLMCredentials,
  upsertUserLLMCredentials,
} from "@/lib/db/user-credentials";

/**
 * Create an LLM provider for a specific user.
 * Resolution order:
 * 1. User's stored Codex OAuth tokens
 * 2. User's stored OpenRouter API key
 * 3. Server-wide OPENROUTER_API_KEY env var
 */
export async function createProviderForUser(
  userId: string
): Promise<LLMProvider> {
  const creds = await getUserLLMCredentials(userId);

  if (creds?.kind === "codex") {
    return createCodexProvider(
      {
        accessToken: creds.access,
        refreshToken: creds.refresh,
        expiresAt: creds.expires,
        accountId: creds.accountId,
      },
      async (newCreds) => {
        await upsertUserLLMCredentials(userId, {
          kind: "codex",
          access: newCreds.accessToken,
          refresh: newCreds.refreshToken,
          expires: newCreds.expiresAt,
          accountId: newCreds.accountId,
        });
      }
    );
  }

  if (creds?.kind === "openrouter") {
    return createOpenRouterProvider(creds.apiKey);
  }

  // Fallback: server-wide OpenRouter key
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (apiKey) {
    return createOpenRouterProvider(apiKey);
  }

  throw new Error(
    "No LLM provider configured. Connect your OpenAI account or set an OpenRouter API key."
  );
}
