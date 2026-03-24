import { NextRequest, NextResponse } from "next/server";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { connectOpenAIAccount } from "@/lib/auth/openai-account";
import { decodeJwtPayload } from "@/lib/auth/openai-oauth";

interface TokenPasteBody {
  accessToken: string;
  refreshToken: string;
  idToken?: string;
}

export async function POST(request: NextRequest) {
  let body: TokenPasteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.accessToken?.trim() || !body.refreshToken?.trim()) {
    return NextResponse.json(
      { error: "accessToken and refreshToken are required" },
      { status: 400 }
    );
  }

  try {
    const claims = decodeJwtPayload(body.accessToken);
    const expiresAt =
      typeof claims.exp === "number" ? claims.exp * 1000 : Date.now() + 3600_000;

    const accountId =
      (typeof claims.sub === "string" ? claims.sub : "") ||
      (typeof claims.account_id === "string" ? claims.account_id : "");

    const account = await connectOpenAIAccount({
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      expiresAt,
      idToken: body.idToken,
      accountId: accountId || undefined,
    });

    const sessionToken = await createSession({
      userId: account.userId,
      email: account.email,
    });
    await setSessionCookie(sessionToken);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Token validation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
