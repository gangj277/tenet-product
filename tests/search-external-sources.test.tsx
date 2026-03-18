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

test("executeSearchExternalSources uses unified scholarly discovery instead of Exa", async () => {
  const restoreScholarlySearch = patchModule(
    "../lib/discovery/scholarly-search.ts",
    {
      discoverScholarlySources: async () => [
        {
          title: "Retriever Survey",
          url: "https://doi.org/10.1000/retriever",
          pdfUrl: "https://publisher.example/retriever.pdf",
          publishedDate: "2024-01-10",
          author: "Example Author",
          provider: "openalex",
          providers: ["openalex", "semantic-scholar"],
          paperQuality: {
            metrics: {
              citationCount: 220,
              influentialCitationCount: 20,
            },
            hints: {
              labels: ["Highly cited", "Influential", "Cross-indexed"],
            },
          },
        },
      ],
    }
  );

  try {
    const loadedModule = reloadModule<
      typeof import("../lib/agent/tools/search-external-sources")
    >("../lib/agent/tools/search-external-sources.ts");

    const result = await loadedModule.executeSearchExternalSources({
      query: "retrieval augmented generation",
      num_results: 5,
    });

    assert.equal(result.sources.length, 1);
    assert.equal(result.sources[0]?.title, "Retriever Survey");
    assert.match(result.result, /Found 1 external sources/);
    assert.match(result.result, /Retriever Survey/);
    assert.match(result.result, /Example Author/);
    assert.match(result.result, /220 citations/);
    assert.match(result.result, /20 influential/);
    assert.match(result.result, /Highly cited/);
  } finally {
    restoreScholarlySearch();
  }
});
