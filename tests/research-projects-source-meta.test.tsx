import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const requireFrom = createRequire(import.meta.url);

function reloadModule<T>(modulePath: string): T {
  const resolved = requireFrom.resolve(modulePath);
  delete requireFrom.cache[resolved];
  return requireFrom(modulePath) as T;
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

test("getSourceMetadataForRun exposes stored paper-quality metadata", async () => {
  const restoreClient = patchModule("../lib/db/client.ts", {
    db: {
      select: () => ({
        from: () => ({
          where: async () => [
            {
              id: "source-1",
              name: "Retriever Survey",
              origin: "discovered",
              metadata: {
                folder: "High Signal",
                paperQuality: {
                  metrics: {
                    citationCount: 220,
                    influentialCitationCount: 20,
                  },
                  hints: {
                    labels: ["Highly cited", "Influential"],
                  },
                },
              },
            },
          ],
        }),
      }),
    },
  });

  try {
    const loadedModule = reloadModule<
      typeof import("../lib/db/research-projects")
    >("../lib/db/research-projects.ts");

    const result = await loadedModule.getSourceMetadataForRun("run-1");

    assert.deepEqual(result, {
      "source-1": {
        name: "Retriever Survey",
        origin: "discovered",
        folder: "High Signal",
        paperQuality: {
          metrics: {
            citationCount: 220,
            influentialCitationCount: 20,
          },
          hints: {
            labels: ["Highly cited", "Influential"],
          },
        },
      },
    });
  } finally {
    restoreClient();
  }
});
