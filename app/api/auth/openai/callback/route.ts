import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { exchangeCodeForTokens, decodeJwtPayload } from "@/lib/auth/openai-oauth";
import { upsertUserLLMCredentials } from "@/lib/db/user-credentials";
import { eq } from "drizzle-orm";

const PKCE_COOKIE = "lumen_openai_pkce";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    const desc = searchParams.get("error_description") || error;
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(desc)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/auth/login?error=Missing+code+or+state", request.url)
    );
  }

  // Validate state and retrieve PKCE verifier
  const cookieStore = await cookies();
  const pkceCookie = cookieStore.get(PKCE_COOKIE)?.value;
  cookieStore.delete(PKCE_COOKIE);

  if (!pkceCookie) {
    return NextResponse.redirect(
      new URL("/auth/login?error=OAuth+session+expired", request.url)
    );
  }

  let pkceData: { verifier: string; state: string };
  try {
    pkceData = JSON.parse(pkceCookie);
  } catch {
    return NextResponse.redirect(
      new URL("/auth/login?error=Invalid+OAuth+session", request.url)
    );
  }

  if (pkceData.state !== state) {
    return NextResponse.redirect(
      new URL("/auth/login?error=State+mismatch", request.url)
    );
  }

  // Exchange code for tokens
  let tokenResponse;
  try {
    tokenResponse = await exchangeCodeForTokens(code, pkceData.verifier);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token exchange failed";
    console.error("OpenAI OAuth token exchange error:", msg);
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(msg)}`, request.url)
    );
  }

  // Decode the access token to extract accountId and email
  let accountId: string;
  let email: string;
  let name: string;
  try {
    const claims = decodeJwtPayload(tokenResponse.access_token);
    accountId = (claims.sub as string) || (claims.account_id as string) || "";
    // Try email from id_token first, then access token claims
    if (tokenResponse.id_token) {
      const idClaims = decodeJwtPayload(tokenResponse.id_token);
      email = (idClaims.email as string) || "";
      name = (idClaims.name as string) || email.split("@")[0] || "User";
    } else {
      email = (claims.email as string) || "";
      name = (claims.name as string) || email.split("@")[0] || "User";
    }
  } catch {
    return NextResponse.redirect(
      new URL("/auth/login?error=Failed+to+decode+token", request.url)
    );
  }

  if (!accountId) {
    return NextResponse.redirect(
      new URL("/auth/login?error=Missing+account+ID+in+token", request.url)
    );
  }

  // Upsert user: find by email or create new
  let userId: string;
  const normalizedEmail = email.toLowerCase().trim() || `openai-${accountId}@codex.local`;

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existingUser) {
    userId = existingUser.id;
    // Update authProvider if it was email-only before
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

  // Store encrypted OAuth tokens
  const expiresMs = Date.now() + tokenResponse.expires_in * 1000;
  await upsertUserLLMCredentials(userId, {
    kind: "codex",
    access: tokenResponse.access_token,
    refresh: tokenResponse.refresh_token,
    expires: expiresMs,
    accountId,
  });

  // Create Lumen session
  const sessionToken = await createSession({ userId, email: normalizedEmail });
  await setSessionCookie(sessionToken);

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
