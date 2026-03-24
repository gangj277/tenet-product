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

test("persistResearchArtifacts stores source metadata and chunk manifests without persisting normalized full text", async () => {
  const inserts: Array<{ table: unknown; value: unknown }> = [];

  const restoreDb = patchModule("../lib/db/client.ts", {
    db: {
      transaction: async (
        callback: (tx: {
          delete: (table: unknown) => {
            where: (condition: unknown) => Promise<void>;
          };
          insert: (table: unknown) => {
            values: (value: unknown) => Promise<void>;
          };
        }) => Promise<void>
      ) =>
        callback({
          delete() {
            return {
              async where() {
                return;
              },
            };
          },
          insert(table) {
            return {
              async values(value) {
                inserts.push({ table, value });
              },
            };
          },
        }),
    },
  });

  try {
    clearModule("../lib/db/research-project-artifacts.ts");
    clearModule("../lib/db/research-projects.ts");
    const loadedModule = reloadModule<typeof import("../lib/db/research-projects")>(
      "../lib/db/research-projects.ts"
    );

    await loadedModule.persistResearchArtifacts({
      runId: "run-1",
      sources: [
        {
          sourceId: "source-1",
          name: "Paper 1",
          origin: "discovered",
          mimeType: "application/pdf",
          checksum: "checksum-1",
          storageUrl: "sources/source-1/raw.pdf",
          parseStatus: "parsed",
          parsedContent: "This should not be persisted",
          metadata: {
            sourceKind: "pdf",
            sourceUrl: "https://example.com/paper.pdf",
            resolvedUrl: "https://example.com/paper.pdf?download=1",
            httpContentType: "application/pdf",
            sniffedMimeType: "application/pdf",
            rawBlobKey: "sources/source-1/raw.pdf",
            normalizedBlobKey: "sources/source-1/normalized.md",
            byteSize: 2048,
            charCount: 1200,
            estimatedTokens: 300,
            parseEngine: "pdfjs+normalize-lite",
            parseAttempts: 1,
            parseQuality: "validated",
            parseStrategyVersion: "v2",
            parseDiagnostics: [
              {
                stage: "local_extract",
                engine: "pdfjs-local",
                ok: true,
                durationMs: 12,
                charCount: 1200,
              },
              {
                stage: "normalize_primary",
                engine: "google/gemini-2.5-flash-lite",
                ok: true,
                durationMs: 80,
                charCount: 1200,
                quality: "validated",
              },
            ],
          },
        },
      ],
      sourceChunks: [
        {
          sourceId: "source-1",
          sourceName: "Paper 1",
          chunkIndex: 0,
          headingPath: "Results",
          tokenEstimate: 120,
          charCount: 480,
          blobKey: "sources/source-1/chunks/0000.md",
        },
      ],
      artifacts: {
        overview: "overview",
        synthesis: "synthesis",
        claims: "claims",
        gaps: "gaps",
        nextSteps: "next steps",
        sources: {
          "source-1": "summary",
        },
      },
    } as never);

    const sourceInsert = inserts.find((entry) => {
      const rows = entry.value as Array<Record<string, unknown>>;
      return Array.isArray(rows) && rows[0]?.name === "Paper 1" && "parseStatus" in rows[0];
    }) as { value: Array<Record<string, unknown>> } | undefined;
    assert.ok(sourceInsert);
    assert.equal(sourceInsert.value[0].parsedContent, null);
    assert.equal(
      sourceInsert.value[0].storagePath,
      "sources/source-1/raw.pdf"
    );
    assert.deepEqual(sourceInsert.value[0].metadata, {
      sourceKind: "pdf",
      sourceUrl: "https://example.com/paper.pdf",
      resolvedUrl: "https://example.com/paper.pdf?download=1",
      httpContentType: "application/pdf",
      sniffedMimeType: "application/pdf",
      rawBlobKey: "sources/source-1/raw.pdf",
      normalizedBlobKey: "sources/source-1/normalized.md",
      byteSize: 2048,
      charCount: 1200,
      estimatedTokens: 300,
      parseEngine: "pdfjs+normalize-lite",
      parseAttempts: 1,
      parseQuality: "validated",
      parseStrategyVersion: "v2",
      parseDiagnostics: [
        {
          stage: "local_extract",
          engine: "pdfjs-local",
          ok: true,
          durationMs: 12,
          charCount: 1200,
        },
        {
          stage: "normalize_primary",
          engine: "google/gemini-2.5-flash-lite",
          ok: true,
          durationMs: 80,
          charCount: 1200,
          quality: "validated",
        },
      ],
      sourceChunks: [
        {
          chunkIndex: 0,
          headingPath: "Results",
          tokenEstimate: 120,
          charCount: 480,
          blobKey: "sources/source-1/chunks/0000.md",
        },
      ],
    });

    const chunkInsert = inserts.find((entry) => {
      const rows = entry.value as Array<Record<string, unknown>>;
      return Array.isArray(rows) && rows[0]?.blobKey === "sources/source-1/chunks/0000.md";
    }) as { value: Array<Record<string, unknown>> } | undefined;
    assert.ok(chunkInsert);
    assert.equal(chunkInsert.value[0].chunkIndex, 0);
    assert.equal(chunkInsert.value[0].tokenEstimate, 120);
  } finally {
    restoreDb();
  }
});
