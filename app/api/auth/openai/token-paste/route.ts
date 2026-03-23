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

  // Decode the access token to extract accountId
  let accountId: string;
  let email: string;
  let name: string;
  try {
    const claims = decodeJwtPayload(body.accessToken);
    accountId = (claims.sub as string) || (claims.account_id as string) || "";
    email = (claims.email as string) || "";
    name = (claims.name as string) || email.split("@")[0] || "User";
  } catch {
    return NextResponse.json(
      { error: "Invalid token format. Make sure you copied the access_token value correctly." },
      { status: 400 }
    );
  }

  if (!accountId) {
    return NextResponse.json(
      { error: "Token does not contain an account ID. Make sure this is an OpenAI Codex token." },
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
