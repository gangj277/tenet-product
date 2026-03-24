import { db } from "./client";
import { userLlmCredentials } from "./schema";
import { eq } from "drizzle-orm";
import { encryptTokens, decryptTokens } from "@/lib/auth/token-crypto";
import {
  getDefaultCredentialCapabilities,
  type ProviderKind,
  type CredentialValidationStatus,
  type CredentialCapabilities,
  type CredentialValidation,
  type OpenAIAuthTokens,
  type ProviderTokens,
} from "@/lib/storage/credential-types";

export {
  getDefaultCredentialCapabilities,
  getDefaultCredentialValidation,
} from "@/lib/storage/credential-types";
export type {
  ProviderKind,
  CredentialValidationStatus,
  CredentialCapabilities,
  CredentialValidation,
  OpenAIAuthTokens,
  ProviderTokens,
} from "@/lib/storage/credential-types";

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
  const t = tokens as { access: string; refresh: string; expires: number; accountId: string };

  return {
    kind: "openai_auth",
    ...t,
    validation: {
      status:
        row.validationStatus === "valid" ||
        row.validationStatus === "degraded" ||
        row.validationStatus === "invalid"
          ? row.validationStatus
          : "invalid",
      validatedAt: row.validatedAt?.toISOString() ?? null,
      capabilities: row.capabilities ?? getDefaultCredentialCapabilities(),
      lastErrorCode: row.lastErrorCode ?? null,
      lastErrorMessage: row.lastErrorMessage ?? null,
    },
  };
}

export async function upsertUserLLMCredentials(
  userId: string,
  tokens: ProviderTokens
): Promise<void> {
  const { kind, validation, ...data } = tokens;
  const encrypted = encryptTokens(data);
  const values = {
    provider: kind,
    encryptedTokens: encrypted,
    validationStatus: validation.status,
    validatedAt: validation.validatedAt ? new Date(validation.validatedAt) : null,
    capabilities: validation.capabilities,
    lastErrorCode: validation.lastErrorCode ?? null,
    lastErrorMessage: validation.lastErrorMessage ?? null,
    updatedAt: new Date(),
  };

  const existing = await db
    .select({ id: userLlmCredentials.id })
    .from(userLlmCredentials)
    .where(eq(userLlmCredentials.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(userLlmCredentials)
      .set(values)
      .where(eq(userLlmCredentials.userId, userId));
  } else {
    await db.insert(userLlmCredentials).values({
      userId,
      ...values,
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
