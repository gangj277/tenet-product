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

test("reduceAndClusterEvidence deduplicates repeated evidence-map items and groups related claims", () => {
  clearModule("../lib/engine/consolidation/reduce-and-cluster.ts");
  const loadedModule = reloadModule<
    typeof import("../lib/engine/consolidation/reduce-and-cluster")
  >("../lib/engine/consolidation/reduce-and-cluster.ts");

  const result = loadedModule.reduceAndClusterEvidence({
    perspective: {
      projectTitle: "RAG",
      briefSummary: "RAG reliability",
      interpretedIntent: "Measure whether RAG improves answer quality",
      inferredResearchFrame: "RAG accuracy",
      evidenceForCriteria: [],
      evidenceAgainstCriteria: [],
      subquestions: ["Does RAG improve factual accuracy?"],
    },
    evidenceMap: {
      supportingEvidence: [
        {
          claim: "Retrieval-augmented generation improves factual accuracy on knowledge-intensive QA benchmarks.",
          sourceId: "s1",
          sourceName: "Paper 1",
          location: "Results",
          confidence: "high",
          evidenceType: "supporting",
          quote: "RAG improved factual accuracy by 11 points.",
        },
        {
          claim: "RAG improves factual accuracy for knowledge-intensive question answering.",
          sourceId: "s2",
          sourceName: "Paper 2",
          location: "Section 4",
          confidence: "medium",
          evidenceType: "supporting",
          quote: "Accuracy increased on knowledge-intensive QA.",
        },
      ],
      contradictoryEvidence: [
        {
          claim: "RAG does not consistently improve factual accuracy when retrieval recall is poor.",
          sourceId: "s3",
          sourceName: "Paper 3",
          location: "Discussion",
          confidence: "medium",
          evidenceType: "contradictory",
          quote: "Benefits disappear under poor retrieval recall.",
        },
      ],
      strongClaims: [
        {
          claim: "Retrieval-augmented generation improves factual accuracy on knowledge-intensive QA benchmarks.",
          sourceId: "s1",
          sourceName: "Paper 1",
          location: "Results",
          confidence: "high",
          evidenceType: "supporting",
          quote: "RAG improved factual accuracy by 11 points.",
        },
      ],
      uncertainties: [
        {
          claim: "Benefits vary by retriever quality and corpus coverage.",
          sourceId: "s4",
          sourceName: "Paper 4",
          location: "Limitations",
          confidence: "low",
          evidenceType: "neutral",
          quote: "Results were sensitive to retriever quality.",
        },
      ],
      methodologicalCautions: [
        {
          claim: "Several studies rely on small benchmark sets and limited domains.",
          sourceId: "s5",
          sourceName: "Paper 5",
          location: "Methods",
          confidence: "medium",
          evidenceType: "methodological",
          quote: "The benchmark coverage was narrow.",
        },
      ],
      personaFindings: {},
    },
  });

  assert.equal(result.uniqueEvidence.length, 5);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.clusters.length, 3);

  const accuracyCluster = result.clusters.find((cluster) =>
    cluster.representativeClaim.toLowerCase().includes("factual accuracy")
  );

  assert.ok(accuracyCluster);
  assert.equal(accuracyCluster.supportingEvidence.length, 2);
  assert.equal(accuracyCluster.contradictoryEvidence.length, 1);
  assert.equal(accuracyCluster.sourceDiversity, 3);
});

