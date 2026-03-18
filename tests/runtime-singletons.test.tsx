import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);

function reloadModule<T>(modulePath: string): T {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath) as T;
}

test("memory store survives module re-evaluation", () => {
  const firstModule = reloadModule<typeof import("../lib/storage/memory-store")>(
    "../lib/storage/memory-store.ts"
  );
  const runId = `run-${Date.now()}`;

  firstModule.memoryStore.setRun(runId, {
    projectId: "project-1",
    runId,
    status: "awaiting_confirmation",
    updatedAt: new Date().toISOString(),
  });

  const secondModule = reloadModule<
    typeof import("../lib/storage/memory-store")
  >("../lib/storage/memory-store.ts");
  const persistedRun = secondModule.memoryStore.getRun(runId);

  assert.ok(persistedRun);
  assert.equal(persistedRun.projectId, "project-1");
  assert.equal(persistedRun.runId, runId);
  assert.equal(persistedRun.status, "awaiting_confirmation");
});

test("init graph survives module re-evaluation", () => {
  const firstModule = reloadModule<typeof import("../lib/engine/graph")>(
    "../lib/engine/graph.ts"
  );
  const secondModule = reloadModule<typeof import("../lib/engine/graph")>(
    "../lib/engine/graph.ts"
  );

  assert.notEqual(secondModule.initGraph, firstModule.initGraph);
  assert.equal(
    secondModule.initGraph.checkpointer,
    firstModule.initGraph.checkpointer
  );
});
