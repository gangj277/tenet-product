import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getStorage } from "@/lib/storage";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { name, organization } = body as { name?: string; organization?: string | null };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const storage = await getStorage();
  await storage.updateUserProfile(session.userId, {
    name: name.trim(),
    organization: organization?.trim() || null,
  });

  return NextResponse.json({ ok: true });
}
