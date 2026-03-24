import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getStorage } from "@/lib/storage";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const storage = await getStorage();
  const user = await storage.getUserById(session.userId);

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const creds = await storage.getLLMCredentials(user.id);

  return NextResponse.json({
    user: {
      ...user,
      sessionMode: process.env.ELECTRON ? "electron_local" : "web_cookie",
      openaiConnected: creds?.kind === "openai_auth",
      openaiConnection: creds
        ? {
            status: creds.validation.status,
            lastErrorMessage: creds.validation.lastErrorMessage ?? null,
            capabilities: creds.validation.capabilities,
          }
        : null,
    },
  });
}
