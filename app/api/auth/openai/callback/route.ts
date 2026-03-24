import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { exchangeCodeForTokens } from "@/lib/auth/openai-oauth";
import { connectOpenAIAccount } from "@/lib/auth/openai-account";

const PKCE_COOKIE = "lumen_openai_pkce";

function redirectTo(path: string) {
  return new NextResponse(null, {
    status: 307,
    headers: { Location: path },
  });
}

export async function GET(request: NextRequest) {
  const requestUrl =
    "nextUrl" in request && request.nextUrl instanceof URL
      ? request.nextUrl
      : new URL(request.url);
  const { searchParams } = requestUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    const desc = searchParams.get("error_description") || error;
    return redirectTo(`/auth/login?error=${encodeURIComponent(desc)}`);
  }

  if (!code || !state) {
    return redirectTo("/auth/login?error=Missing+code+or+state");
  }

  // Validate state and retrieve PKCE verifier
  const cookieStore = await cookies();
  const pkceCookie = cookieStore.get(PKCE_COOKIE)?.value;
  cookieStore.delete(PKCE_COOKIE);

  if (!pkceCookie) {
    return redirectTo("/auth/login?error=OAuth+session+expired");
  }

  let pkceData: { verifier: string; state: string };
  try {
    pkceData = JSON.parse(pkceCookie);
  } catch {
    return redirectTo("/auth/login?error=Invalid+OAuth+session");
  }

  if (pkceData.state !== state) {
    return redirectTo("/auth/login?error=State+mismatch");
  }

  // Exchange code for tokens
  let tokenResponse;
  try {
    tokenResponse = await exchangeCodeForTokens(code, pkceData.verifier);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token exchange failed";
    console.error("OpenAI OAuth token exchange error:", msg);
    return redirectTo(`/auth/login?error=${encodeURIComponent(msg)}`);
  }

  let account;
  try {
    account = await connectOpenAIAccount({
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: Date.now() + tokenResponse.expires_in * 1000,
      idToken: tokenResponse.id_token,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "OpenAI validation failed";
    return redirectTo(`/auth/login?error=${encodeURIComponent(message)}`);
  }

  const sessionToken = await createSession({
    userId: account.userId,
    email: account.email,
  });
  await setSessionCookie(sessionToken);

  return redirectTo("/dashboard");
}
