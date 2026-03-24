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

test("parsePdfWithFallbacks uses the primary normalization path when local extraction is healthy", async () => {
  const restorePdfPrimitives = patchModule("../lib/pdf/gemini-extract.ts", {
    extractPdfTextLocally: async () => ({
      text: "raw extract ".repeat(80),
      pageCount: 3,
    }),
    normalizeExtractedPdfText: async () => "# Normalized\n\n" + "good text ".repeat(80),
    extractPdfTextWithModelDirectly: async () => {
      throw new Error("direct bytes should not run");
    },
    extractPdfTextWithModelFromUrl: async () => {
      throw new Error("direct url should not run");
    },
  });
  const restoreValidators = patchModule("../lib/ingest/document-quality.ts", {
    validateRawExtractedPdfText: (text: string) => ({
      ok: text.length > 100,
      estimatedTokens: 200,
    }),
    validateNormalizedDocument: (text: string) => ({
      ok: text.startsWith("# Normalized"),
      estimatedTokens: 200,
      reason: text.startsWith("# Normalized") ? undefined : "normalized invalid",
    }),
  });

  try {
    clearModule("../lib/pdf/pdf-parse-orchestrator.ts");
    const loadedModule = reloadModule<typeof import("../lib/pdf/pdf-parse-orchestrator")>(
      "../lib/pdf/pdf-parse-orchestrator.ts"
    );

    const result = await loadedModule.parsePdfWithFallbacks(
      Buffer.from("%PDF-1.7 fake pdf bytes"),
      "paper.pdf"
    );

    assert.equal(result.ok, true);
    assert.equal(result.parseEngine, "pdfjs+normalize-lite");
    assert.equal(result.parseAttempts, 2);
    assert.equal(result.parseQuality, "validated");
    assert.equal(result.attempts.map((attempt) => attempt.stage).join(","), "local_extract,normalize_primary");
  } finally {
    restoreValidators();
    restorePdfPrimitives();
  }
});

test("parsePdfWithFallbacks retries only normalization when raw extraction is good but the primary model output fails validation", async () => {
  let normalizationCalls = 0;

  const restorePdfPrimitives = patchModule("../lib/pdf/gemini-extract.ts", {
    extractPdfTextLocally: async () => ({
      text: "raw extract ".repeat(80),
      pageCount: 4,
    }),
    normalizeExtractedPdfText: async (_rawText: string, _filename: string, options?: { model?: string }) => {
      normalizationCalls += 1;
      if (options?.model === "google/gemini-2.5-flash") {
        return "# Fallback normalized\n\n" + "good text ".repeat(80);
      }
      return "bad";
    },
    extractPdfTextWithModelDirectly: async () => {
      throw new Error("direct bytes should not run");
    },
    extractPdfTextWithModelFromUrl: async () => {
      throw new Error("direct url should not run");
    },
  });
  const restoreValidators = patchModule("../lib/ingest/document-quality.ts", {
    validateRawExtractedPdfText: () => ({
      ok: true,
      estimatedTokens: 200,
    }),
    validateNormalizedDocument: (text: string) => ({
      ok: text.startsWith("# Fallback normalized"),
      estimatedTokens: 200,
      reason: text.startsWith("# Fallback normalized") ? undefined : "normalized invalid",
    }),
  });

  try {
    clearModule("../lib/pdf/pdf-parse-orchestrator.ts");
    const loadedModule = reloadModule<typeof import("../lib/pdf/pdf-parse-orchestrator")>(
      "../lib/pdf/pdf-parse-orchestrator.ts"
    );

    const result = await loadedModule.parsePdfWithFallbacks(
      Buffer.from("%PDF-1.7 fake pdf bytes"),
      "paper.pdf",
      {
        primaryModel: "google/gemini-2.5-flash-lite",
        fallbackModel: "google/gemini-2.5-flash",
      }
    );

    assert.equal(result.ok, true);
    assert.equal(result.parseEngine, "pdfjs+normalize-full");
    assert.equal(result.parseQuality, "fallback_validated");
    assert.equal(normalizationCalls, 2);
    assert.equal(
      result.attempts.map((attempt) => attempt.stage).join(","),
      "local_extract,normalize_primary,normalize_fallback"
    );
  } finally {
    restoreValidators();
    restorePdfPrimitives();
  }
});

