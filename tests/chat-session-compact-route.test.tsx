import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const requireFrom = createRequire(import.meta.url);

function reloadModule<T>(modulePath: string): T {
  const resolved = requireFrom.resolve(modulePath);
  delete requireFrom.cache[resolved];
  return requireFrom(modulePath) as T;
}

function clearModule(modulePath: string) {
  const resolved = requireFrom.resolve(modulePath);
  delete requireFrom.cache[resolved];
}

function patchModule(modulePath: string, exports: unknown): () => void {
  const resolved = requireFrom.resolve(modulePath);
  const original = requireFrom.cache[resolved];

  if (!original) {
    requireFrom(modulePath);
  }

  requireFrom.cache[resolved].exports = exports;

  return () => {
    if (original) {
      requireFrom.cache[resolved] = original;
      return;
    }

    delete requireFrom.cache[resolved];
  };
}

function patchStorage(storage: Record<string, unknown>): () => void {
  return patchModule("../lib/storage/index.ts", {
    getStorage: async () => storage,
    resetStorageForTests: () => {},
  });
}

test("POST /api/agent/[runId]/sessions/[sessionId]/compact appends a compacted agent status message", async () => {
  const appendedMessages: Array<{
    sessionId: string;
    messages: Array<Record<string, unknown>>;
  }> = [];

  const restoreSession = patchModule("../lib/auth/session.ts", {
    getSession: async () => ({ userId: "user-1" }),
  });
  const restoreStorage = patchStorage({
    getOwnedResearchRun: async () => ({ runId: "run-1", projectId: "project-1" }),
    getSessionMessages: async () => [
      {
        id: "user-1",
        role: "user",
        text: "A".repeat(1_200_000),
        metadata: null,
        createdAt: "2026-03-24T00:00:00.000Z",
      },
      {
        id: "agent-1",
        role: "agent",
        text: "B".repeat(1_200_000),
        metadata: {
          activatedSkills: ["source-scout"],
          taskPlan: [{ id: "task-1", objective: "Read sources", status: "active" }],
        },
        createdAt: "2026-03-24T00:01:00.000Z",
      },
    ],
    appendMessages: async (sessionId: string, messages: Array<Record<string, unknown>>) => {
      appendedMessages.push({ sessionId, messages });
    },
  });
  const restoreOpenAIAccess = patchModule("../lib/llm/openai-access.ts", {
    ensureOpenAIProviderAccess: async () => ({
      kind: "openai_auth",
      async callLLM() {
        return {
          content: JSON.stringify({
            summary: "Compacted memory summary",
            keyFacts: ["Key fact"],
            openLoops: ["Open loop"],
            nextStepHint: "Continue with the comparison.",
          }),
          model: "gpt-5.4-mini",
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          latencyMs: 1,
        };
      },
      async *callLLMStreaming() {
        yield {
          type: "done" as const,
          content: "",
          toolCalls: [],
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        };
      },
    }),
  });

  try {
    clearModule("../app/api/agent/[runId]/sessions/[sessionId]/compact/route.ts");
    const route = reloadModule<
      typeof import("../app/api/agent/[runId]/sessions/[sessionId]/compact/route")
    >("../app/api/agent/[runId]/sessions/[sessionId]/compact/route.ts");

    const response = await route.POST(
      new Request("http://localhost/api/agent/run-1/sessions/session-1/compact", {
        method: "POST",
      }) as never,
      { params: Promise.resolve({ runId: "run-1", sessionId: "session-1" }) }
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(appendedMessages.length, 1);
    assert.equal(appendedMessages[0]?.sessionId, "session-1");
    assert.equal(appendedMessages[0]?.messages.length, 1);
    assert.match(String(appendedMessages[0]?.messages[0]?.text ?? ""), /Context compacted/i);
    assert.equal(
      (appendedMessages[0]?.messages[0]?.metadata as Record<string, unknown>)?.activatedSkills instanceof Array,
      true
    );
    assert.ok(
      ((appendedMessages[0]?.messages[0]?.metadata as Record<string, unknown>)?.compactionSnapshot as Record<string, unknown>)?.summary
    );
    assert.ok(payload.estimatedTokensBefore > payload.estimatedTokensAfter);
  } finally {
    restoreOpenAIAccess();
    restoreStorage();
    restoreSession();
    clearModule("../app/api/agent/[runId]/sessions/[sessionId]/compact/route.ts");
  }
});
