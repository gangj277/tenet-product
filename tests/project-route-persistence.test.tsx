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
  const inserts: unknown[] = [];
  const updates: unknown[] = [];

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
  const restoreDb = patchModule("../lib/db/client.ts", {
    db: {
      transaction: async (
        callback: (tx: {
          insert: (table: unknown) => {
            values: (value: unknown) => Promise<void>;
          };
          update: (table: unknown) => {
            set: (value: unknown) => {
              where: (condition: unknown) => Promise<void>;
            };
          };
        }) => Promise<void>
      ) =>
        callback({
          insert(table) {
            return {
              async values(value) {
                inserts.push({ table, value });
              },
            };
          },
          update(table) {
            return {
              set(value) {
                updates.push({ table, value });
                return {
                  async where(condition) {
                    updates.push({ table, condition });
                  },
                };
              },
            };
          },
        }),
    },
  });

  try {
    clearModule("../lib/db/research-projects.ts");
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

    assert.equal(inserts.length, 3);

    const projectInsert = inserts.find(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "value" in entry &&
        typeof entry.value === "object" &&
        entry.value !== null &&
        "userId" in entry.value
    ) as { value: Record<string, unknown> } | undefined;
    assert.ok(projectInsert);
    assert.equal(projectInsert.value.id, "project-1");
    assert.equal(projectInsert.value.userId, "user-1");
    assert.equal(projectInsert.value.title, "How do LLMs cite sources?");

    const runInsert = inserts.find(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "value" in entry &&
        typeof entry.value === "object" &&
        entry.value !== null &&
        entry.value.id === "run-1"
    ) as { value: Record<string, unknown> } | undefined;
    assert.ok(runInsert);
    assert.equal(runInsert.value.projectId, "project-1");

    const inputInsert = inserts.find(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "value" in entry &&
        typeof entry.value === "object" &&
        entry.value !== null &&
        entry.value.runId === "run-1" &&
        "researchQuestion" in entry.value
    ) as { value: Record<string, unknown> } | undefined;
    assert.ok(inputInsert);
    assert.equal(
      inputInsert.value.researchQuestion,
      "How do   LLMs cite sources?"
    );

    assert.ok(updates.length > 0);
  } finally {
    restoreDb();
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
    clearModule("../lib/db/research-projects.ts");
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

test("GET /api/projects selects runId so dashboard cards can link to the run route", async () => {
  let selectShape: Record<string, unknown> | null = null;

  const restoreSession = patchModule("../lib/auth/session.ts", {
    getSession: async () => ({
      userId: "user-1",
      email: "user@example.com",
    }),
  });
  const restoreDb = patchModule("../lib/db/client.ts", {
    db: {
      select(shape: Record<string, unknown>) {
        selectShape = shape;

        const chain = {
          from() {
            return chain;
          },
          leftJoin() {
            return chain;
          },
          where() {
            return chain;
          },
          orderBy() {
            return Promise.resolve([
              {
                id: "project-1",
                runId: "run-1",
                title: "A saved project",
                status: "completed",
                createdAt: new Date("2026-03-17T00:00:00Z").toISOString(),
                updatedAt: new Date("2026-03-17T01:00:00Z").toISOString(),
              },
            ]);
          },
        };

        return chain;
      },
    },
  });
  const restoreBackfill = patchModule("../lib/db/backfill-warm-runs.ts", {
    backfillWarmRunsForUser: async () => {},
  });

  try {
    clearModule("../lib/db/research-projects.ts");
    const route = reloadModule<typeof import("../app/api/projects/route")>(
      "../app/api/projects/route.ts"
    );

    const response = await route.GET();
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.projects[0].runId, "run-1");
    assert.ok(selectShape);
    assert.ok("runId" in selectShape);
  } finally {
    restoreBackfill();
    restoreDb();
    restoreSession();
  }
});

test("POST /api/projects creates a draft workspace with a scratchpad note and no user input row", async () => {
  const inserts: unknown[] = [];
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
  const restoreDb = patchModule("../lib/db/client.ts", {
    db: {
      transaction: async (
        callback: (tx: {
          insert: (table: unknown) => {
            values: (value: unknown) => Promise<void>;
          };
        }) => Promise<void>
      ) =>
        callback({
          insert(table) {
            return {
              async values(value) {
                inserts.push({ table, value });
              },
            };
          },
        }),
    },
  });
  const restoreBackfill = patchModule("../lib/db/backfill-warm-runs.ts", {
    backfillWarmRunsForUser: async () => {},
  });

  try {
    clearModule("../lib/db/research-projects.ts");
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

    const projectInsert = inserts.find(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "value" in entry &&
        typeof entry.value === "object" &&
        entry.value !== null &&
        "userId" in entry.value
    ) as { value: Record<string, unknown> } | undefined;
    assert.ok(projectInsert);
    assert.equal(projectInsert.value.id, "project-1");
    assert.equal(projectInsert.value.title, "Untitled workspace");
    assert.equal(projectInsert.value.status, "draft");

    const runInsert = inserts.find(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "value" in entry &&
        typeof entry.value === "object" &&
        entry.value !== null &&
        entry.value.id === "run-1"
    ) as { value: Record<string, unknown> } | undefined;
    assert.ok(runInsert);
    assert.equal(runInsert.value.projectId, "project-1");
    assert.equal(runInsert.value.status, "draft");

    const noteInsert = inserts.find(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "value" in entry &&
        typeof entry.value === "object" &&
        entry.value !== null &&
        entry.value.runId === "run-1" &&
        entry.value.label === "Scratchpad"
    ) as { value: Record<string, unknown> } | undefined;
    assert.ok(noteInsert);

    const inputInsert = inserts.find(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "value" in entry &&
        typeof entry.value === "object" &&
        entry.value !== null &&
        "researchQuestion" in entry.value
    );
    assert.equal(inputInsert, undefined);

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
          [String(noteInsert?.value.id ?? "")]: "",
        },
        experiments: {},
      },
    });
  } finally {
    restoreBackfill();
    restoreDb();
    restoreMemoryStore();
    restoreIds();
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
  const restoreResearchProjects = patchModule("../lib/db/research-projects.ts", {
    getResearchRun: async () => null,
    createResearchProjectRun: async (value: unknown) => {
      created.push(value);
    },
    persistResearchArtifacts: async (value: unknown) => {
      persistedArtifacts.push(value);
    },
  });

  try {
    const backfillModule = reloadModule<typeof import("../lib/db/backfill-warm-runs")>(
      "../lib/db/backfill-warm-runs.ts"
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
    restoreResearchProjects();
    restoreGraph();
    restoreMemoryStore();
  }
});
