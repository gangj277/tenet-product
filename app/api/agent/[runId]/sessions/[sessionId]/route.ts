import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getStorage } from "@/lib/storage";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string; sessionId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { runId, sessionId } = await params;
  const storage = await getStorage();
  const run = await storage.getOwnedResearchRun(session.userId, runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const messages = await storage.getSessionMessages(sessionId);
  return NextResponse.json({ messages });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string; sessionId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { runId, sessionId } = await params;
  const storage = await getStorage();
  const run = await storage.getOwnedResearchRun(session.userId, runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  await storage.deleteSession(sessionId);
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string; sessionId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { runId, sessionId } = await params;
  const storage = await getStorage();
  const run = await storage.getOwnedResearchRun(session.userId, runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const body = await req.json();
  if (typeof body.title !== "string") {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  await storage.updateSessionTitle(sessionId, body.title);
  return NextResponse.json({ ok: true });
}
