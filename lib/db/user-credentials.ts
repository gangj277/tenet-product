import { db } from "./client";
import { userLlmCredentials } from "./schema";
import { eq } from "drizzle-orm";
import { encryptTokens, decryptTokens } from "@/lib/auth/token-crypto";

export type ProviderKind = "openrouter" | "codex";

export interface CodexTokens {
  access: string;
  refresh: string;
  expires: number; // Unix ms
  accountId: string;
}

export interface OpenRouterTokens {
  apiKey: string;
}

export type ProviderTokens =
  | { kind: "codex" } & CodexTokens
  | { kind: "openrouter" } & OpenRouterTokens;

export async function getUserLLMCredentials(
  userId: string
): Promise<ProviderTokens | null> {
  const [row] = await db
    .select()
    .from(userLlmCredentials)
    .where(eq(userLlmCredentials.userId, userId))
    .limit(1);

  if (!row) return null;

  const tokens = decryptTokens(row.encryptedTokens);

  if (row.provider === "codex") {
    const t = tokens as { access: string; refresh: string; expires: number; accountId: string };
    return { kind: "codex", ...t };
  }

  const t = tokens as { apiKey: string };
  return { kind: "openrouter", ...t };
}

export async function upsertUserLLMCredentials(
  userId: string,
  tokens: ProviderTokens
): Promise<void> {
  const { kind, ...data } = tokens;
  const encrypted = encryptTokens(data);

  const existing = await db
    .select({ id: userLlmCredentials.id })
    .from(userLlmCredentials)
    .where(eq(userLlmCredentials.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(userLlmCredentials)
      .set({
        provider: kind,
        encryptedTokens: encrypted,
        updatedAt: new Date(),
      })
      .where(eq(userLlmCredentials.userId, userId));
  } else {
    await db.insert(userLlmCredentials).values({
      userId,
      provider: kind,
      encryptedTokens: encrypted,
    });
  }
}

export async function deleteUserLLMCredentials(
  userId: string
): Promise<void> {
  await db
    .delete(userLlmCredentials)
    .where(eq(userLlmCredentials.userId, userId));
}
