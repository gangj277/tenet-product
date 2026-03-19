import assert from "node:assert/strict";
import test from "node:test";
import { buildLineDiffModel } from "../app/dashboard/[runId]/_lib/line-diff-model.ts";

test("buildLineDiffModel reports no visible changes when texts match", () => {
  const model = buildLineDiffModel({
    oldText: "same\ntext",
    newText: "same\ntext",
    expanded: false,
  });

  assert.equal(model.changedCount, 0);
  assert.equal(model.hiddenChanges, 0);
  assert.deepEqual(model.visibleEntries, []);
});

test("buildLineDiffModel truncates hidden changes when collapsed", () => {
  const oldText = Array.from({ length: 70 }, (_, i) => `old-${i}`).join("\n");
  const newText = Array.from({ length: 70 }, (_, i) => `new-${i}`).join("\n");

  const model = buildLineDiffModel({
    oldText,
    newText,
    expanded: false,
    maxVisibleChanges: 60,
  });

  assert.equal(model.changedCount, 140);
  assert.equal(model.hiddenChanges, 80);
  assert.ok(model.visibleEntries.length > 0);
});
