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

test("synthesizeProject loads normalized source text from blob storage instead of inline parsed content", async () => {
  const blobReads: string[] = [];
  const userPayloads: string[] = [];

  const restoreBlobStore = patchModule("../lib/storage/blob-store.ts", {
    blobStore: {
      async getText(key: string) {
        blobReads.push(key);
        return "# Source\n\nThis normalized source text came from blob storage.";
      },
    },
  });
  const restoreOpenrouter = patchModule("../lib/llm/openrouter.ts", {
    callLLM: async (options: { messages: Array<{ role: string; content: string }> }) => {
      const userMessage = options.messages.find((message) => message.role === "user")?.content ?? "";
      userPayloads.push(userMessage);
      return {
        content: "artifact",
        model: "test-model",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: 0,
      };
    },
  });
  const restoreMemoryStore = patchModule("../lib/storage/memory-store.ts", {
    memoryStore: {
      updateProgress: () => {},
    },
  });

  try {
    clearModule("../lib/engine/nodes/synthesize-project.ts");
    const loadedModule = reloadModule<typeof import("../lib/engine/nodes/synthesize-project")>(
      "../lib/engine/nodes/synthesize-project.ts"
    );

    const result = await loadedModule.synthesizeProject({
      runId: "run-1",
      projectId: "project-1",
      userId: "user-1",
      status: "running",
      currentStep: "consolidate_findings",
      input: { researchQuestion: "What do the papers say?" },
      perspective: {
        briefSummary: "Summary",
        interpretedIntent: "Intent",
        inferredResearchFrame: "Frame",
        evidenceForCriteria: [],
        evidenceAgainstCriteria: [],
        subquestions: [],
      },
      sources: [
        {
          sourceId: "source-1",
          name: "Paper 1",
          origin: "discovered",
          mimeType: "application/pdf",
          checksum: "",
          storageUrl: "sources/source-1/raw.pdf",
          parseStatus: "parsed",
        },
      ],
      parsedSources: [
        {
          sourceId: "source-1",
          name: "Paper 1",
          normalizedBlobKey: "sources/source-1/normalized.md",
          charCount: 1000,
          estimatedTokens: 250,
          parseQuality: "validated",
          metadata: {},
        },
      ],
      sourceChunks: [],
      evidenceMap: undefined,
      consolidatedFindings: {
        canonicalClaims: [],
        prioritizedSupport: [],
        prioritizedContradictions: [],
        openQuestions: [],
        confidenceNotes: [],
        unresolvedDisagreements: [],
      },
      errors: [],
      startedAt: "",
      completedAt: "",
    });

    assert.ok(result.artifacts);
    assert.deepEqual(blobReads, ["sources/source-1/normalized.md"]);
    assert.ok(userPayloads.some((payload) => payload.includes("blob storage")));
  } finally {
    restoreMemoryStore();
    restoreOpenrouter();
    restoreBlobStore();
  }
});
