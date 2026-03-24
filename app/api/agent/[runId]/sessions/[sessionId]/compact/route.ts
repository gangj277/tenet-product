import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getOwnedResearchRun } from "@/lib/db/research-projects";
import {
  appendMessages,
  getSessionMessages,
} from "@/lib/db/chat-sessions";
import { ensureOpenAIProviderAccess } from "@/lib/llm/openai-access";
import type { LLMMessage } from "@/lib/llm/runtime";
import {
  buildConversationHistoryFromMessages,
  deriveChatContinuationState,
} from "@/lib/agent/chat-context";
import { compactMessagesToFitBudget } from "@/lib/agent/compaction";
import {
  buildPersistedMessageMetadata,
  hydrateStoredChatMessage,
} from "@/app/dashboard/[runId]/_lib/chat-message-metadata";

function toLLMHistory(
  history: Array<{ role: "user" | "assistant"; content: string }>
): LLMMessage[] {
  return history.map((message) => ({
    role: message.role === "user" ? "user" : "assistant",
    content: message.content,
  }));
}

export async function POST(
  _request: NextRequest,
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

  const provider = await ensureOpenAIProviderAccess(session.userId);
  const storedMessages = await getSessionMessages(sessionId);
  const hydratedMessages = storedMessages.map((message) =>
    hydrateStoredChatMessage(message)
  );

  const appendStatusMessage = async (text: string) => {
    const id = crypto.randomUUID();
    await appendMessages(sessionId, [{ id, role: "agent", text }]);
    return {
      id,
      role: "agent" as const,
      text,
      metadata: null,
      createdAt: new Date().toISOString(),
    };
  };

  if (hydratedMessages.filter((message) => message.text.trim()).length < 2) {
    const message = await appendStatusMessage("Nothing meaningful to compact yet.");
    return NextResponse.json({
      ok: true,
      compacted: false,
      message: hydrateStoredChatMessage(message),
    });
  }

  const continuation = deriveChatContinuationState(hydratedMessages);
  const history = buildConversationHistoryFromMessages(
    hydratedMessages,
    continuation
  );

  const compactionResult = await compactMessagesToFitBudget({
    messages: [
      { role: "system", content: "Session history compaction" },
      ...toLLMHistory(history),
      { role: "user", content: "[Manual compaction request]" },
    ],
    provider,
    activeSkills: continuation.activeSkills,
    taskPlan: continuation.taskPlan,
    historyVisibleMessageCount: hydratedMessages.length,
    currentTurnStartIndex: history.length + 1,
  });

  if (!compactionResult.historySnapshot) {
    const message = await appendStatusMessage("Nothing meaningful to compact yet.");
    return NextResponse.json({
      ok: true,
      compacted: false,
      message: hydrateStoredChatMessage(message),
    });
  }

  const statusText = `Context compacted. Live context reduced from ~${compactionResult.estimatedTokensBefore.toLocaleString()} to ~${compactionResult.estimatedTokensAfter.toLocaleString()} tokens.`;
  const id = crypto.randomUUID();
  const metadata = buildPersistedMessageMetadata({
    activatedSkills: continuation.activeSkills,
    compactionSnapshot: compactionResult.historySnapshot,
    taskPlan: continuation.taskPlan?.tasks,
  });

  await appendMessages(sessionId, [
    {
      id,
      role: "agent",
      text: statusText,
      metadata,
    },
  ]);

  return NextResponse.json({
    ok: true,
    compacted: true,
    estimatedTokensBefore: compactionResult.estimatedTokensBefore,
    estimatedTokensAfter: compactionResult.estimatedTokensAfter,
    message: hydrateStoredChatMessage({
      id,
      role: "agent",
      text: statusText,
      metadata,
      createdAt: new Date().toISOString(),
    }),
  });
}
