import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { upsertUserLLMCredentials } from "@/lib/db/user-credentials";
import { validateOpenAIConnection } from "@/lib/llm/openai-connection";
import { decodeJwtPayload } from "./openai-oauth";

export interface OpenAIAccountTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  idToken?: string;
  accountId?: string;
}

export interface OpenAIAccountResult {
  userId: string;
  email: string;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNestedString(
  claims: Record<string, unknown>,
  key: string,
  nestedKey: string
): string {
  const parent = claims[key];
  if (!parent || typeof parent !== "object") {
    return "";
  }

  return readString((parent as Record<string, unknown>)[nestedKey]);
}

function extractAccountId(
  accessClaims: Record<string, unknown>,
  idClaims: Record<string, unknown>,
  explicitAccountId?: string
): string {
  return (
    readString(explicitAccountId) ||
    readNestedString(accessClaims, "https://api.openai.com/auth", "chatgpt_account_id") ||
    readNestedString(idClaims, "https://api.openai.com/auth", "chatgpt_account_id") ||
    readString(accessClaims.account_id) ||
    readString(idClaims.account_id) ||
    readString(accessClaims.sub)
  );
}

function extractEmail(
  accessClaims: Record<string, unknown>,
  idClaims: Record<string, unknown>
): string {
  return (
    readString(idClaims.email) ||
    readNestedString(accessClaims, "https://api.openai.com/profile", "email") ||
    readString(accessClaims.email)
  );
}

function extractName(
  accessClaims: Record<string, unknown>,
  idClaims: Record<string, unknown>,
  email: string
): string {
  return (
    readString(idClaims.name) ||
    readString(accessClaims.name) ||
    email.split("@")[0] ||
    "User"
  );
}

export async function connectOpenAIAccount(
  tokens: OpenAIAccountTokens
): Promise<OpenAIAccountResult> {
  const accessClaims = decodeJwtPayload(tokens.accessToken);
  const idClaims = tokens.idToken ? decodeJwtPayload(tokens.idToken) : {};

  const accountId = extractAccountId(accessClaims, idClaims, tokens.accountId);
  if (!accountId) {
    throw new Error("Missing OpenAI account ID in the connected session.");
  }

  const email = extractEmail(accessClaims, idClaims);
  const normalizedEmail = email.toLowerCase().trim() || `openai-${accountId}@codex.local`;
  const name = extractName(accessClaims, idClaims, normalizedEmail);

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
    await db
      .update(users)
      .set({
        authProvider: "openai_auth",
        name,
      })
      .where(eq(users.id, userId));
  } else {
    const [newUser] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        passwordHash: null,
        name,
        authProvider: "openai_auth",
      })
      .returning({ id: users.id });
    userId = newUser.id;
  }

  const validation = await validateOpenAIConnection({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    accountId,
  });

  await upsertUserLLMCredentials(userId, {
    kind: "openai_auth",
    access: tokens.accessToken,
    refresh: tokens.refreshToken,
    expires: tokens.expiresAt,
    accountId,
    validation,
  });

  if (!validation.ok) {
    throw new Error(validation.lastErrorMessage || "OpenAI validation failed");
  }

  return {
    userId,
    email: normalizedEmail,
  };
}
