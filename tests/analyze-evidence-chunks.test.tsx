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

test("analyzeEvidence digests short sources from the normalized document in a single source-level call", async () => {
  const blobReads: string[] = [];
  const llmCalls: Array<{ schemaName: string; userContent: string }> = [];

  const restoreBlobStore = patchModule("../lib/storage/blob-store.ts", {
    blobStore: {
      async getText(key: string) {
        blobReads.push(key);
        if (key === "sources/source-1/normalized.md") {
          return [
            "# Intervention Study",
            "",
            "## Results",
            "",
            "The intervention improved outcomes relative to the control condition.",
            "",
            "## Limitations",
            "",
            "Sample selection and site bias limit the external validity of the result.",
          ].join("\n");
        }
        throw new Error(`Unexpected blob read: ${key}`);
      },
    },
  });
  const restoreRuntime = patchModule("../lib/llm/runtime.ts", {
    callLLMJson: async (options: {
      jsonSchema?: { name: string };
      messages: Array<{ role: string; content: string }>;
    }) => {
      const userMessage = options.messages.find((message) => message.role === "user")?.content;
      assert.equal(typeof userMessage, "string");
      const schemaName = options.jsonSchema?.name ?? "unknown";
      llmCalls.push({ schemaName, userContent: userMessage as string });

      assert.equal(schemaName, "source_digest");

      return {
        data: {
          sourceSummary:
            "The source reports improved outcomes, but the result is limited by sample-selection bias.",
          claims: [
            {
              claimSignature: "intervention-improves-outcomes",
              claim:
                "The intervention improved outcomes relative to the control condition.",
              subquestion: "What outcomes were observed?",
              stance: "supporting",
              confidence: "high",
              citations: [
                {
                  location: "Results",
                  quote:
                    "The intervention improved outcomes relative to the control condition.",
                },
              ],
              caveats: [],
            },
          ],
          methodologicalNotes: [
            {
              note: "Sample selection and site bias limit external validity.",
              confidence: "medium",
              citations: [
                {
                  location: "Limitations",
                  quote:
                    "Sample selection and site bias limit the external validity of the result.",
                },
              ],
            },
          ],
          openQuestions: [],
        },
        raw: {
          content: "",
          model: "test-model",
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          latencyMs: 0,
        },
      };
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
        projectTitle: "Intervention evidence",
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
    } as unknown as Parameters<typeof loadedModule.analyzeEvidence>[0]);

    assert.deepEqual(blobReads, ["sources/source-1/normalized.md"]);
    assert.equal(llmCalls.length, 1);
    assert.equal(llmCalls[0]?.schemaName, "source_digest");
    assert.ok(result.sourceDigests);
    const sourceDigests = result.sourceDigests as unknown[];
    assert.equal(sourceDigests.length, 1);
    assert.ok(result.evidenceMap);
    const evidenceMap = result.evidenceMap as {
      supportingEvidence: unknown[];
      methodologicalCautions: unknown[];
    };
    assert.equal(evidenceMap.supportingEvidence.length, 1);
    assert.equal(evidenceMap.methodologicalCautions.length, 1);
  } finally {
    restoreMemoryStore();
    restoreRuntime();
    restoreBlobStore();
  }
});

