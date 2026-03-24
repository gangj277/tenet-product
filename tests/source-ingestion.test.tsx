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

test("ingestDiscoveredSource classifies PDF bytes correctly even when the URL has query params", async () => {
  const storedBuffers: Array<{ key: string; size: number }> = [];
  const storedTexts: Array<{ key: string; text: string }> = [];

  const restoreBlobStore = patchModule("../lib/storage/blob-store.ts", {
    blobStore: {
      async putBuffer(key: string, buffer: Buffer) {
        storedBuffers.push({ key, size: buffer.length });
        return key;
      },
      async putText(key: string, text: string) {
        storedTexts.push({ key, text });
        return key;
      },
      async getBuffer() {
        throw new Error("not used in this test");
      },
      async getText() {
        throw new Error("not used in this test");
      },
    },
  });
  const restorePdfParser = patchModule("../lib/pdf/gemini-extract.ts", {
    parsePDF: async () => ({
      text:
        "# Findings\n\n" +
        "This is a normalized paper representation. ".repeat(80),
      pageCount: 4,
    }),
  });
  const restoreOrchestrator = patchModule("../lib/pdf/pdf-parse-orchestrator.ts", {
    parsePdfWithFallbacks: async () => ({
      ok: true as const,
      text:
        "# Findings\n\n" +
        "This is a normalized paper representation. ".repeat(80),
      pageCount: 4,
      parseEngine: "pdfjs+normalize-lite",
      parseAttempts: 2,
      parseQuality: "validated" as const,
      attempts: [
        {
          stage: "local_extract" as const,
          engine: "pdfjs-local",
          ok: true,
          durationMs: 1,
          charCount: 1000,
        },
        {
          stage: "normalize_primary" as const,
          engine: "google/gemini-2.5-flash-lite",
          ok: true,
          durationMs: 1,
          charCount: 1000,
          quality: "validated",
        },
      ],
    }),
  });

  const originalFetch = global.fetch;
  global.fetch = (async () =>
    new Response(Buffer.from("%PDF-1.7 fake pdf bytes"), {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    })) as typeof fetch;

  try {
    clearModule("../lib/ingest/source-ingestion.ts");
    const loadedModule = reloadModule<typeof import("../lib/ingest/source-ingestion")>(
      "../lib/ingest/source-ingestion.ts"
    );

    const result = await loadedModule.ingestDiscoveredSource({
      sourceId: "source-1",
      title: "Paper with query string",
      sourceUrl: "https://example.com/paper.pdf?download=1",
    });

    assert.equal(result.source.parseStatus, "parsed");
    assert.equal(result.source.mimeType, "application/pdf");
    assert.equal(result.source.metadata?.sourceKind, "pdf");
    assert.equal(result.source.metadata?.sniffedMimeType, "application/pdf");
    assert.ok(result.parsedSource);
    assert.ok(result.sourceChunks.length >= 1);
    assert.equal(storedBuffers[0]?.key, "sources/source-1/raw.pdf");
    assert.ok(
      storedTexts.some((entry) => entry.key === "sources/source-1/normalized.md")
    );
  } finally {
    global.fetch = originalFetch;
    restoreOrchestrator();
    restorePdfParser();
    restoreBlobStore();
  }
});

test("ingestDiscoveredSource rejects Gemini output that still contains raw PDF internals", async () => {
  const restoreBlobStore = patchModule("../lib/storage/blob-store.ts", {
    blobStore: {
      async putBuffer(key: string) {
        return key;
      },
      async putText(key: string) {
        return key;
      },
      async getBuffer() {
        throw new Error("not used in this test");
      },
      async getText() {
        throw new Error("not used in this test");
      },
    },
  });
  const restorePdfParser = patchModule("../lib/pdf/gemini-extract.ts", {
    parsePDF: async () => ({
      text:
        "%PDF-1.6\nxref\n1 0 obj\nendobj\nstartxref\n%%EOF\n/Type/Annot\n" +
        "xref\n1 0 obj\nendobj\nstartxref\n%%EOF\n/Type/Annot\n" +
        "xref\n1 0 obj\nendobj\nstartxref\n%%EOF\n/Type/Annot\n",
      pageCount: 12,
    }),
  });
  const restoreOrchestrator = patchModule("../lib/pdf/pdf-parse-orchestrator.ts", {
    parsePdfWithFallbacks: async () => ({
      ok: false as const,
      parseEngine: "pdf-direct-bytes",
      parseAttempts: 2,
      parseQuality: "rejected" as const,
      parseError: "Parser output contains PDF internals instead of clean text",
      attempts: [
        {
          stage: "local_extract" as const,
          engine: "pdfjs-local",
          ok: true,
          durationMs: 1,
          charCount: 400,
        },
        {
          stage: "direct_bytes" as const,
          engine: "gpt-5.4-mini",
          ok: false,
          durationMs: 1,
          error: "Parser output contains PDF internals instead of clean text",
        },
      ],
    }),
  });

  const originalFetch = global.fetch;
  global.fetch = (async () =>
    new Response(Buffer.from("%PDF-1.6 fake pdf bytes"), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
      },
    })) as typeof fetch;

  try {
    clearModule("../lib/ingest/source-ingestion.ts");
    const loadedModule = reloadModule<typeof import("../lib/ingest/source-ingestion")>(
      "../lib/ingest/source-ingestion.ts"
    );

    const result = await loadedModule.ingestDiscoveredSource({
      sourceId: "source-2",
      title: "Broken parse",
      sourceUrl: "https://example.com/broken.pdf?foo=bar",
    });

    assert.equal(result.source.parseStatus, "failed");
    assert.equal(result.parsedSource, undefined);
    assert.equal(result.sourceChunks.length, 0);
    assert.equal(result.source.metadata?.parseQuality, "rejected");
    assert.match(
      result.source.metadata?.parseError ?? "",
      /raw PDF bytes|PDF internals|too binary/i
    );
  } finally {
    global.fetch = originalFetch;
    restoreOrchestrator();
    restorePdfParser();
    restoreBlobStore();
  }
});

