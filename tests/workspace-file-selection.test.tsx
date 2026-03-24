import assert from "node:assert/strict";
import test from "node:test";
import { resolveActiveFileKey } from "../app/dashboard/[runId]/_lib/workspace-types";

test("resolveActiveFileKey preserves the current file when refresh keeps it", () => {
  const nextKey = resolveActiveFileKey(
    [
      {
        key: "note:1",
        label: "Scratchpad",
        shortLabel: "Scratchpad",
        icon: "note",
        group: "note",
      },
      {
        key: "source:1",
        label: "Uploaded source",
        shortLabel: "Uploaded source",
        icon: "source-uploaded",
        group: "source",
      },
    ],
    "source:1"
  );

  assert.equal(nextKey, "source:1");
});

test("resolveActiveFileKey falls back to the first file when the current file disappears", () => {
  const nextKey = resolveActiveFileKey(
    [
      {
        key: "note:1",
        label: "Scratchpad",
        shortLabel: "Scratchpad",
        icon: "note",
        group: "note",
      },
    ],
    "source:1"
  );

  assert.equal(nextKey, "note:1");
});
