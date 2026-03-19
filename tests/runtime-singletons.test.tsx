import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);

interface MemoryStoreGlobals {
  __tenetMemoryStore?: unknown;
  __tenetMemoryStoreState?: unknown;
}

function reloadModule<T>(modulePath: string): T {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath) as T;
}

function resetMemoryStoreGlobals(previous: MemoryStoreGlobals) {
  const globals = globalThis as typeof globalThis & MemoryStoreGlobals;

  if (previous.__tenetMemoryStore === undefined) {
    delete globals.__tenetMemoryStore;
  } else {
    globals.__tenetMemoryStore = previous.__tenetMemoryStore;
  }

  if (previous.__tenetMemoryStoreState === undefined) {
    delete globals.__tenetMemoryStoreState;
  } else {
    globals.__tenetMemoryStoreState = previous.__tenetMemoryStoreState;
  }
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

test("memory store replaces stale cached instances that are missing newer APIs", () => {
  const globals = globalThis as typeof globalThis & MemoryStoreGlobals;
  const previous = {
    __tenetMemoryStore: globals.__tenetMemoryStore,
    __tenetMemoryStoreState: globals.__tenetMemoryStoreState,
  };

  try {
    delete globals.__tenetMemoryStoreState;
    globals.__tenetMemoryStore = {
      getRun() {
        return undefined;
      },
    };

    const reloaded = reloadModule<typeof import("../lib/storage/memory-store")>(
      "../lib/storage/memory-store.ts"
    );

    assert.equal(typeof reloaded.memoryStore.cancelPendingQuestion, "function");
    assert.equal(typeof reloaded.memoryStore.registerPendingQuestion, "function");
  } finally {
    resetMemoryStoreGlobals(previous);
    delete require.cache[require.resolve("../lib/storage/memory-store.ts")];
  }
});