test("parsePdfWithFallbacks goes directly to byte-based model extraction when local extraction fails", async () => {
  let directBytesCalls = 0;
  let normalizeCalls = 0;

  const restorePdfPrimitives = patchModule("../lib/pdf/gemini-extract.ts", {
    extractPdfTextLocally: async () => {
      throw new Error("cmap failure");
    },
    normalizeExtractedPdfText: async () => {
      normalizeCalls += 1;
      return "# unreachable";
    },
    extractPdfTextWithModelDirectly: async () => {
      directBytesCalls += 1;
      return "# Direct bytes\n\n" + "good text ".repeat(80);
    },
    extractPdfTextWithModelFromUrl: async () => {
      throw new Error("direct url should not run");
    },
  });
  const restoreValidators = patchModule("../lib/ingest/document-quality.ts", {
    validateRawExtractedPdfText: () => ({
      ok: false,
      estimatedTokens: 0,
      reason: "raw invalid",
    }),
    validateNormalizedDocument: (text: string) => ({
      ok: text.startsWith("# Direct bytes"),
      estimatedTokens: 200,
      reason: text.startsWith("# Direct bytes") ? undefined : "normalized invalid",
    }),
  });

  try {
    clearModule("../lib/pdf/pdf-parse-orchestrator.ts");
    const loadedModule = reloadModule<typeof import("../lib/pdf/pdf-parse-orchestrator")>(
      "../lib/pdf/pdf-parse-orchestrator.ts"
    );

    const result = await loadedModule.parsePdfWithFallbacks(
      Buffer.from("%PDF-1.7 fake pdf bytes"),
      "paper.pdf"
    );

    assert.equal(result.ok, true);
    assert.equal(result.parseEngine, "pdf-direct-bytes");
    assert.equal(directBytesCalls, 1);
    assert.equal(normalizeCalls, 0);
    assert.equal(
      result.attempts.map((attempt) => attempt.stage).join(","),
      "local_extract,direct_bytes"
    );
  } finally {
    restoreValidators();
    restorePdfPrimitives();
  }
});

test("parsePdfWithFallbacks uses direct URL extraction for oversized PDFs when a resolved URL exists", async () => {
  let directBytesCalls = 0;
  let directUrlCalls = 0;

  const restorePdfPrimitives = patchModule("../lib/pdf/gemini-extract.ts", {
    extractPdfTextLocally: async () => {
      throw new Error("local extract failed");
    },
    normalizeExtractedPdfText: async () => "# unreachable",
    extractPdfTextWithModelDirectly: async () => {
      directBytesCalls += 1;
      throw new Error("direct bytes should not run");
    },
    extractPdfTextWithModelFromUrl: async () => {
      directUrlCalls += 1;
      return "# Direct url\n\n" + "good text ".repeat(80);
    },
  });
  const restoreValidators = patchModule("../lib/ingest/document-quality.ts", {
    validateRawExtractedPdfText: () => ({
      ok: false,
      estimatedTokens: 0,
      reason: "raw invalid",
    }),
    validateNormalizedDocument: (text: string) => ({
      ok: text.startsWith("# Direct url"),
      estimatedTokens: 200,
      reason: text.startsWith("# Direct url") ? undefined : "normalized invalid",
    }),
  });

  try {
    clearModule("../lib/pdf/pdf-parse-orchestrator.ts");
    const loadedModule = reloadModule<typeof import("../lib/pdf/pdf-parse-orchestrator")>(
      "../lib/pdf/pdf-parse-orchestrator.ts"
    );

    const result = await loadedModule.parsePdfWithFallbacks(
      Buffer.alloc(20 * 1024 * 1024 + 1, 0),
      "paper.pdf",
      { resolvedUrl: "https://example.com/paper.pdf" }
    );

    assert.equal(result.ok, true);
    assert.equal(result.parseEngine, "pdf-direct-url");
    assert.equal(directBytesCalls, 0);
    assert.equal(directUrlCalls, 1);
  } finally {
    restoreValidators();
    restorePdfPrimitives();
  }
});

