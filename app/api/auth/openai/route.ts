import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  buildAuthorizationUrl,
} from "@/lib/auth/openai-oauth";

const PKCE_COOKIE = "lumen_openai_pkce";
const PKCE_MAX_AGE = 300; // 5 minutes

export async function GET() {
  const verifier = generateCodeVerifier();
  const challenge = generateCodeChallenge(verifier);
  const state = generateState();

  // Store verifier + state in a short-lived httpOnly cookie
  const cookieStore = await cookies();
  cookieStore.set(PKCE_COOKIE, JSON.stringify({ verifier, state }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: PKCE_MAX_AGE,
    path: "/",
  });

  const authUrl = buildAuthorizationUrl(state, challenge);
  return NextResponse.redirect(authUrl);
}
