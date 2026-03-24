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

test("mergeWorkspaceArtifacts keeps cached edits but includes persisted discovered sources", () => {
  const loadedModule = reloadModule<
    typeof import("../lib/workspace/source-cache")
  >("../lib/workspace/source-cache.ts");

  const merged = loadedModule.mergeWorkspaceArtifacts(
    {
      overview: "cached overview",
      synthesis: "cached synthesis",
      claims: "cached claims",
      gaps: "cached gaps",
      nextSteps: "cached next steps",
      sources: {
        "source-existing": "cached summary",
      },
      papers: {},
      notes: {},
      experiments: {},
    },
    {
      overview: "persisted overview",
      synthesis: "persisted synthesis",
      claims: "persisted claims",
      gaps: "persisted gaps",
      nextSteps: "persisted next steps",
      sources: {
        "source-existing": "persisted summary",
        "source-discovered": "persisted discovered summary",
      },
      papers: {},
      notes: {},
      experiments: {},
    }
  );

  assert.ok(merged);
  assert.equal(merged.overview, "cached overview");
  assert.equal(merged.sources["source-existing"], "cached summary");
  assert.equal(merged.sources["source-discovered"], "persisted discovered summary");
});

test("executeSearchExternalSources syncs added sources into workspace cache", async () => {
  const cachedArtifacts = {
    overview: "",
    synthesis: "",
    claims: "",
    gaps: "",
    nextSteps: "",
    sources: {},
    papers: {},
    notes: {},
    experiments: {},
  };
  const cachedMeta: Record<string, unknown> = {};

  const restoreDiscovery = patchModule("../lib/discovery/scholarly-search.ts", {
    discoverScholarlySources: async () => [
      {
        title: "Retriever Survey",
        url: "https://doi.org/10.1000/retriever",
        pdfUrl: "https://publisher.example/retriever.pdf",
        publishedDate: "2024-01-10",
        author: "Example Author",
        venue: "ExampleConf",
        paperQuality: {
          metrics: {
            citationCount: 220,
            influentialCitationCount: 20,
          },
          hints: {
            labels: ["Highly cited"],
          },
        },
      },
    ],
  });

  const restoreIngest = patchModule("../lib/ingest/source-ingestion.ts", {
    ingestDiscoveredSource: async () => ({
      source: {
        sourceId: "source-1",
        name: "Retriever Survey",
        origin: "discovered",
        mimeType: "application/pdf",
        checksum: "",
        storageUrl: "sources/source-1/raw.pdf",
        parseStatus: "parsed",
        metadata: {
          sourceUrl: "https://doi.org/10.1000/retriever",
          resolvedUrl: "https://publisher.example/retriever.pdf",
          normalizedBlobKey: "sources/source-1/normalized.md",
          paperQuality: {
            metrics: {
              citationCount: 220,
              influentialCitationCount: 20,
            },
            hints: {
              labels: ["Highly cited"],
            },
          },
        },
      },
    }),
  });

  const restoreBlob = patchModule("../lib/storage/blob-store.ts", {
    blobStore: {
      getText: async () => "A".repeat(1000),
    },
  });

  const restoreLlm = patchModule("../lib/llm/runtime.ts", {
    callLLMJson: async () => ({
      data: {
        findings: [],
        summary: "Useful evidence about retrieval systems.",
        limitations: "Limited benchmark diversity.",
      },
    }),
  });

  const restoreDb = patchModule("../lib/db/research-projects.ts", {
    addAgentDiscoveredSource: async () => {},
    getResearchRun: async () => ({
      runId: "run-1",
      projectId: "project-1",
      status: "completed",
      currentStep: null,
    }),
    getSourceMetadataForRun: async () => ({}),
  });

  const restoreFolder = patchModule("../lib/ingest/classify-source-folder.ts", {
    classifySourceIntoFolder: async () => "Evidence",
  });

  const restoreMemoryStore = patchModule("../lib/storage/memory-store.ts", {
    memoryStore: {
      getRun: () => ({
        projectId: "project-1",
        runId: "run-1",
        status: "completed",
        updatedAt: new Date().toISOString(),
        artifacts: cachedArtifacts,
      }),
      getArtifacts: () => cachedArtifacts,
      getSourcesMeta: () => cachedMeta,
      saveArtifacts: async () => {},
      saveSourcesMeta: (_projectId: string, meta: Record<string, unknown>) => {
        for (const key of Object.keys(cachedMeta)) {
          delete cachedMeta[key];
        }
        Object.assign(cachedMeta, meta);
      },
    },
  });

  try {
    clearModule("../lib/workspace/source-cache.ts");
    clearModule("../lib/agent/tools/search-external-sources.ts");
    const loadedModule = reloadModule<
      typeof import("../lib/agent/tools/search-external-sources")
    >("../lib/agent/tools/search-external-sources.ts");

    const result = await loadedModule.executeSearchExternalSources(
      {
        searches: [{ query: "retrieval augmented generation", intent: "find benchmark evidence" }],
        extraction_goal: "Find evidence about retrieval effectiveness",
      },
      undefined,
      {
        runId: "run-1",
        workspaceFiles: {},
        availableKeys: [],
      }
    );

    assert.equal(result.addedSources?.length, 1);
    assert.match(cachedArtifacts.sources["source-1"], /Retriever Survey/);
    assert.match(cachedArtifacts.sources["source-1"], /Useful evidence about retrieval systems/);
    assert.deepEqual(cachedMeta["source-1"], {
      name: "Retriever Survey",
      origin: "discovered",
      folder: "Evidence",
      sourceUrl: "https://publisher.example/retriever.pdf",
      paperQuality: {
        metrics: {
          citationCount: 220,
          influentialCitationCount: 20,
        },
        hints: {
          labels: ["Highly cited"],
        },
      },
    });
  } finally {
    restoreMemoryStore();
    restoreFolder();
    restoreDb();
    restoreLlm();
    restoreBlob();
    restoreIngest();
    restoreDiscovery();
  }
});