test("consolidateFindings adjudicates batched claim families from source digests instead of one LLM call per cluster", async () => {
  const llmCalls: Array<{ model: string; userContent: string; schemaName: string }> = [];
  const progressUpdates: Array<Record<string, unknown>> = [];

  const restoreRuntime = patchModule("../lib/llm/runtime.ts", {
    callLLMJson: async (options: {
      model: string;
      messages: Array<{ role: string; content: string }>;
      jsonSchema?: { name: string };
    }) => {
      const userContent =
        options.messages.find((message) => message.role === "user")?.content ?? "";
      const schemaName = options.jsonSchema?.name ?? "unknown";
      llmCalls.push({ model: options.model, userContent, schemaName });

      if (schemaName === "claim_family_batch") {
        const payload = JSON.parse(userContent) as {
          families: Array<{ familyId: string; representativeClaim: string }>;
        };

        return {
          data: {
            canonicalClaims: payload.families.map((family) => ({
              claim: family.representativeClaim,
              support: [],
              contradictions: [],
              confidence: "medium",
            })),
            prioritizedSupport: [],
            prioritizedContradictions: [],
            openQuestions: [],
            confidenceNotes: [],
            unresolvedDisagreements: [],
          },
          raw: {
            content: "",
            model: options.model,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            latencyMs: 0,
          },
        };
      }

      assert.equal(schemaName, "consolidated_findings");
      return {
        data: {
          canonicalClaims: [
            {
              claim: "RAG improves factual accuracy",
              support: [],
              contradictions: [],
              confidence: "medium",
            },
          ],
          prioritizedSupport: [],
          prioritizedContradictions: [],
          openQuestions: ["How much does recall quality mediate the effect?"],
          confidenceNotes: ["Most evidence points in one direction."],
          unresolvedDisagreements: [],
        },
        raw: {
          content: "",
          model: options.model,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          latencyMs: 0,
        },
      };
    },
  });
  const restoreMemoryStore = patchModule("../lib/storage/memory-store.ts", {
    memoryStore: {
      updateProgress: (runId: string, stepId: string, update: Record<string, unknown>) => {
        progressUpdates.push({ runId, stepId, update });
      },
    },
  });

  try {
    clearModule("../lib/engine/nodes/consolidate-findings.ts");
    const loadedModule = reloadModule<
      typeof import("../lib/engine/nodes/consolidate-findings")
    >("../lib/engine/nodes/consolidate-findings.ts");

    const result = await loadedModule.consolidateFindings({
      runId: "run-1",
      projectId: "project-1",
      userId: "user-1",
      status: "running",
      currentStep: "analyze_evidence",
      input: { researchQuestion: "Does RAG improve factual accuracy?" },
      perspective: {
        projectTitle: "RAG",
        briefSummary: "RAG reliability",
        interpretedIntent: "Measure factual accuracy",
        inferredResearchFrame: "RAG accuracy",
        evidenceForCriteria: [],
        evidenceAgainstCriteria: [],
        subquestions: ["Does RAG improve factual accuracy?"],
      },
      sources: [],
      parsedSources: [],
      sourceChunks: [],
      evidenceMap: undefined,
      sourceDigests: Array.from({ length: 13 }, (_, index) => ({
        sourceId: `s${index + 1}`,
        sourceName: `Paper ${index + 1}`,
        sourceSummary: `Source summary ${index + 1}`,
        claims: [
          {
            claimSignature: `rag-accuracy-${index + 1}`,
            claim: `RAG improves factual accuracy pattern ${index + 1}.`,
            subquestion: "Does RAG improve factual accuracy?",
            stance: index === 12 ? "contradictory" : "supporting",
            confidence: index === 0 ? "high" : "medium",
            citations: [
              {
                location: "Results",
                quote: `Evidence quote ${index + 1}`,
              },
            ],
            caveats: index === 12 ? ["Benefits weaken under poor retrieval recall."] : [],
          },
        ],
        methodologicalNotes: [],
        openQuestions: [],
      })),
      claimFamilies: undefined,
      consolidatedFindings: undefined,
      artifacts: undefined,
      sourceFolders: undefined,
      errors: [],
      startedAt: "",
      completedAt: "",
    } as unknown as Parameters<typeof loadedModule.consolidateFindings>[0]);

    assert.ok(result.consolidatedFindings);
    assert.equal(result.currentStep, "consolidate_findings");
    assert.equal(llmCalls.length, 3);
    assert.equal(
      llmCalls.filter((call) => call.schemaName === "claim_family_batch").length,
      2
    );
    assert.equal(
      llmCalls.some((call) => call.schemaName === "cluster_consolidation"),
      false
    );
    assert.equal(llmCalls[0]?.model, "gpt-5.4-mini");
    assert.equal(llmCalls[2]?.model, "gpt-5.4");

    const batchPayload = JSON.parse(llmCalls[0]!.userContent) as Record<string, unknown>;
    assert.ok(Array.isArray(batchPayload.families));
    assert.equal("evidenceMap" in batchPayload, false);

    const finalPayload = JSON.parse(llmCalls[2]!.userContent) as Record<string, unknown>;
    assert.ok(Array.isArray(finalPayload.batchSummaries));
    assert.equal("clusterSummaries" in finalPayload, false);

    const runningUpdate = [...progressUpdates].reverse().find(
      (entry) =>
        entry.stepId === "consolidate_findings" &&
        (entry.update as { status?: string }).status === "running" &&
        Array.isArray((entry.update as { subSteps?: unknown[] }).subSteps) &&
        (entry.update as { subSteps?: Array<{ label: string; status: string }> }).subSteps?.[2]
          ?.status === "running"
    );
    assert.ok(runningUpdate);
    assert.deepEqual((runningUpdate!.update as { subSteps?: unknown[] }).subSteps, [
      { label: "Grouping claim families", status: "completed" },
      { label: "Adjudicating family batches", status: "completed" },
      { label: "Merging canonical findings", status: "running" },
    ]);
  } finally {
    restoreMemoryStore();
    restoreRuntime();
  }
});
