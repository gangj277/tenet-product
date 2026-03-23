import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { users, userLlmCredentials } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      organization: users.organization,
      authProvider: users.authProvider,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  // Check if user has Codex OAuth connected
  const [creds] = await db
    .select({ provider: userLlmCredentials.provider })
    .from(userLlmCredentials)
    .where(eq(userLlmCredentials.userId, user.id))
    .limit(1);

  return NextResponse.json({
    user: {
      ...user,
      openaiConnected: creds?.provider === "codex",
    },
  });
}
