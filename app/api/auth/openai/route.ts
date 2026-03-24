import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { readLocalCodexAuthTokens } from "@/lib/auth/codex-local-auth";
import { connectOpenAIAccount } from "@/lib/auth/openai-account";
import {
  buildAuthorizationUrl,
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
} from "@/lib/auth/openai-oauth";

const PKCE_COOKIE = "lumen_openai_pkce";

function redirectTo(path: string) {
  return new NextResponse(null, {
    status: 307,
    headers: { Location: path },
  });
}

export async function GET() {
  // Try local Codex session first (works in dev / Electron)
  try {
    const localTokens = await readLocalCodexAuthTokens();
    const account = await connectOpenAIAccount({
      accessToken: localTokens.accessToken,
      refreshToken: localTokens.refreshToken,
      expiresAt: localTokens.expiresAt,
      idToken: localTokens.idToken,
      accountId: localTokens.accountId,
    });

    const sessionToken = await createSession({
      userId: account.userId,
      email: account.email,
    });
    await setSessionCookie(sessionToken);

    return redirectTo("/dashboard");
  } catch {
    // Local session not available — fall through to OAuth flow
  }

  // Deployed environment: start OpenAI OAuth PKCE flow
  try {
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);
    const state = generateState();

    const authUrl = buildAuthorizationUrl(state, challenge);

    const cookieStore = await cookies();
    cookieStore.set(PKCE_COOKIE, JSON.stringify({ verifier, state }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    return redirectTo(authUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "OpenAI sign-in failed.";
    return redirectTo(`/auth/login?error=${encodeURIComponent(message)}`);
  }
}
