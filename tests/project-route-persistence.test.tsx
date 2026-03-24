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

test("POST /api/init persists project, run, and input rows for the logged-in user", async () => {
  const createdRuns: Array<Record<string, unknown>> = [];
  const statusUpdates: Array<Record<string, unknown>> = [];

  const restoreSession = patchModule("../lib/auth/session.ts", {
    getSession: async () => ({
      userId: "user-1",
      email: "user@example.com",
    }),
  });
  const restoreIds = patchModule("../lib/utils/id.ts", {
    generateId: (() => {
      const values = ["project-1", "run-1"];
      return () => values.shift() ?? "unexpected-id";
    })(),
  });
  const restoreGraph = patchModule("../lib/engine/graph.ts", {
    initGraph: {
      invoke: async () => ({
        perspective: {
          briefSummary: "Summary",
          interpretedIntent: "Intent",
          inferredResearchFrame: "Frame",
          evidenceForCriteria: [],
          evidenceAgainstCriteria: [],
          subquestions: [],
        },
      }),
    },
  });
  const restoreOpenAIAccess = patchModule("../lib/llm/openai-access.ts", {
    ensureOpenAIProviderAccess: async () => ({
      kind: "openai_auth",
      async callLLM() {
        throw new Error("not used");
      },
      async *callLLMStreaming() {
        yield {
          type: "done" as const,
          content: "",
          toolCalls: [],
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        };
      },
    }),
  });
  const restoreRuntime = patchModule("../lib/llm/runtime.ts", {
    runWithRequestProvider: async (_provider: unknown, fn: () => unknown) => fn(),
  });
  const restoreStorage = patchModule("../lib/storage/index.ts", {
    getStorage: async () => ({
      createResearchProjectRun: async (value: Record<string, unknown>) => {
        createdRuns.push(value);
      },
      updateResearchRunStatus: async (value: Record<string, unknown>) => {
        statusUpdates.push(value);
      },
    }),
    resetStorageForTests: () => {},
  });

  try {
    const route = reloadModule<typeof import("../app/api/init/route")>(
      "../app/api/init/route.ts"
    );

    const response = await route.POST(
      new Request("http://localhost/api/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: {
            researchQuestion: "  How do   LLMs cite sources?  ",
          },
          sources: [],
        }),
      }) as never
    );

    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.projectId, "project-1");
    assert.equal(body.runId, "run-1");

    assert.equal(createdRuns.length, 1);
    assert.deepEqual(createdRuns[0], {
      projectId: "project-1",
      runId: "run-1",
      userId: "user-1",
      input: {
        researchQuestion: "  How do   LLMs cite sources?  ",
      },
      status: "running",
    });

    assert.equal(statusUpdates.length, 1);
    assert.deepEqual(statusUpdates[0], {
      projectId: "project-1",
      runId: "run-1",
      status: "awaiting_confirmation",
    });
  } finally {
    restoreStorage();
    restoreRuntime();
    restoreOpenAIAccess();
    restoreGraph();
    restoreIds();
    restoreSession();
  }
});

test("POST /api/init rejects unauthenticated requests", async () => {
  const restoreSession = patchModule("../lib/auth/session.ts", {
    getSession: async () => null,
  });

  try {
    const route = reloadModule<typeof import("../app/api/init/route")>(
      "../app/api/init/route.ts"
    );

    const response = await route.POST(
      new Request("http://localhost/api/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { researchQuestion: "Why?" },
        }),
      }) as never
    );

    assert.equal(response.status, 401);
  } finally {
    restoreSession();
  }
});

test("POST /api/init requires workspacePath in Electron mode", async () => {
  const previousElectron = process.env.ELECTRON;
  process.env.ELECTRON = "1";

  const restoreSession = patchModule("../lib/auth/session.ts", {
    getSession: async () => ({
      userId: "user-1",
      email: "user@example.com",
    }),
  });

  try {
    const route = reloadModule<typeof import("../app/api/init/route")>(
      "../app/api/init/route.ts"
    );

    const response = await route.POST(
      new Request("http://localhost/api/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { researchQuestion: "Why?" },
          sources: [],
        }),
      }) as never
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "workspacePath is required in Electron mode",
    });
  } finally {
    restoreSession();
    if (previousElectron === undefined) {
      delete process.env.ELECTRON;
    } else {
      process.env.ELECTRON = previousElectron;
    }
  }
});

