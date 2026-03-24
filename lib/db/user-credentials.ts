import { db } from "./client";
import { userLlmCredentials } from "./schema";
import { eq } from "drizzle-orm";
import { encryptTokens, decryptTokens } from "@/lib/auth/token-crypto";

export type ProviderKind = "openai_auth";
export type CredentialValidationStatus = "valid" | "invalid" | "degraded";

export interface CredentialCapabilities {
  basic: boolean;
  json: boolean;
  streaming: boolean;
  toolCalling: boolean;
  liteModel: boolean;
}

export interface CredentialValidation {
  status: CredentialValidationStatus;
  validatedAt?: string | null;
  capabilities: CredentialCapabilities;
  lastErrorCode?: number | null;
  lastErrorMessage?: string | null;
}

export interface OpenAIAuthTokens {
  access: string;
  refresh: string;
  expires: number; // Unix ms
  accountId: string;
}

export function getDefaultCredentialCapabilities(): CredentialCapabilities {
  return {
    basic: false,
    json: false,
    streaming: false,
    toolCalling: false,
    liteModel: false,
  };
}

export function getDefaultCredentialValidation(): CredentialValidation {
  return {
    status: "invalid",
    validatedAt: null,
    capabilities: getDefaultCredentialCapabilities(),
    lastErrorCode: null,
    lastErrorMessage: null,
  };
}

export type ProviderTokens = {
  kind: "openai_auth";
  validation: CredentialValidation;
} & OpenAIAuthTokens;

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
