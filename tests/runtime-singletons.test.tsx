import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);

interface MemoryStoreGlobals {
  __lumenMemoryStore?: unknown;
  __lumenMemoryStoreState?: unknown;
}

interface StorageGlobals {
  __lumenStorageAdapter?: Promise<unknown>;
  __lumenStorageKey?: string;
}

function reloadModule<T>(modulePath: string): T {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath) as T;
}

function resetMemoryStoreGlobals(previous: MemoryStoreGlobals) {
  const globals = globalThis as typeof globalThis & MemoryStoreGlobals;

  if (previous.__lumenMemoryStore === undefined) {
    delete globals.__lumenMemoryStore;
  } else {
    globals.__lumenMemoryStore = previous.__lumenMemoryStore;
  }

  if (previous.__lumenMemoryStoreState === undefined) {
    delete globals.__lumenMemoryStoreState;
  } else {
    globals.__lumenMemoryStoreState = previous.__lumenMemoryStoreState;
  }
}

function resetStorageGlobals(previous: StorageGlobals) {
  const globals = globalThis as typeof globalThis & StorageGlobals;

  if (previous.__lumenStorageAdapter === undefined) {
    delete globals.__lumenStorageAdapter;
  } else {
    globals.__lumenStorageAdapter = previous.__lumenStorageAdapter;
  }

  if (previous.__lumenStorageKey === undefined) {
    delete globals.__lumenStorageKey;
  } else {
    globals.__lumenStorageKey = previous.__lumenStorageKey;
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
    __lumenMemoryStore: globals.__lumenMemoryStore,
    __lumenMemoryStoreState: globals.__lumenMemoryStoreState,
  };

  try {
    delete globals.__lumenMemoryStoreState;
    globals.__lumenMemoryStore = {
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

test("storage adapter replaces stale cached instances that are missing newer APIs", async () => {
  const globals = globalThis as typeof globalThis & StorageGlobals;
  const previous = {
    __lumenStorageAdapter: globals.__lumenStorageAdapter,
    __lumenStorageKey: globals.__lumenStorageKey,
  };
  const previousElectron = process.env.ELECTRON;
  const previousDataDir = process.env.LUMEN_DATA_DIR;
  const dataDir = `/tmp/lumen-storage-singleton-${Date.now()}`;

  try {
    process.env.ELECTRON = "1";
    process.env.LUMEN_DATA_DIR = dataDir;
    globals.__lumenStorageKey = `electron:${dataDir}`;
    globals.__lumenStorageAdapter = Promise.resolve({
      listResearchProjectsForUser: async () => [],
    });

    const reloaded = reloadModule<typeof import("../lib/storage/index")>(
      "../lib/storage/index.ts"
    );
    const storage = await reloaded.getStorage();

    assert.equal(typeof storage.getLocalWorkspaceFilePath, "function");
    assert.equal(typeof storage.deleteProjectForUser, "function");
  } finally {
    if (previousElectron === undefined) {
      delete process.env.ELECTRON;
    } else {
      process.env.ELECTRON = previousElectron;
    }

    if (previousDataDir === undefined) {
      delete process.env.LUMEN_DATA_DIR;
    } else {
      process.env.LUMEN_DATA_DIR = previousDataDir;
    }

    resetStorageGlobals(previous);
    delete require.cache[require.resolve("../lib/storage/index.ts")];
  }
});
