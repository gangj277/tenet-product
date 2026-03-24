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

test("POST /api/init/[runId]/start rejects runs that are not drafts", async () => {
  const restoreSession = patchModule("../lib/auth/session.ts", {
    getSession: async () => ({ userId: "user-1" }),
  });
  const restoreResearchProjects = patchModule("../lib/db/research-projects.ts", {
    getOwnedResearchRun: async () => ({
      runId: "run-1",
      projectId: "project-1",
      status: "completed",
      currentStep: "persist_project",
    }),
  });

  try {
    const route = reloadModule<typeof import("../app/api/init/[runId]/start/route")>(
      "../app/api/init/[runId]/start/route.ts"
    );

    const response = await route.POST(
      new Request("http://localhost/api/init/run-1/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: {
            researchQuestion: "Does retrieval improve factual accuracy?",
          },
        }),
      }) as never,
      { params: Promise.resolve({ runId: "run-1" }) }
    );

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: "Only draft workspaces can start deep analysis.",
    });
  } finally {
    restoreResearchProjects();
    restoreSession();
  }
});

test("POST /api/init/[runId]/start starts first-phase analysis for a draft workspace and reuses persisted sources", async () => {
  const upsertUserInputCalls: unknown[] = [];
  const runStatusUpdates: unknown[] = [];
  const setRunCalls: Array<{ runId: string; value: Record<string, unknown> }> = [];
  const invokeCalls: Array<{ state: Record<string, unknown>; config: Record<string, unknown> }> = [];

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
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        };
      },
    }),
  });
  const restoreRuntime = patchModule("../lib/llm/runtime.ts", {
    runWithRequestProvider: async (_provider: unknown, fn: () => unknown) => fn(),
  });
  const restoreResearchProjects = patchModule("../lib/db/research-projects.ts", {
    getOwnedResearchRun: async () => ({
      runId: "run-1",
      projectId: "project-1",
      status: "draft",
      currentStep: "",
    }),
    updateProjectTitle: async () => {},
    updateResearchRunStatus: async (value: unknown) => {
      runStatusUpdates.push(value);
    },
    upsertResearchRunInput: async (value: unknown) => {
      upsertUserInputCalls.push(value);
    },
    getPersistedSourcesForRun: async () => [
      {
        sourceId: "source-1",
        name: "Scratch source",
        origin: "uploaded",
        mimeType: "application/pdf",
        checksum: "checksum-1",
        storageUrl: "sources/source-1/raw.pdf",
        parseStatus: "parsed",
        metadata: {
          sourceKind: "pdf",
          sourceUrl: "https://example.com/source.pdf",
          resolvedUrl: "https://example.com/source.pdf",
          rawBlobKey: "sources/source-1/raw.pdf",
          normalizedBlobKey: "sources/source-1/normalized.md",
          byteSize: 10,
          charCount: 100,
          estimatedTokens: 30,
          parseQuality: "validated",
          parseEngine: "pdfjs-local-text",
          parseAttempts: 1,
        },
      },
    ],
  });
  const restoreMemoryStore = patchModule("../lib/storage/memory-store.ts", {
    memoryStore: {
      setRun: (runId: string, value: Record<string, unknown>) => {
        setRunCalls.push({ runId, value });
      },
    },
  });
  const restoreGraph = patchModule("../lib/engine/graph.ts", {
    initGraph: {
      invoke: async (state: Record<string, unknown>, config: Record<string, unknown>) => {
        invokeCalls.push({ state, config });
        return {
          perspective: {
            projectTitle: "Retrieval reliability",
            briefSummary: "Summary",
            interpretedIntent: "Intent",
            inferredResearchFrame: "Frame",
            evidenceForCriteria: [],
            evidenceAgainstCriteria: [],
            subquestions: [],
          },
        };
      },
    },
  });

  try {
    const route = reloadModule<typeof import("../app/api/init/[runId]/start/route")>(
      "../app/api/init/[runId]/start/route.ts"
    );

    const response = await route.POST(
      new Request("http://localhost/api/init/run-1/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: {
            researchQuestion: "Does retrieval improve factual accuracy?",
            researchIntent: "Decide whether to adopt RAG",
          },
        }),
      }) as never,
      { params: Promise.resolve({ runId: "run-1" }) }
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.runId, "run-1");
    assert.equal(body.projectId, "project-1");
    assert.equal(body.status, "awaiting_confirmation");
    assert.equal(body.perspective.projectTitle, "Retrieval reliability");

    assert.deepEqual(upsertUserInputCalls, [
      {
        runId: "run-1",
        input: {
          researchQuestion: "Does retrieval improve factual accuracy?",
          researchIntent: "Decide whether to adopt RAG",
        },
      },
    ]);

    assert.equal(invokeCalls.length, 1);
    assert.equal(invokeCalls[0]?.config.configurable.thread_id, "run-1");
    assert.deepEqual(invokeCalls[0]?.state.sources, [
      {
        sourceId: "source-1",
        name: "Scratch source",
        origin: "uploaded",
        mimeType: "application/pdf",
        checksum: "checksum-1",
        storageUrl: "sources/source-1/raw.pdf",
        parseStatus: "parsed",
        metadata: {
          sourceKind: "pdf",
          sourceUrl: "https://example.com/source.pdf",
          resolvedUrl: "https://example.com/source.pdf",
          rawBlobKey: "sources/source-1/raw.pdf",
          normalizedBlobKey: "sources/source-1/normalized.md",
          byteSize: 10,
          charCount: 100,
          estimatedTokens: 30,
          parseQuality: "validated",
          parseEngine: "pdfjs-local-text",
          parseAttempts: 1,
        },
      },
    ]);

    assert.deepEqual(runStatusUpdates, [
      {
        projectId: "project-1",
        runId: "run-1",
        status: "running",
      },
      {
        projectId: "project-1",
        runId: "run-1",
        status: "awaiting_confirmation",
      },
    ]);

    assert.equal(setRunCalls.length, 2);
    assert.equal(setRunCalls[0]?.runId, "run-1");
    assert.equal(setRunCalls[0]?.value.status, "running");
    assert.equal(setRunCalls[1]?.value.status, "awaiting_confirmation");
  } finally {
    restoreGraph();
    restoreMemoryStore();
    restoreResearchProjects();
    restoreRuntime();
    restoreOpenAIAccess();
    restoreSession();
  }
});
