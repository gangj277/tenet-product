import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const requireFrom = createRequire(import.meta.url);

function reloadModule<T>(modulePath: string): T {
  const resolved = requireFrom.resolve(modulePath);
  delete requireFrom.cache[resolved];
  return requireFrom(modulePath) as T;
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

function patchStorage(storage: Record<string, unknown>): () => void {
  return patchModule("../lib/storage/index.ts", {
    getStorage: async () => storage,
    resetStorageForTests: () => {},
  });
}

test("GET /api/init/[runId]/local-file returns the resolved local workspace path", async () => {
  const pathCalls: Array<{ runId: string; fileKey: string }> = [];

  const restoreSession = patchModule("../lib/auth/session.ts", {
    getSession: async () => ({
      userId: "user-1",
      email: "user@example.com",
    }),
  });
  const restoreStorage = patchStorage({
    getOwnedResearchRun: async () => ({
      runId: "run-1",
      projectId: "project-1",
      status: "draft",
      currentStep: "",
    }),
    getLocalWorkspaceFilePath: async (runId: string, fileKey: string) => {
      pathCalls.push({ runId, fileKey });
      return "/Users/tester/Workspace/lumen/artifacts/overview.md";
    },
  });

  try {
    const route = reloadModule<typeof import("../app/api/init/[runId]/local-file/route")>(
      "../app/api/init/[runId]/local-file/route.ts"
    );

    const response = await route.GET(
      new Request("http://localhost/api/init/run-1/local-file?key=overview") as never,
      { params: Promise.resolve({ runId: "run-1" }) }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(pathCalls, [{ runId: "run-1", fileKey: "overview" }]);

    const body = await response.json();
    assert.equal(body.path, "/Users/tester/Workspace/lumen/artifacts/overview.md");
  } finally {
    restoreStorage();
    restoreSession();
  }
});

test("GET /api/init/[runId]/local-file returns 404 when no local workspace file exists", async () => {
  const restoreSession = patchModule("../lib/auth/session.ts", {
    getSession: async () => ({
      userId: "user-1",
      email: "user@example.com",
    }),
  });
  const restoreStorage = patchStorage({
    getOwnedResearchRun: async () => ({
      runId: "run-1",
      projectId: "project-1",
      status: "draft",
      currentStep: "",
    }),
    getLocalWorkspaceFilePath: async () => null,
  });

  try {
    const route = reloadModule<typeof import("../app/api/init/[runId]/local-file/route")>(
      "../app/api/init/[runId]/local-file/route.ts"
    );

    const response = await route.GET(
      new Request("http://localhost/api/init/run-1/local-file?key=overview") as never,
      { params: Promise.resolve({ runId: "run-1" }) }
    );

    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.error, "Local workspace file not found");
  } finally {
    restoreStorage();
    restoreSession();
  }
});

test("POST /api/init/[runId]/open-local-file opens the resolved local workspace path", async () => {
  const pathCalls: Array<{ runId: string; fileKey: string }> = [];
  const openCalls: string[] = [];

  const restoreSession = patchModule("../lib/auth/session.ts", {
    getSession: async () => ({
      userId: "user-1",
      email: "user@example.com",
    }),
  });
  const restoreStorage = patchStorage({
    getOwnedResearchRun: async () => ({
      runId: "run-1",
      projectId: "project-1",
      status: "draft",
      currentStep: "",
    }),
    getLocalWorkspaceFilePath: async (runId: string, fileKey: string) => {
      pathCalls.push({ runId, fileKey });
      return "/Users/tester/Workspace/lumen/artifacts/overview.md";
    },
  });
  const restoreOpen = patchModule("../lib/workspace/open-in-editor.ts", {
    openLocalPathInEditor: async (filePath: string) => {
      openCalls.push(filePath);
      return { ok: true, mode: "cursor" };
    },
  });

  try {
    const route = reloadModule<
      typeof import("../app/api/init/[runId]/open-local-file/route")
    >("../app/api/init/[runId]/open-local-file/route.ts");

    const response = await route.POST(
      new Request("http://localhost/api/init/run-1/open-local-file?key=overview", {
        method: "POST",
      }) as never,
      { params: Promise.resolve({ runId: "run-1" }) }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(pathCalls, [{ runId: "run-1", fileKey: "overview" }]);
    assert.deepEqual(openCalls, [
      "/Users/tester/Workspace/lumen/artifacts/overview.md",
    ]);

    const body = await response.json();
    assert.deepEqual(body, { ok: true, mode: "cursor" });
  } finally {
    restoreOpen();
    restoreStorage();
    restoreSession();
  }
});

test("POST /api/init/[runId]/open-local-file returns 500 when opening the editor fails", async () => {
  const restoreSession = patchModule("../lib/auth/session.ts", {
    getSession: async () => ({
      userId: "user-1",
      email: "user@example.com",
    }),
  });
  const restoreStorage = patchStorage({
    getOwnedResearchRun: async () => ({
      runId: "run-1",
      projectId: "project-1",
      status: "draft",
      currentStep: "",
    }),
    getLocalWorkspaceFilePath: async () =>
      "/Users/tester/Workspace/lumen/artifacts/overview.md",
  });
  const restoreOpen = patchModule("../lib/workspace/open-in-editor.ts", {
    openLocalPathInEditor: async () => ({
      ok: false,
      error: "Cursor could not be launched.",
    }),
  });

  try {
    const route = reloadModule<
      typeof import("../app/api/init/[runId]/open-local-file/route")
    >("../app/api/init/[runId]/open-local-file/route.ts");

    const response = await route.POST(
      new Request("http://localhost/api/init/run-1/open-local-file?key=overview", {
        method: "POST",
      }) as never,
      { params: Promise.resolve({ runId: "run-1" }) }
    );

    assert.equal(response.status, 500);
    const body = await response.json();
    assert.equal(body.error, "Cursor could not be launched.");
  } finally {
    restoreOpen();
    restoreStorage();
    restoreSession();
  }
});
