import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPersistedMessageMetadata,
  hydrateStoredChatMessage,
} from "../app/dashboard/[runId]/_lib/chat-message-metadata.ts";
import type { CompactionSnapshot } from "../lib/agent/state.ts";

test("buildPersistedMessageMetadata includes process trace entries", () => {
  const metadata = buildPersistedMessageMetadata({
    processTrace: [
      {
        id: "step-1",
        kind: "tool",
        label: "Reading files",
        detail: "Overview",
        status: "completed",
      },
    ],
  });

  assert.deepEqual(metadata, {
    processTrace: [
      {
        id: "step-1",
        kind: "tool",
        label: "Reading files",
        detail: "Overview",
        status: "completed",
      },
    ],
  });
});

test("hydrateStoredChatMessage restores process trace metadata on agent messages", () => {
  const message = hydrateStoredChatMessage({
    id: "agent-1",
    role: "agent",
    text: "Done",
    createdAt: "2026-03-24T00:00:00.000Z",
    metadata: {
      processTrace: [
        {
          id: "step-1",
          kind: "tool",
          label: "Reading files",
          detail: "Overview",
          status: "completed",
        },
      ],
    },
  });

  assert.equal(message.role, "agent");
  assert.equal(message.processTrace?.length, 1);
  assert.equal(message.processTrace?.[0].label, "Reading files");
});

test("message metadata round-trips compaction snapshot and activated skills", () => {
  const snapshot: CompactionSnapshot = {
    version: 1,
    compactedMessageCount: 12,
    summary: "The agent reviewed the workspace and narrowed the open questions.",
    keyFacts: ["Source A reports N=300.", "Source B contradicts the effect size."],
    openLoops: ["Reconcile the methodology mismatch."],
    nextStepHint: "Compare measurement definitions before editing the synthesis.",
    activatedSkills: ["source-scout", "methodology-critic"],
    taskPlan: {
      created: 1,
      activeTaskId: "task-2",
      tasks: [
        { id: "task-1", objective: "Read sources", status: "completed" },
        { id: "task-2", objective: "Compare methods", status: "active" },
      ],
    },
    estimatedTokensAfter: 81234,
    compactedAt: "2026-03-24T09:00:00.000Z",
  };

  const metadata = buildPersistedMessageMetadata({
    activatedSkills: ["source-scout", "methodology-critic"],
    compactionSnapshot: snapshot,
  });

  assert.deepEqual(metadata, {
    activatedSkills: ["source-scout", "methodology-critic"],
    compactionSnapshot: snapshot,
  });

  const hydrated = hydrateStoredChatMessage({
    id: "agent-2",
    role: "agent",
    text: "Context compacted.",
    createdAt: "2026-03-24T09:00:00.000Z",
    metadata,
  });

  assert.deepEqual(hydrated.activatedSkills, ["source-scout", "methodology-critic"]);
  assert.deepEqual(hydrated.compactionSnapshot, snapshot);
});

test("message metadata round-trips provider usage", () => {
  const metadata = buildPersistedMessageMetadata({
    providerUsage: {
      promptTokens: 12345,
      completionTokens: 678,
      totalTokens: 13023,
    },
  });

  assert.deepEqual(metadata, {
    providerUsage: {
      promptTokens: 12345,
      completionTokens: 678,
      totalTokens: 13023,
    },
  });

  const hydrated = hydrateStoredChatMessage({
    id: "agent-usage",
    role: "agent",
    text: "Done",
    createdAt: "2026-03-24T10:00:00.000Z",
    metadata,
  });

  assert.deepEqual(hydrated.providerUsage, {
    promptTokens: 12345,
    completionTokens: 678,
    totalTokens: 13023,
  });
});
