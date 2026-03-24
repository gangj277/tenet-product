import assert from "node:assert/strict";
import test from "node:test";

test("buildSourceAttritionReport groups sources by failure stage, winner, and parse quality", async () => {
  const loadedModule = await import("../lib/diagnostics/source-attrition-report.ts");

  const report = loadedModule.buildSourceAttritionReport({
    userId: "user-1",
    query: "rag grounding",
    diagnostics: [
      {
        index: 0,
        title: "Parsed locally",
        url: "https://example.com/a.pdf",
        providers: ["openalex"],
        fetchAttempts: [],
        finalStatus: "parsed",
        parseStatus: "parsed",
        parseEngine: "pdfjs+normalize-lite",
        parseQuality: "validated",
        winnerStage: "normalize_primary",
      },
      {
        index: 1,
        title: "Parsed directly",
        url: "https://example.com/b.pdf",
        providers: ["semantic-scholar"],
        fetchAttempts: [],
        finalStatus: "parsed",
        parseStatus: "parsed",
        parseEngine: "pdf-direct-url",
        parseQuality: "fallback_validated",
        winnerStage: "direct_url",
      },
      {
        index: 2,
        title: "Failed parse",
        url: "https://example.com/c.pdf",
        providers: ["arxiv"],
        fetchAttempts: [],
        finalStatus: "failed",
        failurePhase: "pdf-parse",
        failureReason: "local extract failed",
      },
    ],
  });

  assert.equal(report.parsedCount, 2);
  assert.equal(report.failedCount, 1);
  assert.deepEqual(report.byPhase, { "pdf-parse": 1 });
  assert.deepEqual(report.byParseEngine, {
    "pdfjs+normalize-lite": 1,
    "pdf-direct-url": 1,
  });
  assert.deepEqual(report.byParseQuality, {
    validated: 1,
    fallback_validated: 1,
  });
  assert.deepEqual(report.byWinnerStage, {
    normalize_primary: 1,
    direct_url: 1,
  });
  assert.deepEqual(report.byWinnerFamily, {
    local: 1,
    direct: 1,
  });
});
