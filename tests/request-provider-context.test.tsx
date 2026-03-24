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

type LoadedRuntimeModule = typeof import("../lib/llm/runtime");
type LLMProvider = import("../lib/llm/provider").LLMProvider;

function createProvider(label: string): LLMProvider {
  return {
    kind: "openai_auth",
    async callLLM() {
      return {
        content: label,
        model: label,
        usage: {
          promptTokens: 1,
          completionTokens: 1,
          totalTokens: 2,
        },
        latencyMs: 1,
      };
    },
    async *callLLMStreaming() {
      yield {
        type: "done" as const,
        content: label,
        toolCalls: [],
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      };
    },
  };
}

test("request provider contexts stay isolated across overlapping async work", async () => {
  const loadedModule = reloadModule<LoadedRuntimeModule>(
    "../lib/llm/runtime.ts"
  );

  const providerA = createProvider("provider-a");
  const providerB = createProvider("provider-b");

  const runA = loadedModule.runWithRequestProvider(providerA, async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
    const first = await loadedModule.callLLM({
      messages: [{ role: "user", content: "first" }],
    });

    await new Promise((resolve) => setTimeout(resolve, 30));
    const second = await loadedModule.callLLM({
      messages: [{ role: "user", content: "second" }],
    });

    return [first.content, second.content];
  });

  const runB = loadedModule.runWithRequestProvider(providerB, async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    const result = await loadedModule.callLLM({
      messages: [{ role: "user", content: "parallel" }],
    });
    return result.content;
  });

  const [resultA, resultB] = await Promise.all([runA, runB]);

  assert.deepEqual(resultA, ["provider-a", "provider-a"]);
  assert.equal(resultB, "provider-b");
});

test("agent chat passes the connected provider into PDF parsing", async () => {
  const parsePDFCalls: Array<{ provider?: LLMProvider }> = [];
  const fakeProvider = createProvider("oauth-provider");

  const restoreSession = patchModule("../lib/auth/session.ts", {
    getSession: async () => ({ userId: "user-1" }),
  });
  const restoreOpenAIAccess = patchModule("../lib/llm/openai-access.ts", {
    ensureOpenAIProviderAccess: async () => fakeProvider,
  });
  const restoreResearchProjects = patchModule("../lib/db/research-projects.ts", {
    getOwnedResearchRun: async () => ({ runId: "run-1", projectId: "project-1" }),
    getPersistedArtifacts: async () => null,
    getExperimentMetadataForRun: async () => [],
    getNoteMetadataForRun: async () => [],
    getSourceMetadataForRun: async () => [],
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
    async *runAgentLoop() {
      yield { type: "done", usage: { totalTokens: 0 } };
    },
  });
  const restorePdfParser = patchModule("../lib/pdf/gemini-extract.ts", {
    parsePDF: async (
      _buffer: Buffer,
      _filename: string,
      options?: { provider?: LLMProvider }
    ) => {
      parsePDFCalls.push({ provider: options?.provider });
      return {
        text: "Extracted PDF text",
        pageCount: 1,
      };
    },
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
          message: "Review this PDF",
          attachments: [
            {
              type: "pdf",
              name: "paper.pdf",
              base64: Buffer.from("fake pdf").toString("base64"),
              mimeType: "application/pdf",
            },
          ],
        }),
      }) as never,
      { params: Promise.resolve({ runId: "run-1" }) }
    );

    await response.text();

    assert.equal(response.status, 200);
    assert.equal(parsePDFCalls.length, 1);
    assert.equal(parsePDFCalls[0].provider, fakeProvider);
  } finally {
    restorePdfParser();
    restoreAgentGraph();
    restoreWorkspaceTypes();
    restoreMemoryStore();
    restoreResearchProjects();
    restoreOpenAIAccess();
    restoreSession();
    clearModule("../app/api/agent/[runId]/chat/route.ts");
  }
});
