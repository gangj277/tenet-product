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
  const restoreRuntime = patchModule("../lib/llm/runtime.ts", {
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
        projectTitle: "Paper synthesis",
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
    } as unknown as Parameters<typeof loadedModule.synthesizeProject>[0]);

    assert.ok(result.artifacts);
    assert.deepEqual(blobReads, ["sources/source-1/normalized.md"]);
    assert.ok(userPayloads.some((payload) => payload.includes("blob storage")));
  } finally {
    restoreMemoryStore();
    restoreRuntime();
    restoreBlobStore();
  }
});

test("synthesizeProject keeps concise enhancements bounded to prompt updates while sending one shared core context", async () => {
  const llmCalls: Array<{
    systemPrompt: string;
    userContent: string;
    maxTokens?: number;
    temperature?: number;
  }> = [];

  const restoreBlobStore = patchModule("../lib/storage/blob-store.ts", {
    blobStore: {
      async getText() {
        return "# Source\n\nThis normalized source text came from blob storage.";
      },
    },
  });
  const restoreRuntime = patchModule("../lib/llm/runtime.ts", {
    callLLM: async (options: {
      messages: Array<{ role: string; content: string }>;
      maxTokens?: number;
      temperature?: number;
    }) => {
      llmCalls.push({
        systemPrompt:
          options.messages.find((message) => message.role === "system")?.content ?? "",
        userContent:
          options.messages.find((message) => message.role === "user")?.content ?? "",
        maxTokens: options.maxTokens,
        temperature: options.temperature,
      });

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

    const canonicalClaims = Array.from({ length: 9 }, (_, index) => ({
      claim: `Claim ${index + 1}`,
      support: [
        {
          claim: `Support ${index + 1}`,
          sourceId: `s${index + 1}`,
          sourceName: `Paper ${index + 1}`,
          location: "Results",
          confidence: "high" as const,
          evidenceType: "supporting" as const,
          quote: `Support quote ${index + 1}`,
        },
      ],
      contradictions: index === 0
        ? [
            {
              claim: "Contradiction",
              sourceId: "c1",
              sourceName: "Counter paper",
              location: "Discussion",
              confidence: "medium" as const,
              evidenceType: "contradictory" as const,
              quote: "Counter quote",
            },
          ]
        : [],
      confidence: "medium",
    }));

    await loadedModule.synthesizeProject({
      runId: "run-1",
      projectId: "project-1",
      userId: "user-1",
      status: "running",
      currentStep: "consolidate_findings",
      input: {
        researchQuestion: "Should ports use centralized coordination?",
        researchIntent: "Find the most defensible architecture",
        workingHypothesis: "Integrated coordination helps but centralization may overclaim",
        scopeBoundaries: "Focus on direct evidence and architecture tradeoffs.",
      },
      perspective: {
        projectTitle: "Port orchestration",
        briefSummary: "Summary",
        interpretedIntent: "Determine whether centralized orchestration is justified",
        inferredResearchFrame: "Integrated system coordination helps, but centralization may be unproven",
        evidenceForCriteria: ["Improved throughput", "Better resilience"],
        evidenceAgainstCriteria: ["Scalability limits", "Brittle failure modes"],
        subquestions: ["What supports central coordination?", "What weakens it?"],
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
        canonicalClaims,
        prioritizedSupport: canonicalClaims.flatMap((claim) => claim.support).slice(0, 4),
        prioritizedContradictions: canonicalClaims.flatMap((claim) => claim.contradictions),
        openQuestions: [
          "How well does centralized control scale?",
          "What failures appear under disruption?",
        ],
        confidenceNotes: [
          "Most direct evidence supports integrated coordination, not centralized superiority.",
        ],
        unresolvedDisagreements: [
          "Distributed versus centralized control remains unresolved.",
        ],
      },
      errors: [],
      startedAt: "",
      completedAt: "",
    } as unknown as Parameters<typeof loadedModule.synthesizeProject>[0]);

    const overviewCall = llmCalls.find((call) => call.systemPrompt.includes("overview.md"));
    const synthesisCall = llmCalls.find((call) => call.systemPrompt.includes("synthesis.md"));
    const claimsCall = llmCalls.find((call) => call.systemPrompt.includes("claims.md"));
    const gapsCall = llmCalls.find((call) => call.systemPrompt.includes("gaps.md"));
    const nextStepsCall = llmCalls.find((call) => call.systemPrompt.includes("next-steps.md"));

    assert.ok(overviewCall);
    assert.ok(synthesisCall);
    assert.ok(claimsCall);
    assert.ok(gapsCall);
    assert.ok(nextStepsCall);

    const overviewPayload = JSON.parse(overviewCall!.userContent) as Record<string, unknown>;
    const synthesisPayload = JSON.parse(synthesisCall!.userContent) as Record<string, unknown>;
    const claimsPayload = JSON.parse(claimsCall!.userContent) as Record<string, unknown>;
    const gapsPayload = JSON.parse(gapsCall!.userContent) as Record<string, unknown>;
    const nextStepsPayload = JSON.parse(nextStepsCall!.userContent) as Record<string, unknown>;

    assert.deepEqual(Object.keys(overviewPayload).sort(), [
      "consolidatedFindings",
      "input",
      "perspective",
      "sourceBase",
    ]);
    assert.deepEqual(synthesisPayload, overviewPayload);
    assert.deepEqual(claimsPayload, overviewPayload);
    assert.deepEqual(gapsPayload, overviewPayload);
    assert.deepEqual(nextStepsPayload, overviewPayload);

    const consolidatedFindings = overviewPayload.consolidatedFindings as {
      canonicalClaims: unknown[];
    };
    const sourceBase = overviewPayload.sourceBase as Record<string, number>;

    assert.equal(consolidatedFindings.canonicalClaims.length, canonicalClaims.length);
    assert.deepEqual(sourceBase, {
      totalSources: 1,
      parsedSources: 1,
      uploadedSources: 0,
      discoveredSources: 1,
    });

    assert.equal(overviewCall?.maxTokens, 1200);
    assert.equal(synthesisCall?.maxTokens, 5120);
    assert.equal(synthesisCall?.temperature, 0.2);
    assert.equal(claimsCall?.maxTokens, 3072);
    assert.equal(gapsCall?.maxTokens, 2048);
    assert.equal(nextStepsCall?.maxTokens, 1536);
  } finally {
    restoreMemoryStore();
    restoreRuntime();
    restoreBlobStore();
  }
});
