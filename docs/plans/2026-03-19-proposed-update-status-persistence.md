# Proposed Update Status Persistence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist proposed update accept/reject status so the chat UI survives page refresh with the correct applied or dismissed state.

**Architecture:** Keep message IDs stable from the client through DB insertion, then add a narrow metadata update path for existing chat messages. Reuse a pure proposed-update transition helper in the workspace hook so the UI state update and the persisted metadata are derived from the same message object.

**Tech Stack:** Next.js App Router, React hooks, TypeScript, Drizzle ORM, Node test runner (`node --test` via `tsx`)

---

### Task 1: Add regression tests for message persistence

**Files:**
- Create: `tests/chat-session-messages-route.test.tsx`
- Modify: `tests/proposed-update-acceptance.test.tsx`

**Step 1: Write the failing route tests**

```typescript
test("POST /messages preserves explicit message ids", async () => {
  await route.POST(request, params);
  assert.equal(appendMessagesCalls[0].messages[0].id, "agent-message-1");
});

test("PATCH /messages updates metadata for an existing message", async () => {
  await route.PATCH(request, params);
  assert.deepEqual(updateMessageMetadataCalls[0], {
    sessionId: "session-1",
    messageId: "agent-message-1",
    metadata: { proposedUpdates: [...] },
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/chat-session-messages-route.test.tsx`
Expected: FAIL because the route does not yet preserve IDs or support `PATCH`.

**Step 3: Extend proposed update helper coverage**

```typescript
test("rejecting a proposed edit returns the updated message with rejected status", () => {
  const result = updateProposedUpdateStatusInMessages(messages, "message-1", "update-1", "rejected");
  assert.equal(result.updatedMessage?.proposedUpdates?.[0].status, "rejected");
});
```

**Step 4: Run test to verify it fails**

Run: `npm test -- tests/proposed-update-acceptance.test.tsx`
Expected: FAIL because reject-side helper output does not exist yet.

### Task 2: Implement stable message ID persistence and metadata updates

**Files:**
- Modify: `lib/db/chat-sessions.ts`
- Modify: `app/api/agent/[runId]/sessions/[sessionId]/messages/route.ts`

**Step 1: Allow message inserts to accept explicit IDs**

```typescript
export async function appendMessages(sessionId: string, messages: { id?: string; ... }[]) {
  await tx.insert(chatMessages).values(messages.map((message) => ({
    id: message.id,
    sessionId,
    ...
  })));
}
```

**Step 2: Add metadata update support**

```typescript
export async function updateMessageMetadata(sessionId: string, messageId: string, metadata: Record<string, unknown>) {
  await db.transaction(async (tx) => {
    await tx.update(chatMessages).set({ metadata }).where(and(eq(chatMessages.id, messageId), eq(chatMessages.sessionId, sessionId)));
    await tx.update(chatSessions).set({ updatedAt: new Date() }).where(eq(chatSessions.id, sessionId));
  });
}
```

**Step 3: Expose guarded `PATCH /messages`**

```typescript
const { messageId, metadata } = await req.json();
await updateMessageMetadata(sessionId, messageId, metadata);
```

**Step 4: Run targeted route tests**

Run: `npm test -- tests/chat-session-messages-route.test.tsx`
Expected: PASS

### Task 3: Wire accept/reject actions to persist updated metadata

**Files:**
- Modify: `app/dashboard/[runId]/_lib/proposed-update-acceptance.ts`
- Modify: `app/dashboard/[runId]/_hooks/use-workspace.ts`
- Modify: `tests/proposed-update-acceptance.test.tsx`

**Step 1: Return the updated message from the helper**

```typescript
const result = updateProposedUpdateStatusInMessages(messages, messageId, updateId, "accepted");
```

**Step 2: Persist metadata after local accept/reject**

```typescript
persistMessageMetadata(updatedMessage.id, {
  proposedUpdates: updatedMessage.proposedUpdates,
  searchResults: updatedMessage.searchResults,
  askUserQuestion: updatedMessage.askUserQuestion,
});
```

**Step 3: Preserve explicit message IDs when persisting streamed messages**

```typescript
messages: [
  { id: userMsg.id, role: "user", text },
  { id: agentMsgId, role: "agent", text: finalAgentText, metadata: agentMetadata },
]
```

**Step 4: Run focused tests**

Run: `npm test -- tests/proposed-update-acceptance.test.tsx tests/chat-session-messages-route.test.tsx`
Expected: PASS

### Task 4: Verify the documented failure mode end-to-end

**Files:**
- Verify: `app/dashboard/[runId]/_hooks/use-workspace.ts`
- Verify: `app/api/agent/[runId]/sessions/[sessionId]/messages/route.ts`
- Verify: `lib/db/chat-sessions.ts`

**Step 1: Run focused regression coverage**

Run: `npm test -- tests/proposed-update-acceptance.test.tsx tests/chat-session-messages-route.test.tsx`
Expected: PASS

**Step 2: Run broader relevant suite**

Run: `npm test`
Expected: Existing suite stays green, or any unrelated failures are called out explicitly.