test("analyzeEvidence still digests directly from the normalized document when chunk metadata is absent", async () => {
  const blobReads: string[] = [];
  const llmCalls: string[] = [];

  const restoreBlobStore = patchModule("../lib/storage/blob-store.ts", {
    blobStore: {
      async getText(key: string) {
        blobReads.push(key);
        assert.equal(key, "sources/source-2/normalized.md");
        return "The source says churn fell after onboarding changes.";
      },
    },
  });
  const restoreRuntime = patchModule("../lib/llm/runtime.ts", {
    callLLMJson: async (options: {
      jsonSchema?: { name: string };
    }) => {
      llmCalls.push(options.jsonSchema?.name ?? "unknown");
      return {
        data: {
          sourceSummary: "Onboarding changes were associated with lower churn.",
          claims: [
            {
              claimSignature: "onboarding-lowers-churn",
              claim: "Onboarding changes were associated with lower churn.",
              subquestion: "What improved?",
              stance: "supporting",
              confidence: "medium",
              citations: [{ location: "Source" }],
              caveats: [],
            },
          ],
          methodologicalNotes: [],
          openQuestions: [],
        },
        raw: {
          content: "",
          model: "test-model",
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          latencyMs: 0,
        },
      };
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
      runId: "run-2",
      projectId: "project-2",
      userId: "user-2",
      status: "running",
      currentStep: "build_source_set",
      input: {
        researchQuestion: "Did onboarding help retention?",
      },
      perspective: {
        projectTitle: "Retention review",
        briefSummary: "Review retention evidence",
        interpretedIntent: "Review retention evidence",
        inferredResearchFrame: "Retention improvement",
        evidenceForCriteria: [],
        evidenceAgainstCriteria: [],
        subquestions: ["What improved?"],
      },
      sources: [],
      parsedSources: [
        {
          sourceId: "source-2",
          name: "Memo 2",
          normalizedBlobKey: "sources/source-2/normalized.md",
          charCount: 256,
          estimatedTokens: 64,
          parseQuality: "validated",
          metadata: {},
        },
      ],
      sourceChunks: [],
      errors: [],
      startedAt: "",
      completedAt: "",
    } as unknown as Parameters<typeof loadedModule.analyzeEvidence>[0]);

    assert.deepEqual(blobReads, ["sources/source-2/normalized.md"]);
    assert.deepEqual(llmCalls, ["source_digest"]);
    assert.ok(result.sourceDigests);
    const sourceDigests = result.sourceDigests as unknown[];
    assert.equal(sourceDigests.length, 1);
  } finally {
    restoreMemoryStore();
    restoreRuntime();
    restoreBlobStore();
  }
});

test("analyzeEvidence falls back to the normalized source when every window digest fails", async () => {
  const blobReads: string[] = [];
  const llmCalls: string[] = [];

  const restoreBlobStore = patchModule("../lib/storage/blob-store.ts", {
    blobStore: {
      async getText(key: string) {
        blobReads.push(key);
        if (key === "sources/source-3/normalized.md") {
          return [
            "# Robotics cyber security",
            "",
            "This survey reviews vulnerabilities, attacks, countermeasures, and recommendations for robotics systems.",
          ].join("\n");
        }

        if (key === "sources/source-3/chunks/0000.md") {
          return "Chunked robotics security analysis text.";
        }

        throw new Error(`Unexpected blob read: ${key}`);
      },
    },
  });
  const restoreRuntime = patchModule("../lib/llm/runtime.ts", {
    callLLMJson: async (options: {
      jsonSchema?: { name: string };
    }) => {
      const schemaName = options.jsonSchema?.name ?? "unknown";
      llmCalls.push(schemaName);

      if (schemaName === "source_window_notes") {
        throw new Error("window digest rejected");
      }

      assert.equal(schemaName, "source_digest");
      return {
        data: {
          sourceSummary:
            "The survey catalogs robotics cybersecurity risks and recommends layered mitigations.",
          claims: [
            {
              claimSignature: "robotics-security-risks",
              claim:
                "Robotics systems face recurring cybersecurity vulnerabilities across software, networks, and sensors.",
              confidence: "medium",
              stance: "supporting",
              citations: [{ location: "Source" }],
              caveats: [],
            },
          ],
          methodologicalNotes: [],
          openQuestions: [],
        },
        raw: {
          content: "",
          model: "test-model",
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          latencyMs: 0,
        },
      };
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
      runId: "run-3",
      projectId: "project-3",
      userId: "user-3",
      status: "running",
      currentStep: "build_source_set",
      input: {
        researchQuestion: "How secure are robotics systems?",
      },
      perspective: {
        projectTitle: "Robotics security review",
        briefSummary: "Review robotics cybersecurity evidence",
        interpretedIntent: "Review robotics cybersecurity evidence",
        inferredResearchFrame: "Robotics security risks",
        evidenceForCriteria: [],
        evidenceAgainstCriteria: [],
        subquestions: ["What risks recur?"],
      },
      sources: [],
      parsedSources: [
        {
          sourceId: "source-3",
          name: "Robotics cyber security: vulnerabilities, attacks, countermeasures, and recommendations",
          normalizedBlobKey: "sources/source-3/normalized.md",
          charCount: 50000,
          estimatedTokens: 12000,
          parseQuality: "validated",
          metadata: {},
        },
      ],
      sourceChunks: [
        {
          sourceId: "source-3",
          sourceName:
            "Robotics cyber security: vulnerabilities, attacks, countermeasures, and recommendations",
          chunkIndex: 0,
          headingPath: "Survey",
          tokenEstimate: 500,
          charCount: 2000,
          blobKey: "sources/source-3/chunks/0000.md",
        },
      ],
      errors: [],
      startedAt: "",
      completedAt: "",
    } as unknown as Parameters<typeof loadedModule.analyzeEvidence>[0]);

    assert.ok(result.sourceDigests);
    assert.deepEqual(llmCalls, ["source_window_notes", "source_digest"]);
    assert.deepEqual(blobReads, [
      "sources/source-3/chunks/0000.md",
      "sources/source-3/normalized.md",
    ]);
  } finally {
    restoreMemoryStore();
    restoreRuntime();
    restoreBlobStore();
  }
});

