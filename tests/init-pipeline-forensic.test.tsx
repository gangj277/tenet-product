import assert from "node:assert/strict";
import test from "node:test";

import { runForensicInitPipeline } from "./helpers/init-pipeline-forensic";

test("forensic init pipeline harness drives upload, init, confirm, and completion end to end", async () => {
  const report = await runForensicInitPipeline();

  assert.equal(report.passed, true);
  assert.equal(report.init.status, "awaiting_confirmation");
  assert.equal(report.finalStatus.status, "completed");
  assert.equal(report.finalState.sourceCount, 3);
  assert.equal(report.finalState.parsedSourceCount, 3);
  assert.ok(report.finalState.sourceChunkCount >= 3);
  assert.equal(report.invariants.failed.length, 0);
});
