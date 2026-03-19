import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getOwnedResearchRun } from "@/lib/db/research-projects";
import { appendMessages, updateMessageMetadata } from "@/lib/db/chat-sessions";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string; sessionId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { runId, sessionId } = await params;
  const run = await getOwnedResearchRun(session.userId, runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const body = await req.json();
  const messages = body.messages;

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }

  await appendMessages(sessionId, messages);
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
  const run = await getOwnedResearchRun(session.userId, runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const body = await req.json();
  if (
    typeof body.messageId !== "string" ||
    !body.messageId ||
    typeof body.metadata !== "object" ||
    body.metadata === null ||
    Array.isArray(body.metadata)
  ) {
    return NextResponse.json(
      { error: "messageId and metadata required" },
      { status: 400 }
    );
  }

  await updateMessageMetadata(sessionId, body.messageId, body.metadata);
  return NextResponse.json({ ok: true });
}
