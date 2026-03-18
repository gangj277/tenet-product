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
    restorePdfParser();
    restoreBlobStore();
  }
});
