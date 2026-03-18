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

test("parsePDF aborts slow Gemini/OpenRouter requests instead of waiting indefinitely", async () => {
  const originalApiKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-key";

  try {
    const loadedModule = reloadModule<typeof import("../lib/pdf/gemini-extract")>(
      "../lib/pdf/gemini-extract.ts"
    );

    const hungRequest = loadedModule.parsePDF(
      Buffer.from("%PDF-1.4 test file"),
      "paper.pdf",
      {
        timeoutMs: 5,
        retries: 0,
        fetchImpl: async () =>
          new Promise<Response>(() => {
            // Intentionally never resolves.
          }),
      }
    );

    const result = await Promise.race([
      hungRequest.then(
        () => "resolved",
        (error) => error as Error
      ),
      new Promise<string>((resolve) => setTimeout(() => resolve("too slow"), 200)),
    ]);

    assert.notEqual(result, "too slow");
    assert.ok(result instanceof Error);
    assert.match(result.message, /timed out/i);
  } finally {
    if (originalApiKey === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = originalApiKey;
    }
  }
});

test("buildSourceSet limits simultaneous PDF parses for uploaded files", async () => {
  let activeParses = 0;
  let maxConcurrentParses = 0;

  const restoreMemoryStore = patchModule("../lib/storage/memory-store.ts", {
    memoryStore: {
      getFile: () => Buffer.from("%PDF-1.4 test file"),
      updateProgress: () => {},
    },
  });
  const restorePdfParser = patchModule("../lib/pdf/gemini-extract.ts", {
    parsePDF: async () => {
      activeParses++;
      maxConcurrentParses = Math.max(maxConcurrentParses, activeParses);
      await new Promise((resolve) => setTimeout(resolve, 20));
      activeParses--;
      return {
        text:
          "# Parsed source\n\n" +
          "Parsed source text with enough detail to pass validation. ".repeat(20),
        pageCount: 1,
      };
    },
  });

  try {
    clearModule("../lib/engine/nodes/build-source-set.ts");
    const loadedModule = reloadModule<typeof import("../lib/engine/nodes/build-source-set")>(
      "../lib/engine/nodes/build-source-set.ts"
    );

    const sources = Array.from({ length: 6 }, (_, index) => ({
      sourceId: `source-${index + 1}`,
      name: `Uploaded ${index + 1}.pdf`,
      origin: "uploaded" as const,
      mimeType: "application/pdf",
      checksum: "",
      storageUrl: `/tmp/source-${index + 1}.pdf`,
      parseStatus: "pending" as const,
    }));

    const result = await loadedModule.buildSourceSet({
      runId: "run-1",
      projectId: "project-1",
      userId: "user-1",
      status: "running",
      currentStep: "build_source_set",
      input: { researchQuestion: "Why is Gemini parsing slow?" },
      sources,
      parsedSources: [],
      errors: [],
      startedAt: "",
      completedAt: "",
    });

    assert.equal(result.parsedSources?.length, 6);
    assert.ok(maxConcurrentParses <= 4, `saw ${maxConcurrentParses} concurrent parses`);
  } finally {
    restorePdfParser();
    restoreMemoryStore();
  }
});

