import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

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

  const cachedModule = requireFrom.cache[resolved];
  if (!cachedModule) {
    throw new Error(`Module cache missing for ${modulePath}`);
  }

  cachedModule.exports = exports;

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

test("chat composer renders a compact reasoning dropdown trigger with the selected level", async () => {
  const composerModule = await import(
    "../app/dashboard/[runId]/_components/chat/chat-composer.tsx"
  );

  const ChatComposer =
    composerModule.ChatComposer ?? composerModule.default.ChatComposer;

  const Composer = ChatComposer as unknown as (props: {
    agentTyping: boolean;
    files: [];
    onSend: (text: string, attachments?: File[]) => void;
    reasoningEffort: "low" | "medium" | "high" | "xhigh";
    onReasoningEffortChange: (next: "low" | "medium" | "high" | "xhigh") => void;
  }) => JSX.Element;

  const html = renderToStaticMarkup(
    <Composer
      agentTyping={false}
      files={[]}
      onSend={() => {}}
      reasoningEffort="xhigh"
      onReasoningEffortChange={() => {}}
    />
  );

  assert.match(html, /Extra high/i);
  assert.match(html, /aria-haspopup="menu"/i);
  assert.doesNotMatch(html, />Reasoning</i);
  assert.match(html, /white 5%/i);
});

test("agent chat forwards requested reasoning effort and continuation state into the agent loop", async () => {
  const runAgentLoopCalls: Array<{
    reasoningEffort: unknown;
    continuationState: unknown;
    historyVisibleMessageCount: unknown;
    workspaceCtx: unknown;
  }> = [];

  const restoreSession = patchModule("../lib/auth/session.ts", {
    getSession: async () => ({ userId: "user-1" }),
  });
  const restoreOpenAIAccess = patchModule("../lib/llm/openai-access.ts", {
    ensureOpenAIProviderAccess: async () => ({
      kind: "openai_auth",
      async callLLM() {
        throw new Error("not used");
      },
      async *callLLMStreaming() {
        yield {
          type: "done" as const,
          content: "",
          toolCalls: [],
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        };
      },
    }),
  });
  const restoreStorage = patchStorage({
    getOwnedResearchRun: async () => ({ runId: "run-1", projectId: "project-1" }),
    getPersistedArtifacts: async () => null,
    getExperimentMetadataForRun: async () => ({}),
    getNoteMetadataForRun: async () => ({}),
    getSourceMetadataForRun: async () => ({}),
  });
  const restoreMemoryStore = patchModule("../lib/storage/memory-store.ts", {
    memoryStore: {
      getRun: () => ({
        artifacts: {
          overview: "Overview",
          synthesis: "Synthesis",
          claims: "Claims",
          gaps: "Gaps",
          nextSteps: "Next steps",
          sources: {},
          papers: {},
          notes: {},
          experiments: {},
        },
      }),
      getArtifacts: () => undefined,
      getSourcesMeta: () => [],
      cancelPendingQuestion: () => {},
    },
  });
  const restoreWorkspaceTypes = patchModule(
    "../app/dashboard/[runId]/_lib/workspace-types.ts",
    {
      buildFileList: () => [
        {
          key: "overview",
          label: "Overview",
          group: "core",
          origin: "generated",
          folder: "Core",
        },
      ],
      collectFolderPaths: (
        files: Array<{ folder?: string }>,
        extraPaths?: Iterable<string>
      ) =>
        Array.from(
          new Set([
            ...files.map((file) => file.folder).filter((folder): folder is string => Boolean(folder)),
            ...(extraPaths ? Array.from(extraPaths) : []),
          ])
        ),
      getArtifactContent: () => "Overview",
    }
  );
  const restoreAgentGraph = patchModule("../lib/agent/graph.ts", {
    async *runAgentLoop(
      _message: string,
      _history: unknown,
      workspaceCtx: unknown,
      _attachments: unknown,
      _model: unknown,
      _provider: unknown,
      reasoningEffort: unknown,
      continuationState: unknown,
      historyVisibleMessageCount: unknown
    ) {
      runAgentLoopCalls.push({
        reasoningEffort,
        continuationState,
        historyVisibleMessageCount,
        workspaceCtx,
      });
      yield { type: "done", usage: { totalTokens: 0 } };
    },
  });
  const restorePdfParser = patchModule("../lib/pdf/gemini-extract.ts", {
    parsePDF: async () => ({ text: "Extracted PDF text", pageCount: 1 }),
  });

  try {
    clearModule("../app/api/agent/[runId]/chat/route.ts");
    const route = reloadModule<
      typeof import("../app/api/agent/[runId]/chat/route")
    >("../app/api/agent/[runId]/chat/route.ts");

    const response = await route.POST(
      new Request("http://localhost/api/agent/run-1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Think harder about this",
          reasoningEffort: "xhigh",
          conversationHistory: [
            { role: "assistant", content: "Compacted memory placeholder" },
          ],
          historyVisibleMessageCount: 8,
          agentState: {
            activeSkills: ["source-scout"],
            taskPlan: {
              created: 1,
              activeTaskId: "task-1",
              tasks: [{ id: "task-1", objective: "Read sources", status: "active" }],
            },
            compactionSnapshot: {
              version: 1,
              compactedMessageCount: 6,
              summary: "Summary",
              keyFacts: ["Fact"],
              openLoops: ["Loop"],
              activatedSkills: ["source-scout"],
              estimatedTokensAfter: 42000,
              compactedAt: "2026-03-24T00:00:00.000Z",
            },
          },
          workspaceContext: {
            folderPaths: ["Core", "Research/Empty"],
          },
        }),
      }) as never,
      { params: Promise.resolve({ runId: "run-1" }) }
    );

    await response.text();

    assert.equal(response.status, 200);
    assert.equal(runAgentLoopCalls.length, 1);
    assert.equal(runAgentLoopCalls[0]?.reasoningEffort, "xhigh");
    assert.deepEqual(runAgentLoopCalls[0]?.continuationState, {
      activeSkills: ["source-scout"],
      taskPlan: {
        created: 1,
        activeTaskId: "task-1",
        tasks: [{ id: "task-1", objective: "Read sources", status: "active" }],
      },
      compactionSnapshot: {
        version: 1,
        compactedMessageCount: 6,
        summary: "Summary",
        keyFacts: ["Fact"],
        openLoops: ["Loop"],
        activatedSkills: ["source-scout"],
        estimatedTokensAfter: 42000,
        compactedAt: "2026-03-24T00:00:00.000Z",
      },
    });
    assert.equal(runAgentLoopCalls[0]?.historyVisibleMessageCount, 8);
    assert.deepEqual(
      (runAgentLoopCalls[0]?.workspaceCtx as { folderPaths?: string[] } | undefined)
        ?.folderPaths,
      ["Core", "Research/Empty"]
    );
  } finally {
    restorePdfParser();
    restoreAgentGraph();
    restoreWorkspaceTypes();
    restoreMemoryStore();
    restoreStorage();
    restoreOpenAIAccess();
    restoreSession();
    clearModule("../app/api/agent/[runId]/chat/route.ts");
  }
});
