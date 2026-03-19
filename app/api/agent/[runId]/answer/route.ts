import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getOwnedResearchRun } from "@/lib/db/research-projects";
import { memoryStore } from "@/lib/storage/memory-store";

interface AnswerRequestBody {
  questionId: string;
  answer: string;
  isCustom: boolean;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  // Auth
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify ownership
  const run = await getOwnedResearchRun(session.userId, runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  // Parse body
  let body: AnswerRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.questionId || !body.answer?.trim()) {
    return NextResponse.json(
      { error: "questionId and non-empty answer are required" },
      { status: 400 }
    );
  }

  // Check pending question exists and matches
  if (!memoryStore.hasPendingQuestion(runId)) {
    return NextResponse.json(
      { error: "No pending question for this run" },
      { status: 409 }
    );
  }

  const pendingId = memoryStore.getPendingQuestionId(runId);
  if (pendingId !== body.questionId) {
    return NextResponse.json(
      { error: "Question ID mismatch" },
      { status: 409 }
    );
  }

  const resolved = memoryStore.resolvePendingQuestion(runId, {
    questionId: body.questionId,
    answer: body.answer,
    isCustom: body.isCustom,
  });

  if (!resolved) {
    return NextResponse.json(
      { error: "Failed to resolve question" },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