test("buildSourceSet preserves paper-quality metadata for discovered jobs", async () => {
  const discoveredCalls: Array<{
    sourceUrl: string;
    pdfUrl?: string;
    paperQuality?: {
      metrics?: { citationCount?: number; influentialCitationCount?: number };
      hints?: { labels?: string[] };
    };
  }> = [];

  const restoreMemoryStore = patchModule("../lib/storage/memory-store.ts", {
    memoryStore: {
      getFile: () => undefined,
      updateProgress: () => {},
    },
  });
  const restoreUnifiedDiscovery = patchModule(
    "../lib/discovery/scholarly-search.ts",
    {
      discoverScholarlySources: async () => [
        {
          title: "Provider-backed Paper",
          url: "https://publisher.example/paper",
          pdfUrl: "https://publisher.example/paper.pdf",
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
        {
          title: "arXiv Paper",
          url: "https://arxiv.org/abs/2405.16506v3",
          pdfUrl: "https://arxiv.org/pdf/2405.16506v3",
          paperQuality: {
            metrics: {
              citationCount: 120,
            },
            hints: {
              labels: ["Preprint"],
            },
          },
        },
      ],
    }
  );
  const restoreSourceIngestion = patchModule("../lib/ingest/source-ingestion.ts", {
    ingestUploadedSource: async () => {
      throw new Error("uploaded ingest should not be called");
    },
    ingestDiscoveredSource: async (params: {
      sourceId: string;
      title: string;
      sourceUrl: string;
      pdfUrl?: string;
      paperQuality?: {
        metrics?: { citationCount?: number; influentialCitationCount?: number };
        hints?: { labels?: string[] };
      };
    }) => {
      discoveredCalls.push({
        sourceUrl: params.sourceUrl,
        pdfUrl: params.pdfUrl,
        paperQuality: params.paperQuality,
      });

      return {
        source: {
          sourceId: params.sourceId,
          name: params.title,
          origin: "discovered" as const,
          mimeType: "application/pdf",
          checksum: "",
          storageUrl: params.pdfUrl ?? params.sourceUrl,
          parseStatus: "parsed" as const,
          metadata: {
            sourceKind: "pdf" as const,
            sourceUrl: params.sourceUrl,
            resolvedUrl: params.pdfUrl ?? params.sourceUrl,
            sniffedMimeType: "application/pdf",
            rawBlobKey: `raw/${params.sourceId}.pdf`,
            byteSize: 1024,
            parseQuality: "validated" as const,
            paperQuality: params.paperQuality,
          },
        },
        parsedSource: {
          sourceId: params.sourceId,
          name: params.title,
          normalizedBlobKey: `normalized/${params.sourceId}.md`,
          charCount: 1200,
          estimatedTokens: 300,
          parseQuality: "validated" as const,
          metadata: {},
        },
        sourceChunks: [
          {
            sourceId: params.sourceId,
            sourceName: params.title,
            chunkIndex: 0,
            headingPath: "Summary",
            tokenEstimate: 300,
            charCount: 1200,
            blobKey: `chunks/${params.sourceId}/0.md`,
          },
        ],
        warnings: [],
      };
    },
  });

  try {
    clearModule("../lib/engine/nodes/build-source-set.ts");
    const loadedModule = reloadModule<
      typeof import("../lib/engine/nodes/build-source-set")
    >("../lib/engine/nodes/build-source-set.ts");

    const result = await loadedModule.buildSourceSet({
      runId: "run-discovered",
      projectId: "project-1",
      userId: "user-1",
      status: "running",
      currentStep: "build_source_set",
      input: { researchQuestion: "What is the state of RAG?" },
      perspective: {
        projectTitle: "RAG",
        briefSummary: "Research retrieval-augmented generation",
        interpretedIntent: "retrieval augmented generation",
        inferredResearchFrame: "recent academic literature",
        evidenceForCriteria: [],
        evidenceAgainstCriteria: [],
        subquestions: ["What are recent RAG methods?"],
      },
      sources: [],
      parsedSources: [],
      sourceChunks: [],
      errors: [],
      startedAt: "",
      completedAt: "",
    });

    assert.deepEqual(discoveredCalls, [
      {
        sourceUrl: "https://publisher.example/paper",
        pdfUrl: "https://publisher.example/paper.pdf",
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
      {
        sourceUrl: "https://arxiv.org/abs/2405.16506v3",
        pdfUrl: "https://arxiv.org/pdf/2405.16506v3",
        paperQuality: {
          metrics: {
            citationCount: 120,
          },
          hints: {
            labels: ["Preprint"],
          },
        },
      },
    ]);
    assert.equal(result.sources?.length, 2);
    assert.equal(result.parsedSources?.length, 2);
    assert.equal(result.sourceChunks?.length, 2);
    assert.deepEqual(result.sources?.[0]?.metadata?.paperQuality, {
      metrics: {
        citationCount: 220,
        influentialCitationCount: 20,
      },
      hints: {
        labels: ["Highly cited", "Influential"],
      },
    });
  } finally {
    restoreSourceIngestion();
    restoreUnifiedDiscovery();
    restoreMemoryStore();
  }
});