test("POST /api/init forwards workspacePath to storage in Electron mode", async () => {
  const previousElectron = process.env.ELECTRON;
  process.env.ELECTRON = "1";

  const createdRuns: Array<Record<string, unknown>> = [];
  const statusUpdates: Array<Record<string, unknown>> = [];

  const restoreSession = patchModule("../lib/auth/session.ts", {
    getSession: async () => ({
      userId: "user-1",
      email: "user@example.com",
    }),
  });
  const restoreIds = patchModule("../lib/utils/id.ts", {
    generateId: (() => {
      const values = ["project-1", "run-1"];
      return () => values.shift() ?? "unexpected-id";
    })(),
  });
  const restoreGraph = patchModule("../lib/engine/graph.ts", {
    initGraph: {
      invoke: async () => ({
        perspective: {
          briefSummary: "Summary",
          interpretedIntent: "Intent",
          inferredResearchFrame: "Frame",
          evidenceForCriteria: [],
          evidenceAgainstCriteria: [],
          subquestions: [],
        },
      }),
    },
  });
  const restoreOpenAIAccess = patchModule("../lib/llm/openai-access.ts", {
    ensureOpenAIProviderAccess: async () => ({
      kind: "openai_auth",
      async callLLM() {
        throw new Error("not used");
      },
      async *callLLMStreaming() {
        yield {
          type: "done" as const,
          content: "",
          toolCalls: [],
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        };
      },
    }),
  });
  const restoreRuntime = patchModule("../lib/llm/runtime.ts", {
    runWithRequestProvider: async (_provider: unknown, fn: () => unknown) => fn(),
  });
  const restoreStorage = patchModule("../lib/storage/index.ts", {
    getStorage: async () => ({
      createResearchProjectRun: async (value: Record<string, unknown>) => {
        createdRuns.push(value);
      },
      updateResearchRunStatus: async (value: Record<string, unknown>) => {
        statusUpdates.push(value);
      },
    }),
    resetStorageForTests: () => {},
  });

  try {
    const route = reloadModule<typeof import("../app/api/init/route")>(
      "../app/api/init/route.ts"
    );

    const response = await route.POST(
      new Request("http://localhost/api/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: {
            researchQuestion: "Why?",
          },
          sources: [],
          workspacePath: "/Users/tester/Workspace",
        }),
      }) as never
    );

    assert.equal(response.status, 200);
    assert.equal(createdRuns.length, 1);
    assert.deepEqual(createdRuns[0], {
      projectId: "project-1",
      runId: "run-1",
      userId: "user-1",
      input: {
        researchQuestion: "Why?",
      },
      status: "running",
      workspacePath: "/Users/tester/Workspace",
    });
    assert.equal(statusUpdates.length, 1);
  } finally {
    restoreStorage();
    restoreRuntime();
    restoreOpenAIAccess();
    restoreGraph();
    restoreIds();
    restoreSession();
    if (previousElectron === undefined) {
      delete process.env.ELECTRON;
    } else {
      process.env.ELECTRON = previousElectron;
    }
  }
});

test("GET /api/projects selects runId so dashboard cards can link to the run route", async () => {
  const listedUsers: string[] = [];
  const backfilledUsers: string[] = [];

  const restoreSession = patchModule("../lib/auth/session.ts", {
    getSession: async () => ({
      userId: "user-1",
      email: "user@example.com",
    }),
  });
  const restoreStorage = patchModule("../lib/storage/index.ts", {
    getStorage: async () => ({
      listResearchProjectsForUser: async (userId: string) => {
        listedUsers.push(userId);
        return [
          {
            id: "project-1",
            runId: "run-1",
            title: "A saved project",
            status: "completed",
            createdAt: new Date("2026-03-17T00:00:00Z"),
            updatedAt: new Date("2026-03-17T01:00:00Z"),
          },
        ];
      },
    }),
    resetStorageForTests: () => {},
  });
  const restoreBackfill = patchModule("../lib/storage/backfill-warm-runs.ts", {
    backfillWarmRunsForUser: async (userId: string) => {
      backfilledUsers.push(userId);
    },
  });

  try {
    const route = reloadModule<typeof import("../app/api/projects/route")>(
      "../app/api/projects/route.ts"
    );

    const response = await route.GET();
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.projects[0].runId, "run-1");
    assert.deepEqual(backfilledUsers, ["user-1"]);
    assert.deepEqual(listedUsers, ["user-1"]);
  } finally {
    restoreBackfill();
    restoreStorage();
    restoreSession();
  }
});

