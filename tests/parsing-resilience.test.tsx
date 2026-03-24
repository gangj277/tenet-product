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

test("normalizeExtractedPdfText aborts slow provider calls instead of waiting indefinitely", async () => {
  const loadedModule = reloadModule<typeof import("../lib/pdf/gemini-extract")>(
    "../lib/pdf/gemini-extract.ts"
  );

  const hungRequest = loadedModule.normalizeExtractedPdfText(
    "This is enough extracted PDF text to trigger normalization. ".repeat(8),
    "paper.pdf",
    {
      timeoutMs: 5,
      retries: 0,
      provider: {
        kind: "openai_auth",
        callLLM: async () =>
          new Promise(() => {
            // Intentionally never resolves.
          }),
        async *callLLMStreaming() {
          yield {
            type: "done" as const,
            content: "",
            toolCalls: [],
          };
        },
      },
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
});

test("extractPdfTextWithModelDirectly sends the PDF bytes as an input_file part", async () => {
  const loadedModule = reloadModule<typeof import("../lib/pdf/gemini-extract")>(
    "../lib/pdf/gemini-extract.ts"
  );

  let capturedMessages:
    | Array<{ role: string; content: string | Array<Record<string, unknown>> | null }>
    | undefined;

  const text = await loadedModule.extractPdfTextWithModelDirectly(
    Buffer.from("%PDF-1.4 test pdf bytes"),
    "paper.pdf",
    {
      provider: {
        kind: "openai_auth",
        callLLM: async (options) => {
          capturedMessages = options.messages as Array<{
            role: string;
            content: string | Array<Record<string, unknown>> | null;
          }>;
          return {
            content:
              "# Paper\n\n" +
              "Extracted content from the PDF file. ".repeat(10),
            model: "gpt-5.4-mini",
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            latencyMs: 0,
          };
        },
        async *callLLMStreaming() {
          yield {
            type: "done" as const,
            content: "",
            toolCalls: [],
          };
        },
      },
      timeoutMs: 500,
      retries: 0,
    }
  );

  assert.match(text, /Extracted content/);
  const userMessage = capturedMessages?.find((message) => message.role === "user");
  assert.ok(userMessage);
  assert.ok(Array.isArray(userMessage.content));
  const content = userMessage.content as Array<Record<string, unknown>>;
  assert.equal(content[0]?.type, "input_file");
  assert.equal(content[0]?.filename, "paper.pdf");
  assert.equal(typeof content[0]?.file_data, "string");
  assert.equal(content[1]?.type, "input_text");
});

test("extractPdfTextWithModelFromUrl sends the PDF URL as an input_file part", async () => {
  const loadedModule = reloadModule<typeof import("../lib/pdf/gemini-extract")>(
    "../lib/pdf/gemini-extract.ts"
  );

  let capturedMessages:
    | Array<{ role: string; content: string | Array<Record<string, unknown>> | null }>
    | undefined;

  const text = await loadedModule.extractPdfTextWithModelFromUrl(
    "https://arxiv.org/pdf/2312.10997.pdf",
    "paper.pdf",
    {
      provider: {
        kind: "openai_auth",
        callLLM: async (options) => {
          capturedMessages = options.messages as Array<{
            role: string;
            content: string | Array<Record<string, unknown>> | null;
          }>;
          return {
            content:
              "# Paper\n\n" +
              "Extracted content from the remote PDF URL. ".repeat(10),
            model: "gpt-5.4-mini",
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            latencyMs: 0,
          };
        },
        async *callLLMStreaming() {
          yield {
            type: "done" as const,
            content: "",
            toolCalls: [],
          };
        },
      },
      timeoutMs: 500,
      retries: 0,
    }
  );

  assert.match(text, /remote PDF URL/);
  const userMessage = capturedMessages?.find((message) => message.role === "user");
  assert.ok(userMessage);
  assert.ok(Array.isArray(userMessage.content));
  const content = userMessage.content as Array<Record<string, unknown>>;
  assert.equal(content[0]?.type, "input_file");
  assert.equal(content[0]?.filename, undefined);
  assert.equal(content[0]?.file_url, "https://arxiv.org/pdf/2312.10997.pdf");
  assert.equal(content[1]?.type, "input_text");
});

test("buildSourceSet allows high parallel PDF parses for uploaded files", async () => {
  let activeParses = 0;
  let maxConcurrentParses = 0;

  const restoreMemoryStore = patchModule("../lib/storage/memory-store.ts", {
    memoryStore: {
      getFile: () => Buffer.from("%PDF-1.4 test file"),
      updateProgress: () => {},
    },
  });
  const restorePdfParser = patchModule("../lib/pdf/pdf-parse-orchestrator.ts", {
    parsePdfWithFallbacks: async () => {
      activeParses++;
      maxConcurrentParses = Math.max(maxConcurrentParses, activeParses);
      await new Promise((resolve) => setTimeout(resolve, 20));
      activeParses--;
      return {
        ok: true as const,
        text:
          "# Parsed source\n\n" +
          "Parsed source text with enough detail to pass validation. ".repeat(20),
        pageCount: 1,
        parseEngine: "pdfjs+normalize-lite",
        parseAttempts: 2,
        parseQuality: "validated" as const,
        attempts: [
          {
            stage: "local_extract" as const,
            engine: "pdfjs-local",
            ok: true,
            durationMs: 5,
            charCount: 1200,
          },
          {
            stage: "normalize_primary" as const,
            engine: "google/gemini-2.5-flash-lite",
            ok: true,
            durationMs: 15,
            charCount: 1200,
            quality: "validated",
          },
        ],
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
    } as unknown as Parameters<typeof loadedModule.buildSourceSet>[0]);

    const parsedSources = result.parsedSources as Array<unknown> | undefined;

    assert.equal(parsedSources?.length, 6);
    assert.equal(maxConcurrentParses, 6, `saw ${maxConcurrentParses} concurrent parses`);
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
    } as unknown as Parameters<typeof loadedModule.buildSourceSet>[0]);

    const resultSources = result.sources as
      | Array<{ metadata?: { paperQuality?: unknown } }>
      | undefined;
    const parsedSources = result.parsedSources as Array<unknown> | undefined;
    const sourceChunks = result.sourceChunks as Array<unknown> | undefined;

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
    assert.equal(resultSources?.length, 2);
    assert.equal(parsedSources?.length, 2);
    assert.equal(sourceChunks?.length, 2);
    assert.deepEqual(resultSources?.[0]?.metadata?.paperQuality, {
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

test("buildSourceSet reuses already-parsed workspace sources without re-ingesting them", async () => {
  let ingestUploadedCalls = 0;
  let ingestDiscoveredCalls = 0;

  const restoreMemoryStore = patchModule("../lib/storage/memory-store.ts", {
    memoryStore: {
      getFile: () => undefined,
      updateProgress: () => {},
    },
  });
  const restoreUnifiedDiscovery = patchModule(
    "../lib/discovery/scholarly-search.ts",
    {
      discoverScholarlySources: async () => [],
    }
  );
  const restoreSourceIngestion = patchModule("../lib/ingest/source-ingestion.ts", {
    ingestUploadedSource: async () => {
      ingestUploadedCalls += 1;
      throw new Error("uploaded ingest should not be called");
    },
    ingestDiscoveredSource: async () => {
      ingestDiscoveredCalls += 1;
      throw new Error("discovered ingest should not be called");
    },
  });

  try {
    clearModule("../lib/engine/nodes/build-source-set.ts");
    const loadedModule = reloadModule<
      typeof import("../lib/engine/nodes/build-source-set")
    >("../lib/engine/nodes/build-source-set.ts");

    const result = await loadedModule.buildSourceSet({
      runId: "run-existing",
      projectId: "project-1",
      userId: "user-1",
      status: "running",
      currentStep: "build_source_set",
      input: { researchQuestion: "Can existing workspace sources seed analysis?" },
      perspective: {
        projectTitle: "Workspace reuse",
        briefSummary: "Reuse existing parsed sources",
        interpretedIntent: "Reuse existing parsed sources",
        inferredResearchFrame: "existing workspace materials",
        evidenceForCriteria: [],
        evidenceAgainstCriteria: [],
        subquestions: [],
      },
      sources: [
        {
          sourceId: "source-1",
          name: "Workspace source",
          origin: "uploaded",
          mimeType: "application/pdf",
          checksum: "checksum-1",
          storageUrl: "sources/source-1/raw.pdf",
          parseStatus: "parsed",
          metadata: {
            sourceKind: "pdf",
            sourceUrl: "https://example.com/source.pdf",
            resolvedUrl: "https://example.com/source.pdf",
            rawBlobKey: "sources/source-1/raw.pdf",
            normalizedBlobKey: "sources/source-1/normalized.md",
            byteSize: 1024,
            charCount: 500,
            estimatedTokens: 120,
            parseQuality: "validated",
            parseEngine: "pdfjs-local-text",
            parseAttempts: 1,
            sourceChunks: [
              {
                chunkIndex: 0,
                headingPath: "Results",
                tokenEstimate: 120,
                charCount: 480,
                blobKey: "sources/source-1/chunks/0000.md",
              },
            ],
          },
        },
      ],
      parsedSources: [],
      sourceChunks: [],
      errors: [],
      startedAt: "",
      completedAt: "",
    } as unknown as Parameters<typeof loadedModule.buildSourceSet>[0]);

    const parsedSources = result.parsedSources as Array<Record<string, unknown>> | undefined;
    const sourceChunks = result.sourceChunks as Array<Record<string, unknown>> | undefined;

    assert.equal(ingestUploadedCalls, 0);
    assert.equal(ingestDiscoveredCalls, 0);
    assert.equal(parsedSources?.length, 1);
    assert.deepEqual(parsedSources?.[0], {
      sourceId: "source-1",
      name: "Workspace source",
      normalizedBlobKey: "sources/source-1/normalized.md",
      charCount: 500,
      estimatedTokens: 120,
      parseQuality: "validated",
      metadata: {
        sourceKind: "pdf",
        sourceUrl: "https://example.com/source.pdf",
        resolvedUrl: "https://example.com/source.pdf",
        chunkCount: 1,
        parseEngine: "pdfjs-local-text",
      },
    });
    assert.equal(sourceChunks?.length, 1);
    assert.deepEqual(sourceChunks?.[0], {
      sourceId: "source-1",
      sourceName: "Workspace source",
      chunkIndex: 0,
      headingPath: "Results",
      tokenEstimate: 120,
      charCount: 480,
      blobKey: "sources/source-1/chunks/0000.md",
    });
  } finally {
    restoreSourceIngestion();
    restoreUnifiedDiscovery();
    restoreMemoryStore();
  }
});
