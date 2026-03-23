import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { createSession, setSessionCookie, getSession } from "@/lib/auth/session";
import { decodeJwtPayload } from "@/lib/auth/openai-oauth";
import { upsertUserLLMCredentials } from "@/lib/db/user-credentials";
import { eq } from "drizzle-orm";

interface TokenPasteBody {
  accessToken: string;
  refreshToken: string;
  accountId?: string;
  expiresAt?: number; // Unix ms — optional, defaults to +1h
}

export async function POST(request: NextRequest) {
  let body: TokenPasteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.accessToken?.trim()) {
    return NextResponse.json({ error: "accessToken is required" }, { status: 400 });
  }

  // Extract accountId + email from body or JWT
  let accountId = body.accountId || "";
  let email = "";
  let name = "";
  try {
    const claims = decodeJwtPayload(body.accessToken);
    // OpenAI nests profile under https://api.openai.com/profile
    const profile = claims["https://api.openai.com/profile"] as Record<string, unknown> | undefined;
    const auth = claims["https://api.openai.com/auth"] as Record<string, unknown> | undefined;
    email = (profile?.email as string) || (claims.email as string) || "";
    name = (claims.name as string) || email.split("@")[0] || "User";
    if (!accountId) {
      accountId = (auth?.chatgpt_account_id as string) || (claims.sub as string) || "";
    }
  } catch {
    // JWT decode failed — if we have accountId from body, proceed anyway
    if (!accountId) {
      return NextResponse.json(
        { error: "Could not read token. Make sure you pasted the full auth.json content." },
        { status: 400 }
      );
    }
  }

  if (!accountId) {
    return NextResponse.json(
      { error: "Missing account ID. Make sure this is a valid Codex auth.json." },
      { status: 400 }
    );
  }

  // Check if user is already logged in (connecting to existing account)
  const existingSession = await getSession();

  let userId: string;
  const normalizedEmail = email.toLowerCase().trim() || `openai-${accountId}@codex.local`;

  if (existingSession) {
    // Logged-in user connecting their OpenAI account
    userId = existingSession.userId;
  } else {
    // New sign-in via token paste — find or create user
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingUser) {
      userId = existingUser.id;
      await db
        .update(users)
        .set({ authProvider: "openai_codex" })
        .where(eq(users.id, userId));
    } else {
      const [newUser] = await db
        .insert(users)
        .values({
          email: normalizedEmail,
          passwordHash: null,
          name,
          authProvider: "openai_codex",
        })
        .returning({ id: users.id });
      userId = newUser.id;
    }
  }

  // Store encrypted tokens
  const expiresMs = body.expiresAt || Date.now() + 3600 * 1000; // default 1h
  await upsertUserLLMCredentials(userId, {
    kind: "codex",
    access: body.accessToken,
    refresh: body.refreshToken || "",
    expires: expiresMs,
    accountId,
  });

  // Create session if not already logged in
  if (!existingSession) {
    const token = await createSession({ userId, email: normalizedEmail });
    await setSessionCookie(token);
  }

  return NextResponse.json({ ok: true, userId });
}
