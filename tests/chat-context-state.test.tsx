import assert from "node:assert/strict";
import test from "node:test";

import type { ChatMessage } from "../app/dashboard/[runId]/_lib/workspace-types.ts";
import {
  buildConversationHistoryFromMessages,
  deriveChatContinuationState,
  estimateLiveContextUsage,
  isCompactCommand,
  resolveDisplayedChatUsage,
} from "../lib/agent/chat-context.ts";

function makeMessages(): ChatMessage[] {
  return [
    {
      id: "user-1",
      role: "user",
      text: "Read the uploaded studies and summarize the conflicts.",
      timestamp: 1,
    },
    {
      id: "agent-1",
      role: "agent",
      text: "I found two studies with conflicting measures.",
      timestamp: 2,
      proposedUpdates: [
        {
          id: "update-1",
          type: "edit",
          key: "synthesis",
          label: "Synthesis",
          content: "Updated synthesis",
          summary: "Clarify the methodological conflict.",
          status: "pending",
        },
      ],
    },
    {
      id: "agent-2",
      role: "agent",
      text: "Context compacted. Live context reduced.",
      timestamp: 3,
      activatedSkills: ["source-scout", "methodology-critic"],
      taskPlan: [
        { id: "task-1", objective: "Read sources", status: "completed" },
        { id: "task-2", objective: "Compare methodologies", status: "active" },
      ],
      compactionSnapshot: {
        version: 1,
        compactedMessageCount: 2,
        summary: "The workspace contains two conflicting studies and an unfinished synthesis edit.",
        keyFacts: ["Study A uses GAD-7.", "Study B uses a custom survey."],
        openLoops: ["Resolve whether the measures are comparable."],
        nextStepHint: "Compare the methodology sections directly before editing the synthesis.",
        activatedSkills: ["source-scout", "methodology-critic"],
        taskPlan: {
          created: 1,
          activeTaskId: "task-2",
          tasks: [
            { id: "task-1", objective: "Read sources", status: "completed" },
            { id: "task-2", objective: "Compare methodologies", status: "active" },
          ],
        },
        estimatedTokensAfter: 42000,
        compactedAt: "2026-03-24T09:00:00.000Z",
      },
    },
    {
      id: "user-2",
      role: "user",
      text: "What should I update next?",
      timestamp: 4,
    },
  ];
}

test("deriveChatContinuationState restores snapshot, active skills, and task plan from messages", () => {
  const continuation = deriveChatContinuationState(makeMessages());

  assert.equal(continuation.compactionSnapshot?.compactedMessageCount, 2);
  assert.deepEqual(continuation.activeSkills, ["source-scout", "methodology-critic"]);
  assert.equal(continuation.taskPlan?.activeTaskId, "task-2");
});

test("buildConversationHistoryFromMessages uses synthetic compact memory plus raw tail", () => {
  const messages = makeMessages();
  const continuation = deriveChatContinuationState(messages);
  const history = buildConversationHistoryFromMessages(messages, continuation);

  assert.equal(history.length, 2);
  assert.equal(history[0]?.role, "assistant");
  assert.match(history[0]?.content ?? "", /Compacted memory/i);
  assert.match(history[0]?.content ?? "", /Pending proposed updates/i);
  assert.match(history[0]?.content ?? "", /Clarify the methodological conflict/i);
  assert.match(history[0]?.content ?? "", /Compare methodologies/i);
  assert.equal(history[1]?.role, "user");
  assert.equal(history[1]?.content, "What should I update next?");
});

test("estimateLiveContextUsage returns approximate live context tokens and near-limit status", () => {
  const messages = makeMessages();
  const continuation = deriveChatContinuationState(messages);
  const usage = estimateLiveContextUsage({
    messages,
    continuation,
    thresholdTokens: 100,
    workspaceContext: {
      workspaceFiles: { overview: "Overview text" },
      availableKeys: ["overview"],
      fileLabels: { overview: "Overview" },
    },
  });

  assert.ok(usage.estimatedLiveContextTokens > 0);
  assert.equal(usage.compactionThresholdTokens, 100);
  assert.equal(usage.compactionStatus, "near_limit");
});

test("resolveDisplayedChatUsage keeps the live estimate and stores provider usage separately", () => {
  const resolved = resolveDisplayedChatUsage(
    {
      estimatedLiveContextTokens: 1234,
      compactionThresholdTokens: 250000,
      compactionStatus: "idle",
    },
    { promptTokens: 98765, completionTokens: 321, totalTokens: 99086 }
  );

  assert.equal(resolved.estimatedLiveContextTokens, 1234);
  assert.equal(resolved.compactionStatus, "idle");
  assert.deepEqual(resolved.lastInferenceUsage, {
    promptTokens: 98765,
    completionTokens: 321,
    totalTokens: 99086,
  });
});

test("isCompactCommand only matches the exact slash command without attachments", () => {
  assert.equal(isCompactCommand("/compact"), true);
  assert.equal(isCompactCommand(" /compact "), true);
  assert.equal(isCompactCommand("/compact now"), false);
  assert.equal(isCompactCommand("/compact", [{ name: "note.txt" }]), false);
});
