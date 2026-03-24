import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getStorage } from "@/lib/storage";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { runId } = await params;
  const storage = await getStorage();
  const run = await storage.getOwnedResearchRun(session.userId, runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const sessions = await storage.getSessionsForRun(runId);
  return NextResponse.json({ sessions });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { runId } = await params;
  const storage = await getStorage();
  const run = await storage.getOwnedResearchRun(session.userId, runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const newSession = await storage.createSession(runId, body.title);
  return NextResponse.json(newSession, { status: 201 });
}
