import { NextResponse } from "next/server";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { readLocalCodexAuthTokens } from "@/lib/auth/codex-local-auth";
import { connectOpenAIAccount } from "@/lib/auth/openai-account";

function redirectTo(path: string) {
  return new NextResponse(null, {
    status: 307,
    headers: { Location: path },
  });
}

export async function GET() {
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "OpenAI sign-in failed.";
    return redirectTo(`/auth/login?error=${encodeURIComponent(message)}`);
  }
}
