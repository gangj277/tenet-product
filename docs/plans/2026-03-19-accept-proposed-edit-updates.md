# Accept Proposed Edit Updates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure accepting an edit-type proposed update immediately updates the viewer and persists the accepted content.

**Architecture:** Move proposed-update selection into a pure helper that extracts the accepted update and the next chat-message state in one synchronous step. Reuse that helper inside `useWorkspace` so React state scheduling no longer controls whether `updateContent()` runs, then cover the helper with a regression test.

**Tech Stack:** Next.js App Router, React hooks, TypeScript, Node test runner (`node --test` via `tsx`)

---

### Task 1: Capture the acceptance transition in a regression test

**Files:**
- Create: `tests/proposed-update-acceptance.test.tsx`
- Create: `app/dashboard/[runId]/_lib/proposed-update-acceptance.ts`

**Step 1: Write the failing test**

```typescript
test("accepting a proposed edit returns the selected update and marks it accepted", () => {
  const result = acceptProposedUpdateInMessages(messages, "message-1", "update-1");
  assert.equal(result.appliedUpdate?.key, "overview");
  assert.equal(result.nextMessages[0].proposedUpdates?.[0].status, "accepted");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/proposed-update-acceptance.test.tsx`
Expected: FAIL because the helper does not exist yet.

**Step 3: Write minimal implementation**

```typescript
export function acceptProposedUpdateInMessages(...) {
  let appliedUpdate;
  const nextMessages = ...;
  return { nextMessages, appliedUpdate };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/proposed-update-acceptance.test.tsx`
Expected: PASS

### Task 2: Wire the helper into the workspace hook

**Files:**
- Modify: `app/dashboard/[runId]/_hooks/use-workspace.ts`
- Modify: `app/dashboard/[runId]/_lib/proposed-update-acceptance.ts`
- Test: `tests/proposed-update-acceptance.test.tsx`

**Step 1: Replace updater-side extraction in `acceptProposedUpdate`**

```typescript
const { nextMessages, appliedUpdate } = acceptProposedUpdateInMessages(chatMessagesRef.current, messageId, updateId);
setChatMessages(nextMessages);
if (appliedUpdate) updateContent(appliedUpdate.key, appliedUpdate.content);
```

**Step 2: Keep the rest of the accept-side behavior unchanged**

Run: existing sidebar/navigation logic only when `appliedUpdate` exists.

**Step 3: Run targeted tests**

Run: `npm test -- tests/proposed-update-acceptance.test.tsx`
Expected: PASS

### Task 3: Verify the fix against the documented failure mode

**Files:**
- Verify: `app/dashboard/[runId]/_hooks/use-workspace.ts`
- Verify: `docs/bug-edit-proposed-update-not-applied.md`

**Step 1: Run focused verification**

Run: `npm test -- tests/proposed-update-acceptance.test.tsx`
Expected: PASS

**Step 2: Run a broader relevant check**

Run: `npm test`
Expected: Existing suite stays green, or any unrelated failures are called out explicitly.
