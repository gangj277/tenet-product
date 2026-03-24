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

test("initGraph stops after build_source_set returns failed status", async () => {
  let classifyCalls = 0;
  let consolidateCalls = 0;
  let synthesizeCalls = 0;
  let persistCalls = 0;

  const restoreIntake = patchModule("../lib/engine/nodes/intake-user-context.ts", {
    intakeUserContext: async () => ({}),
  });
  const restoreInfer = patchModule("../lib/engine/nodes/infer-user-perspective.ts", {
    inferUserPerspective: async () => ({
      perspective: {
        projectTitle: "Test project",
        briefSummary: "Summary",
        interpretedIntent: "Intent",
        inferredResearchFrame: "Frame",
        evidenceForCriteria: [],
        evidenceAgainstCriteria: [],
        subquestions: [],
      },
    }),
  });
  const restoreConfirm = patchModule("../lib/engine/nodes/confirm-inferred-brief.ts", {
    confirmInferredBrief: async () => ({}),
  });
  const restorePlan = patchModule("../lib/engine/nodes/plan-search-queries.ts", {
    planSearchQueries: async () => ({
      searchQueryPlan: {
        queries: [{ query: "test", intent: "test" }],
      },
    }),
  });
  const restoreBuild = patchModule("../lib/engine/nodes/build-source-set.ts", {
    buildSourceSet: async () => ({
      status: "failed" as const,
      currentStep: "build_source_set",
      errors: [
        {
          step: "build_source_set",
          message: "All candidate sources failed normalization or parsing",
          retryable: false,
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });
  const restoreClassify = patchModule("../lib/engine/nodes/classify-and-analyze.ts", {
    classifyAndAnalyze: async () => {
      classifyCalls += 1;
      return {};
    },
  });
  const restoreConsolidate = patchModule("../lib/engine/nodes/consolidate-findings.ts", {
    consolidateFindings: async () => {
      consolidateCalls += 1;
      return {};
    },
  });
  const restoreSynthesize = patchModule("../lib/engine/nodes/synthesize-project.ts", {
    synthesizeProject: async () => {
      synthesizeCalls += 1;
      return {};
    },
  });
  const restorePersist = patchModule("../lib/engine/nodes/persist-project.ts", {
    persistProject: async () => {
      persistCalls += 1;
      return {};
    },
  });

  try {
    clearModule("../lib/engine/graph.ts");
    const loadedModule = reloadModule<typeof import("../lib/engine/graph")>(
      "../lib/engine/graph.ts"
    );

    const result = await loadedModule.initGraph.invoke(
      {
        projectId: "project-1",
        runId: "run-1",
        userId: "user-1",
        status: "queued" as const,
        currentStep: "",
        input: { researchQuestion: "Why did source parsing fail?" },
        sources: [],
        parsedSources: [],
        sourceChunks: [],
        errors: [],
        startedAt: "",
        completedAt: "",
      },
      {
        configurable: { thread_id: `fail-fast-${Date.now()}` },
      }
    );

    assert.equal(result.status, "failed");
    assert.equal(result.currentStep, "build_source_set");
    assert.equal(classifyCalls, 0);
    assert.equal(consolidateCalls, 0);
    assert.equal(synthesizeCalls, 0);
    assert.equal(persistCalls, 0);
  } finally {
    restorePersist();
    restoreSynthesize();
    restoreConsolidate();
    restoreClassify();
    restoreBuild();
    restorePlan();
    restoreConfirm();
    restoreInfer();
    restoreIntake();
    clearModule("../lib/engine/graph.ts");
  }
});
