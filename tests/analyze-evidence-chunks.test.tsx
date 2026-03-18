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

test("analyzeEvidence reads chunk blobs instead of requiring inline full-document source content", async () => {
  const blobReads: string[] = [];
  const llmInputs: string[] = [];

  const restoreBlobStore = patchModule("../lib/storage/blob-store.ts", {
    blobStore: {
      async getText(key: string) {
        blobReads.push(key);
        if (key === "sources/source-1/chunks/0000.md") {
          return "## Chunk A\n\nEvidence about the intervention improving outcomes.";
        }
        if (key === "sources/source-1/chunks/0001.md") {
          return "## Chunk B\n\nMethodological caveat about sample selection.";
        }
        throw new Error(`Unexpected blob read: ${key}`);
      },
    },
  });
  const restoreOpenrouter = patchModule("../lib/llm/openrouter.ts", {
    callLLMJson: async (options: { messages: Array<{ role: string; content: string }> }) => {
      const userMessage = options.messages.find((message) => message.role === "user")?.content;
      assert.equal(typeof userMessage, "string");
      llmInputs.push(userMessage);

      if (userMessage.includes("Chunk A")) {
        return {
          data: {
            items: [
              {
                claim: "The intervention improved outcomes.",
                sourceId: "",
                sourceName: "",
                location: "Chunk A",
                confidence: "high",
                quote: "improving outcomes",
                evidenceType: "supporting",
              },
            ],
          },
          raw: {
            content: "",
            model: "test-model",
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            latencyMs: 0,
          },
        };
      }

      if (userMessage.includes("Chunk B")) {
        return {
          data: {
            items: [
              {
                claim: "Sample selection limits the conclusion.",
                sourceId: "",
                sourceName: "",
                location: "Chunk B",
                confidence: "medium",
                quote: "sample selection",
                evidenceType: "methodological",
              },
            ],
          },
          raw: {
            content: "",
            model: "test-model",
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            latencyMs: 0,
          },
        };
      }

      throw new Error(`Unexpected user prompt: ${userMessage}`);
    },
  });
  const restoreMemoryStore = patchModule("../lib/storage/memory-store.ts", {
    memoryStore: {
      updateProgress: () => {},
    },
  });

  try {
    clearModule("../lib/engine/nodes/analyze-evidence.ts");
    const loadedModule = reloadModule<typeof import("../lib/engine/nodes/analyze-evidence")>(
      "../lib/engine/nodes/analyze-evidence.ts"
    );

    const result = await loadedModule.analyzeEvidence({
      runId: "run-1",
      projectId: "project-1",
      userId: "user-1",
      status: "running",
      currentStep: "build_source_set",
      input: {
        researchQuestion: "Does the intervention work?",
      },
      perspective: {
        briefSummary: "Review intervention evidence",
        interpretedIntent: "Review intervention evidence",
        inferredResearchFrame: "Intervention effectiveness",
        evidenceForCriteria: [],
        evidenceAgainstCriteria: [],
        subquestions: ["What are the outcomes?"],
      },
      sources: [],
      parsedSources: [
        {
          sourceId: "source-1",
          name: "Paper 1",
          normalizedBlobKey: "sources/source-1/normalized.md",
          charCount: 1200,
          estimatedTokens: 300,
          parseQuality: "validated",
          metadata: {},
        },
      ],
      sourceChunks: [
        {
          sourceId: "source-1",
          sourceName: "Paper 1",
          chunkIndex: 0,
          headingPath: "Intro",
          tokenEstimate: 30,
          charCount: 80,
          blobKey: "sources/source-1/chunks/0000.md",
        },
        {
          sourceId: "source-1",
          sourceName: "Paper 1",
          chunkIndex: 1,
          headingPath: "Methods",
          tokenEstimate: 25,
          charCount: 75,
          blobKey: "sources/source-1/chunks/0001.md",
        },
      ],
      errors: [],
      startedAt: "",
      completedAt: "",
    });

    assert.deepEqual(blobReads, [
      "sources/source-1/chunks/0000.md",
      "sources/source-1/chunks/0001.md",
    ]);
    assert.equal(llmInputs.length, 2);
    assert.ok(result.evidenceMap);
    assert.equal(result.evidenceMap?.supportingEvidence.length, 1);
    assert.equal(result.evidenceMap?.methodologicalCautions.length, 1);
  } finally {
    restoreMemoryStore();
    restoreOpenrouter();
    restoreBlobStore();
  }
});
