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
  // Try local Codex session (works in dev / Electron where user ran `codex login`)
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
    // Local session not available (deployed environment).
    // Redirect to login page which shows the token-paste flow.
    return redirectTo(
      "/auth/login?mode=paste&error=" +
        encodeURIComponent(
          "Paste your OpenAI session tokens below to sign in."
        )
    );
  }
}
