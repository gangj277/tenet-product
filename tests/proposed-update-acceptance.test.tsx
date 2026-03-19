import assert from "node:assert/strict";
import test from "node:test";
import type { ChatMessage } from "../app/dashboard/[runId]/_lib/workspace-types.ts";
import {
  acceptProposedUpdateInMessages,
  updateProposedUpdateStatusInMessages,
} from "../app/dashboard/[runId]/_lib/proposed-update-acceptance.ts";

test("accepting a proposed edit returns the applied update and marks only that update accepted", () => {
  const messages: ChatMessage[] = [
    {
      id: "message-1",
      role: "agent",
      text: "I have an update.",
      timestamp: 1,
      proposedUpdates: [
        {
          id: "update-1",
          type: "edit",
          key: "synthesis",
          label: "Synthesis",
          content: "New synthesis content",
          summary: "Rewrite synthesis",
          status: "pending",
        },
        {
          id: "update-2",
          type: "edit",
          key: "claims",
          label: "Claims",
          content: "Other content",
          summary: "Rewrite claims",
          status: "pending",
        },
      ],
    },
  ];

  const result = acceptProposedUpdateInMessages(messages, "message-1", "update-1");

  assert.equal(result.appliedUpdate?.id, "update-1");
  assert.equal(result.appliedUpdate?.key, "synthesis");
  assert.equal(result.nextMessages[0].proposedUpdates?.[0].status, "accepted");
  assert.equal(result.nextMessages[0].proposedUpdates?.[1].status, "pending");
  assert.equal(messages[0].proposedUpdates?.[0].status, "pending");
});

test("accepting a missing proposed update leaves messages unchanged", () => {
  const messages: ChatMessage[] = [
    {
      id: "message-1",
      role: "agent",
      text: "I have an update.",
      timestamp: 1,
      proposedUpdates: [
        {
          id: "update-1",
          type: "edit",
          key: "overview",
          content: "Updated overview",
          summary: "Rewrite overview",
          status: "pending",
        },
      ],
    },
  ];

  const result = acceptProposedUpdateInMessages(messages, "message-1", "missing-update");

  assert.equal(result.appliedUpdate, undefined);
  assert.deepEqual(result.nextMessages, messages);
});

test("rejecting a proposed edit returns the updated message with rejected status", () => {
  const messages: ChatMessage[] = [
    {
      id: "message-1",
      role: "agent",
      text: "I have an update.",
      timestamp: 1,
      proposedUpdates: [
        {
          id: "update-1",
          type: "edit",
          key: "overview",
          content: "Updated overview",
          summary: "Rewrite overview",
          status: "pending",
        },
      ],
    },
  ];

  const result = updateProposedUpdateStatusInMessages(
    messages,
    "message-1",
    "update-1",
    "rejected"
  );

  assert.equal(result.updatedMessage?.id, "message-1");
  assert.equal(result.updatedMessage?.proposedUpdates?.[0].status, "rejected");
  assert.equal(result.nextMessages[0].proposedUpdates?.[0].status, "rejected");
  assert.equal(messages[0].proposedUpdates?.[0].status, "pending");
});