test("ingestDiscoveredSource falls back to local PDF text when normalization fails twice", async () => {
  const storedTexts: Array<{ key: string; text: string }> = [];

  const restoreBlobStore = patchModule("../lib/storage/blob-store.ts", {
    blobStore: {
      async putBuffer(key: string) {
        return key;
      },
      async putText(key: string, text: string) {
        storedTexts.push({ key, text });
        return key;
      },
      async getBuffer() {
        throw new Error("not used in this test");
      },
      async getText() {
        throw new Error("not used in this test");
      },
    },
  });
  const restorePdfParser = patchModule("../lib/pdf/gemini-extract.ts", {
    parsePDF: async () => {
      throw new Error("LLM normalization returned empty or near-empty result");
    },
    extractPdfTextLocally: async () => ({
      text:
        "# Raw extraction fallback\n\n" +
        "This text came from the local pdfjs extraction path and is still usable. ".repeat(40),
      pageCount: 8,
    }),
  });
  const restoreOrchestrator = patchModule("../lib/pdf/pdf-parse-orchestrator.ts", {
    parsePdfWithFallbacks: async () => ({
      ok: true as const,
      text:
        "# Raw extraction fallback\n\n" +
        "This text came from the local pdfjs extraction path and is still usable. ".repeat(40),
      pageCount: 8,
      parseEngine: "pdfjs-raw-text",
      parseAttempts: 5,
      parseQuality: "fallback_validated" as const,
      attempts: [
        {
          stage: "local_extract" as const,
          engine: "pdfjs-local",
          ok: true,
          durationMs: 1,
          charCount: 1500,
        },
        {
          stage: "normalize_primary" as const,
          engine: "google/gemini-2.5-flash-lite",
          ok: false,
          durationMs: 1,
          error: "LLM normalization returned empty or near-empty result",
        },
        {
          stage: "normalize_fallback" as const,
          engine: "google/gemini-2.5-flash",
          ok: false,
          durationMs: 1,
          error: "LLM normalization returned empty or near-empty result",
        },
        {
          stage: "direct_bytes" as const,
          engine: "gpt-5.4-mini",
          ok: false,
          durationMs: 1,
          error: "Direct PDF extraction returned empty or near-empty result",
        },
        {
          stage: "raw_salvage" as const,
          engine: "pdfjs-local",
          ok: true,
          durationMs: 1,
          charCount: 1500,
          quality: "fallback_validated",
        },
      ],
    }),
  });

  const originalFetch = global.fetch;
  global.fetch = (async () =>
    new Response(Buffer.from("%PDF-1.6 fake pdf bytes"), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
      },
    })) as typeof fetch;

  try {
    clearModule("../lib/ingest/source-ingestion.ts");
    const loadedModule = reloadModule<typeof import("../lib/ingest/source-ingestion")>(
      "../lib/ingest/source-ingestion.ts"
    );

    const result = await loadedModule.ingestDiscoveredSource({
      sourceId: "source-3",
      title: "Fallback parse",
      sourceUrl: "https://example.com/fallback.pdf",
    });

    assert.equal(result.source.parseStatus, "parsed");
    assert.equal(result.source.metadata?.parseQuality, "fallback_validated");
    assert.equal(result.source.metadata?.parseEngine, "pdfjs-raw-text");
    assert.equal(result.source.metadata?.parseStrategyVersion, "v2");
    assert.equal(result.source.metadata?.parseDiagnostics?.length, 5);
    assert.ok(result.parsedSource);
    assert.ok(result.sourceChunks.length >= 1);
    assert.ok(
      storedTexts.some((entry) => entry.key === "sources/source-3/normalized.md")
    );
  } finally {
    global.fetch = originalFetch;
    restoreOrchestrator();
    restorePdfParser();
    restoreBlobStore();
  }
});
