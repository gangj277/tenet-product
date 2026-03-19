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

test("appendMessages preserves caller-provided message ids", async () => {
  const insertedRows: unknown[] = [];

  const restoreDb = patchModule("../lib/db/client.ts", {
    db: {
      transaction: async (
        callback: (tx: {
          insert: (table: unknown) => {
            values: (value: unknown) => Promise<void>;
          };
          update: (table: unknown) => {
            set: (value: unknown) => {
              where: (_condition: unknown) => Promise<void>;
            };
          };
        }) => Promise<void>
      ) =>
        callback({
          insert() {
            return {
              async values(value) {
                insertedRows.push(value);
              },
            };
          },
          update() {
            return {
              set() {
                return {
                  async where() {},
                };
              },
            };
          },
        }),
    },
  });

  try {
    clearModule("../lib/db/chat-sessions.ts");
    const { appendMessages } = reloadModule<
      typeof import("../lib/db/chat-sessions")
    >("../lib/db/chat-sessions.ts");

    await appendMessages("session-1", [
      {
        id: "agent-message-1",
        role: "agent",
        text: "Applied changes",
        metadata: {
          proposedUpdates: [
            { id: "update-1", status: "accepted" },
          ],
        },
      },
    ]);

    assert.deepEqual(insertedRows[0], [
      {
        id: "agent-message-1",
        sessionId: "session-1",
        role: "agent",
        text: "Applied changes",
        metadata: {
          proposedUpdates: [
            { id: "update-1", status: "accepted" },
          ],
        },
      },
    ]);
  } finally {
    restoreDb();
  }
});

test("PATCH /api/agent/[runId]/sessions/[sessionId]/messages updates message metadata", async () => {
  const updateCalls: Array<Record<string, unknown>> = [];

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
    }),
  });
  const restoreChatSessions = patchModule("../lib/db/chat-sessions.ts", {
    appendMessages: async () => {},
    updateMessageMetadata: async (
      sessionId: string,
      messageId: string,
      metadata: Record<string, unknown>
    ) => {
      updateCalls.push({ sessionId, messageId, metadata });
    },
  });

  try {
    clearModule("../app/api/agent/[runId]/sessions/[sessionId]/messages/route.ts");
    const route = reloadModule<
      typeof import("../app/api/agent/[runId]/sessions/[sessionId]/messages/route")
    >("../app/api/agent/[runId]/sessions/[sessionId]/messages/route.ts");

    const response = await route.PATCH(
      new Request("http://localhost/api/agent/run-1/sessions/session-1/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: "agent-message-1",
          metadata: {
            proposedUpdates: [
              {
                id: "update-1",
                type: "edit",
                key: "overview",
                content: "Updated overview",
                summary: "Refresh overview",
                status: "accepted",
              },
            ],
          },
        }),
      }) as never,
      { params: Promise.resolve({ runId: "run-1", sessionId: "session-1" }) }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(updateCalls, [
      {
        sessionId: "session-1",
        messageId: "agent-message-1",
        metadata: {
          proposedUpdates: [
            {
              id: "update-1",
              type: "edit",
              key: "overview",
              content: "Updated overview",
              summary: "Refresh overview",
              status: "accepted",
            },
          ],
        },
      },
    ]);
  } finally {
    restoreChatSessions();
    restoreResearchProjects();
    restoreSession();
  }
});