test("analyzeEvidence falls back to the normalized source when chunk windows are empty", async () => {
  const llmCalls: string[] = [];

  const restoreBlobStore = patchModule("../lib/storage/blob-store.ts", {
    blobStore: {
      async getText(key: string) {
        if (key === "sources/source-4/normalized.md") {
          return "A complete normalized source text is available for fallback digestion.";
        }

        if (key === "sources/source-4/chunks/0000.md") {
          return "";
        }

        throw new Error(`Unexpected blob read: ${key}`);
      },
    },
  });
  const restoreRuntime = patchModule("../lib/llm/runtime.ts", {
    callLLMJson: async (options: {
      jsonSchema?: { name: string };
    }) => {
      const schemaName = options.jsonSchema?.name ?? "unknown";
      llmCalls.push(schemaName);
      assert.equal(schemaName, "source_digest");

      return {
        data: {
          sourceSummary: "Fallback digest succeeded from the normalized document.",
          claims: [],
          methodologicalNotes: [],
          openQuestions: [],
        },
        raw: {
          content: "",
          model: "test-model",
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          latencyMs: 0,
        },
      };
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
      runId: "run-4",
      projectId: "project-4",
      userId: "user-4",
      status: "running",
      currentStep: "build_source_set",
      input: {
        researchQuestion: "What fallback should evidence digestion use?",
      },
      perspective: {
        projectTitle: "Fallback review",
        briefSummary: "Review fallback behavior",
        interpretedIntent: "Review fallback behavior",
        inferredResearchFrame: "Digest fallback",
        evidenceForCriteria: [],
        evidenceAgainstCriteria: [],
        subquestions: ["What happens if chunk windows are empty?"],
      },
      sources: [],
      parsedSources: [
        {
          sourceId: "source-4",
          name: "Fallback Source",
          normalizedBlobKey: "sources/source-4/normalized.md",
          charCount: 60000,
          estimatedTokens: 15000,
          parseQuality: "validated",
          metadata: {},
        },
      ],
      sourceChunks: [
        {
          sourceId: "source-4",
          sourceName: "Fallback Source",
          chunkIndex: 0,
          headingPath: "Empty chunk",
          tokenEstimate: 100,
          charCount: 0,
          blobKey: "sources/source-4/chunks/0000.md",
        },
      ],
      errors: [],
      startedAt: "",
      completedAt: "",
    } as unknown as Parameters<typeof loadedModule.analyzeEvidence>[0]);

    assert.ok(result.sourceDigests);
    assert.deepEqual(llmCalls, ["source_digest"]);
  } finally {
    restoreMemoryStore();
    restoreRuntime();
    restoreBlobStore();
  }
});
