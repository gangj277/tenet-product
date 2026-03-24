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

test("inferUserPerspective uses the dedicated mini model for intent locking", async () => {
  const llmCalls: Array<{ model: string; userContent: string }> = [];

  const restoreRuntime = patchModule("../lib/llm/runtime.ts", {
    callLLMJson: async (options: {
      model: string;
      messages: Array<{ role: string; content: string }>;
    }) => {
      llmCalls.push({
        model: options.model,
        userContent:
          options.messages.find((message) => message.role === "user")?.content ?? "",
      });

      return {
        data: {
          projectTitle: "Test workspace",
          briefSummary: "Summary",
          interpretedIntent: "Intent",
          inferredResearchFrame: "Frame",
          evidenceForCriteria: ["Support"],
          evidenceAgainstCriteria: ["Contradiction"],
          subquestions: ["Question"],
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

  try {
    clearModule("../lib/engine/nodes/infer-user-perspective.ts");
    const loadedModule = reloadModule<
      typeof import("../lib/engine/nodes/infer-user-perspective")
    >("../lib/engine/nodes/infer-user-perspective.ts");

    const result = await loadedModule.inferUserPerspective({
      input: {
        researchQuestion: "What matters most for port orchestration?",
        researchIntent: "Find the best coordination architecture",
      },
    } as Parameters<typeof loadedModule.inferUserPerspective>[0]);

    assert.equal(result.currentStep, "infer_user_perspective");
    assert.equal(llmCalls[0]?.model, "gpt-5.4-mini");
    assert.match(llmCalls[0]?.userContent ?? "", /port orchestration/i);
  } finally {
    restoreRuntime();
    clearModule("../lib/engine/nodes/infer-user-perspective.ts");
  }
});