test("POST /api/projects creates a draft workspace with a scratchpad note and no user input row", async () => {
  const createdDrafts: Array<Record<string, unknown>> = [];
  const setRunCalls: Array<{ runId: string; value: Record<string, unknown> }> = [];
  const saveArtifactsCalls: Array<{ projectId: string; artifacts: Record<string, unknown> }> = [];

  const restoreSession = patchModule("../lib/auth/session.ts", {
    getSession: async () => ({
      userId: "user-1",
      email: "user@example.com",
    }),
  });
  const restoreIds = patchModule("../lib/utils/id.ts", {
    generateId: (() => {
      const values = ["project-1", "run-1"];
      return () => values.shift() ?? "unexpected-id";
    })(),
  });
  const restoreMemoryStore = patchModule("../lib/storage/memory-store.ts", {
    memoryStore: {
      setRun: (runId: string, value: Record<string, unknown>) => {
        setRunCalls.push({ runId, value });
      },
      saveArtifacts: async (projectId: string, artifacts: Record<string, unknown>) => {
        saveArtifactsCalls.push({ projectId, artifacts });
      },
      saveSourcesMeta: () => {},
    },
  });
  const restoreStorage = patchModule("../lib/storage/index.ts", {
    getStorage: async () => ({
      createDraftWorkspaceProjectRun: async (value: Record<string, unknown>) => {
        createdDrafts.push(value);
        return { title: "Untitled workspace", noteId: "note-1" };
      },
    }),
    resetStorageForTests: () => {},
  });
  const restoreBackfill = patchModule("../lib/storage/backfill-warm-runs.ts", {
    backfillWarmRunsForUser: async () => {},
  });

  try {
    const route = reloadModule<typeof import("../app/api/projects/route")>(
      "../app/api/projects/route.ts"
    );

    const response = await route.POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }) as never
    );

    assert.equal(response.status, 200);

    const body = await response.json();
    assert.deepEqual(body, {
      projectId: "project-1",
      runId: "run-1",
      status: "draft",
    });

    assert.deepEqual(createdDrafts, [
      {
        projectId: "project-1",
        runId: "run-1",
        userId: "user-1",
        title: undefined,
      },
    ]);

    assert.equal(setRunCalls.length, 1);
    assert.equal(setRunCalls[0]?.runId, "run-1");
    assert.equal(setRunCalls[0]?.value.status, "draft");
    assert.equal(saveArtifactsCalls.length, 1);
    assert.deepEqual(saveArtifactsCalls[0], {
      projectId: "project-1",
      artifacts: {
        overview: "",
        synthesis: "",
        claims: "",
        gaps: "",
        nextSteps: "",
        sources: {},
        papers: {},
        notes: {
          "note-1": "",
        },
        experiments: {},
      },
    });
  } finally {
    restoreBackfill();
    restoreStorage();
    restoreMemoryStore();
    restoreIds();
    restoreSession();
  }
});

test("POST /api/projects requires workspacePath in Electron mode", async () => {
  const previousElectron = process.env.ELECTRON;
  process.env.ELECTRON = "1";

  const restoreSession = patchModule("../lib/auth/session.ts", {
    getSession: async () => ({
      userId: "user-1",
      email: "user@example.com",
    }),
  });

  try {
    const route = reloadModule<typeof import("../app/api/projects/route")>(
      "../app/api/projects/route.ts"
    );

    const response = await route.POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }) as never
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "workspacePath is required in Electron mode",
    });
  } finally {
    restoreSession();
    if (previousElectron === undefined) {
      delete process.env.ELECTRON;
    } else {
      process.env.ELECTRON = previousElectron;
    }
  }
});

test("POST /api/projects forwards workspacePath to storage in Electron mode", async () => {
  const previousElectron = process.env.ELECTRON;
  process.env.ELECTRON = "1";

  const createdDrafts: Array<Record<string, unknown>> = [];

  const restoreSession = patchModule("../lib/auth/session.ts", {
    getSession: async () => ({
      userId: "user-1",
      email: "user@example.com",
    }),
  });
  const restoreIds = patchModule("../lib/utils/id.ts", {
    generateId: (() => {
      const values = ["project-1", "run-1"];
      return () => values.shift() ?? "unexpected-id";
    })(),
  });
  const restoreMemoryStore = patchModule("../lib/storage/memory-store.ts", {
    memoryStore: {
      setRun: () => {},
      saveArtifacts: async () => {},
      saveSourcesMeta: () => {},
    },
  });
  const restoreStorage = patchModule("../lib/storage/index.ts", {
    getStorage: async () => ({
      createDraftWorkspaceProjectRun: async (value: Record<string, unknown>) => {
        createdDrafts.push(value);
        return { title: "Untitled workspace", noteId: "note-1" };
      },
    }),
    resetStorageForTests: () => {},
  });

  try {
    const route = reloadModule<typeof import("../app/api/projects/route")>(
      "../app/api/projects/route.ts"
    );

    const response = await route.POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspacePath: "/Users/tester/Workspace",
        }),
      }) as never
    );

    assert.equal(response.status, 200);
    assert.deepEqual(createdDrafts, [
      {
        projectId: "project-1",
        runId: "run-1",
        userId: "user-1",
        title: undefined,
        workspacePath: "/Users/tester/Workspace",
      },
    ]);
  } finally {
    restoreStorage();
    restoreMemoryStore();
    restoreIds();
    restoreSession();
    if (previousElectron === undefined) {
      delete process.env.ELECTRON;
    } else {
      process.env.ELECTRON = previousElectron;
    }
  }
});

