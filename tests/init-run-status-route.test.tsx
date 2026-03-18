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

test("GET /api/init/[runId] prefers failed persisted status over stale graph state", async () => {
  const restoreSession = patchModule("../lib/auth/session.ts", {
    getSession: async () => ({
      userId: "user-1",
      email: "user@example.com",
    }),
  });
  const restoreResearchProjects = patchModule("../lib/db/research-projects.ts", {
    getOwnedResearchRun: async () => ({
      runId: "run-1",
      projectId: "project-1",
      status: "failed",
      currentStep: "persist_project",
    }),
  });
  const restoreMemoryStore = patchModule("../lib/storage/memory-store.ts", {
    memoryStore: {
      getRun: () => ({
        projectId: "project-1",
        runId: "run-1",
        status: "running",
        currentStep: "persist_project",
        errors: [
          {
            step: "persist_project",
            message: "Database write failed",
            retryable: false,
            timestamp: "2026-03-17T00:00:00.000Z",
          },
        ],
      }),
      getProgress: () => [
        {
          id: "persist_project",
          label: "Finalizing project",
          status: "failed",
          detail: "Database write failed",
        },
      ],
    },
  });
  const restoreGraph = patchModule("../lib/engine/graph.ts", {
    initGraph: {
      getState: async () => ({
        values: {
          status: "running",
          currentStep: "persist_project",
          errors: [],
        },
      }),
    },
  });

  try {
    const route = reloadModule<typeof import("../app/api/init/[runId]/route")>(
      "../app/api/init/[runId]/route.ts"
    );

    const response = await route.GET(
      new Request("http://localhost/api/init/run-1") as never,
      { params: Promise.resolve({ runId: "run-1" }) }
    );

    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.status, "failed");
    assert.equal(body.currentStep, "persist_project");
    assert.equal(body.errors[0].message, "Database write failed");
  } finally {
    restoreGraph();
    restoreMemoryStore();
    restoreResearchProjects();
    restoreSession();
  }
});

test("POST /api/init/[runId]/confirm marks the active step failed when background execution rejects", async () => {
  const setRunCalls: Array<Record<string, unknown>> = [];
  const progressUpdates: Array<Record<string, unknown>> = [];
  const runStatusUpdates: Array<Record<string, unknown>> = [];

  const restoreSession = patchModule("../lib/auth/session.ts", {
    getSession: async () => ({
      userId: "user-1",
      email: "user@example.com",
    }),
  });
  const restoreResearchProjects = patchModule("../lib/db/research-projects.ts", {
    getOwnedResearchRun: async () => ({
      runId: "run-1",
      projectId: "project-1",
      status: "running",
      currentStep: "persist_project",
    }),
    updateResearchRunStatus: async (value: unknown) => {
      runStatusUpdates.push(value as Record<string, unknown>);
    },
  });
  const restoreMemoryStore = patchModule("../lib/storage/memory-store.ts", {
    memoryStore: {
      getRun: () => ({
        projectId: "project-1",
        runId: "run-1",
        status: "awaiting_confirmation",
        currentStep: "persist_project",
        updatedAt: "2026-03-17T00:00:00.000Z",
      }),
      setRun: (_runId: string, value: Record<string, unknown>) => {
        setRunCalls.push(value);
      },
      initProgress: () => {},
      getProgress: () => [
        {
          id: "persist_project",
          label: "Finalizing project",
          status: "running",
        },
      ],
      updateProgress: (
        runId: string,
        stepId: string,
        update: Record<string, unknown>
      ) => {
        progressUpdates.push({ runId, stepId, update });
      },
    },
  });
  const restoreGraph = patchModule("../lib/engine/graph.ts", {
    initGraph: {
      invoke: async () => {
        throw new Error("Database write failed");
      },
    },
  });

  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    clearModule("../app/api/init/[runId]/confirm/route.ts");
    const route = reloadModule<typeof import("../app/api/init/[runId]/confirm/route")>(
      "../app/api/init/[runId]/confirm/route.ts"
    );

    const response = await route.POST(
      new Request("http://localhost/api/init/run-1/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      }) as never,
      { params: Promise.resolve({ runId: "run-1" }) }
    );

    assert.equal(response.status, 200);

    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(progressUpdates[0], {
      runId: "run-1",
      stepId: "persist_project",
      update: {
        status: "failed",
        detail: "Database write failed",
      },
    });

    const failedRun = setRunCalls[setRunCalls.length - 1];
    assert.equal(failedRun.status, "failed");
    assert.equal(failedRun.currentStep, "persist_project");
    assert.equal(
      (failedRun.errors as Array<{ message: string }>)[0].message,
      "Database write failed"
    );

    assert.deepEqual(runStatusUpdates[runStatusUpdates.length - 1], {
      projectId: "project-1",
      runId: "run-1",
      status: "failed",
      currentStep: "persist_project",
    });
  } finally {
    console.error = originalConsoleError;
    restoreGraph();
    restoreMemoryStore();
    restoreResearchProjects();
    restoreSession();
  }
});
