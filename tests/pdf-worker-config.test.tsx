import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("getPdfJsWorkerSpecifier uses a bundler-safe module specifier", async () => {
  const loadedModule = await import("../lib/pdf/gemini-extract.ts");
  const workerSpecifier = loadedModule.getPdfJsWorkerSpecifier();

  assert.equal(workerSpecifier, "pdfjs-dist/legacy/build/pdf.worker.mjs");
});

test("pdf worker bootstrap avoids Turbopack-breaking dynamic imports", () => {
  const source = fs.readFileSync("lib/pdf/gemini-extract.ts", "utf8");

  assert.doesNotMatch(source, /createRequire\(/);
  assert.doesNotMatch(source, /pathToFileURL\(/);
  assert.doesNotMatch(source, /import\(workerSrc\)/);
  assert.match(source, /import\("pdfjs-dist\/legacy\/build\/pdf\.worker\.mjs"\)/);
});

test("ensurePdfJsWorkerConfigured loads WorkerMessageHandler into the Node global", async () => {
  const loadedModule = await import("../lib/pdf/gemini-extract.ts");
  const fakePdfJs = {
    GlobalWorkerOptions: {},
  };

  await loadedModule.ensurePdfJsWorkerConfigured(
    fakePdfJs as { GlobalWorkerOptions: { workerSrc?: string } }
  );

  assert.equal(
    fakePdfJs.GlobalWorkerOptions.workerSrc,
    loadedModule.getPdfJsWorkerSpecifier()
  );
  assert.ok(
    (globalThis as typeof globalThis & {
      pdfjsWorker?: { WorkerMessageHandler?: unknown };
    }).pdfjsWorker?.WorkerMessageHandler
  );
});