test("DELETE /api/projects/[projectId] clears warm in-memory state so deleted projects stay deleted", async () => {
  const deletedProjects: string[] = [];
  const clearedProjects: string[] = [];

  const restoreSession = patchModule("../lib/auth/session.ts", {
    getSession: async () => ({
      userId: "user-1",
      email: "user@example.com",
    }),
  });
  const restoreMemoryStore = patchModule("../lib/storage/memory-store.ts", {
    memoryStore: {
      deleteProject: (projectId: string) => {
        clearedProjects.push(projectId);
      },
    },
  });
  const restoreStorage = patchModule("../lib/storage/index.ts", {
    getStorage: async () => ({
      listResearchProjectsForUser: async () => [
        {
          id: "project-1",
          runId: "run-1",
          title: "Draft workspace",
          status: "draft",
          createdAt: new Date("2026-03-17T00:00:00Z"),
          updatedAt: new Date("2026-03-17T01:00:00Z"),
        },
      ],
      deleteProjectForUser: async (userId: string, projectId: string) => {
        deletedProjects.push(`${userId}:${projectId}`);
      },
    }),
    resetStorageForTests: () => {},
  });

  try {
    const route = reloadModule<typeof import("../app/api/projects/[projectId]/route")>(
      "../app/api/projects/[projectId]/route.ts"
    );

    const response = await route.DELETE(
      new Request("http://localhost/api/projects/project-1", {
        method: "DELETE",
      }) as never,
      { params: Promise.resolve({ projectId: "project-1" }) }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { deleted: true });
    assert.deepEqual(deletedProjects, ["user-1:project-1"]);
    assert.deepEqual(clearedProjects, ["project-1"]);
  } finally {
    restoreStorage();
    restoreMemoryStore();
    restoreSession();
  }
});

test("warm in-memory runs are backfilled into persisted project records for the owning user", async () => {
  const created: unknown[] = [];
  const persistedArtifacts: unknown[] = [];

  const restoreMemoryStore = patchModule("../lib/storage/memory-store.ts", {
    memoryStore: {
      listRuns: () => [
        {
          projectId: "project-1",
          runId: "run-1",
          status: "completed",
        },
      ],
    },
  });
  const restoreGraph = patchModule("../lib/engine/graph.ts", {
    initGraph: {
      getState: async () => ({
        values: {
          userId: "user-1",
          status: "completed",
          currentStep: "persist_project",
          startedAt: "2026-03-17T00:00:00.000Z",
          completedAt: "2026-03-17T00:10:00.000Z",
          input: {
            researchQuestion: "Will this appear on the dashboard?",
          },
          sources: [],
          artifacts: {
            overview: "overview",
            synthesis: "synthesis",
            claims: "claims",
            gaps: "gaps",
            nextSteps: "next",
            sources: {},
          },
        },
      }),
    },
  });
  const restoreStorage = patchModule("../lib/storage/index.ts", {
    getStorage: async () => ({
      getResearchRun: async () => null,
      createResearchProjectRun: async (value: unknown) => {
        created.push(value);
      },
      persistResearchArtifacts: async (value: unknown) => {
        persistedArtifacts.push(value);
      },
    }),
    resetStorageForTests: () => {},
  });

  try {
    const backfillModule = reloadModule<typeof import("../lib/storage/backfill-warm-runs")>(
      "../lib/storage/backfill-warm-runs.ts"
    );

    await backfillModule.backfillWarmRunsForUser("user-1");

    assert.equal(created.length, 1);
    assert.deepEqual(created[0], {
      projectId: "project-1",
      runId: "run-1",
      userId: "user-1",
      input: {
        researchQuestion: "Will this appear on the dashboard?",
      },
      status: "completed",
      currentStep: "persist_project",
      startedAt: new Date("2026-03-17T00:00:00.000Z"),
      completedAt: new Date("2026-03-17T00:10:00.000Z"),
    });

    assert.equal(persistedArtifacts.length, 1);
  } finally {
    restoreStorage();
    restoreGraph();
    restoreMemoryStore();
  }
});