test("parsePdfWithFallbacks salvages validated raw text after all model-backed stages fail", async () => {
  const restorePdfPrimitives = patchModule("../lib/pdf/gemini-extract.ts", {
    extractPdfTextLocally: async () => ({
      text: "raw salvage ".repeat(80),
      pageCount: 7,
    }),
    normalizeExtractedPdfText: async () => {
      throw new Error("normalization failed");
    },
    extractPdfTextWithModelDirectly: async () => {
      throw new Error("direct bytes failed");
    },
    extractPdfTextWithModelFromUrl: async () => {
      throw new Error("direct url failed");
    },
  });
  const restoreValidators = patchModule("../lib/ingest/document-quality.ts", {
    validateRawExtractedPdfText: (text: string) => ({
      ok: text.length > 200,
      estimatedTokens: 200,
      reason: text.length > 200 ? undefined : "raw invalid",
    }),
    validateNormalizedDocument: () => ({
      ok: false,
      estimatedTokens: 0,
      reason: "normalized invalid",
    }),
  });

  try {
    clearModule("../lib/pdf/pdf-parse-orchestrator.ts");
    const loadedModule = reloadModule<typeof import("../lib/pdf/pdf-parse-orchestrator")>(
      "../lib/pdf/pdf-parse-orchestrator.ts"
    );

    const result = await loadedModule.parsePdfWithFallbacks(
      Buffer.from("%PDF-1.7 fake pdf bytes"),
      "paper.pdf",
      { resolvedUrl: "https://example.com/paper.pdf" }
    );

    assert.equal(result.ok, true);
    assert.equal(result.parseEngine, "pdfjs-raw-text");
    assert.equal(result.parseQuality, "fallback_validated");
    assert.equal(result.attempts.at(-1)?.stage, "raw_salvage");
  } finally {
    restoreValidators();
    restorePdfPrimitives();
  }
});

test("parsePdfWithFallbacks reports precise attempt diagnostics when every stage fails", async () => {
  const restorePdfPrimitives = patchModule("../lib/pdf/gemini-extract.ts", {
    extractPdfTextLocally: async () => {
      throw new Error("local extract failed");
    },
    normalizeExtractedPdfText: async () => {
      throw new Error("normalize should not run");
    },
    extractPdfTextWithModelDirectly: async () => {
      throw new Error("direct bytes failed");
    },
    extractPdfTextWithModelFromUrl: async () => {
      throw new Error("direct url failed");
    },
  });
  const restoreValidators = patchModule("../lib/ingest/document-quality.ts", {
    validateRawExtractedPdfText: () => ({
      ok: false,
      estimatedTokens: 0,
      reason: "raw invalid",
    }),
    validateNormalizedDocument: () => ({
      ok: false,
      estimatedTokens: 0,
      reason: "normalized invalid",
    }),
  });

  try {
    clearModule("../lib/pdf/pdf-parse-orchestrator.ts");
    const loadedModule = reloadModule<typeof import("../lib/pdf/pdf-parse-orchestrator")>(
      "../lib/pdf/pdf-parse-orchestrator.ts"
    );

    const result = await loadedModule.parsePdfWithFallbacks(
      Buffer.alloc(20 * 1024 * 1024 + 1, 0),
      "paper.pdf",
      { resolvedUrl: "https://example.com/paper.pdf" }
    );

    assert.equal(result.ok, false);
    assert.equal(result.parseQuality, "rejected");
    assert.match(result.parseError, /local extract failed|direct bytes failed|direct url failed/i);
    assert.deepEqual(result.attempts.map((attempt) => attempt.ok), [false, false]);
  } finally {
    restoreValidators();
    restorePdfPrimitives();
  }
});
