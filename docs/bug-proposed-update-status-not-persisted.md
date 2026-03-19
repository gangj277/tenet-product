# Bug: Proposed Update Accept/Reject Status Lost on Page Refresh

## Symptom

User accepts or dismisses a proposed update (experiment edit or markdown edit). The card correctly shows "Applied" or "Dismissed". But after refreshing the page, the same proposed update reappears as **pending** with Accept/Dismiss buttons, as if the user never acted on it.

---

## Root Cause

**Accept/reject status changes are never written back to the database.** They only live in React state.

### The data flow

```
1. Agent emits proposed_update via SSE
   → status set to "pending" (edits) or "accepted" (new files)
   → stored in finalProposedUpdates

2. SSE stream ends → messages persisted to DB
   → POST /api/agent/{runId}/sessions/{sessionId}/messages
   → metadata.proposedUpdates saved with ORIGINAL status ("pending")

3. User clicks Accept
   → setChatMessages() updates in-memory status to "accepted"
   → updateContent() applies the edit to workspace
   → ❌ NO API call to persist the status change

4. Page refresh
   → GET /api/agent/{runId}/sessions/{sessionId}/ loads messages from DB
   → metadata.proposedUpdates still has status: "pending"
   → UI shows Accept/Dismiss buttons again
```

The status update happens only in `setChatMessages` (React state). There is no API endpoint or DB function to update a message's metadata after creation.

---

## Where the Gap Is

### Accept handler — updates state, doesn't persist

```typescript
// use-workspace.ts:853-873
const acceptProposedUpdate = useCallback(
  (messageId: string, updateId: string) => {
    // ✅ Updates in-memory state
    setChatMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        return {
          ...m,
          proposedUpdates: m.proposedUpdates?.map((pu) =>
            pu.id === updateId ? { ...pu, status: "accepted" } : pu
          ),
        };
      })
    );

    // ✅ Applies content change
    updateContent(appliedUpdate.key, appliedUpdate.content);

    // ❌ MISSING: persist status change to DB
  },
  [updateContent]
);
```

### Reject handler — same issue

```typescript
// use-workspace.ts:952-967
const rejectProposedUpdate = useCallback(
  (messageId: string, updateId: string) => {
    // ✅ Updates in-memory state
    setChatMessages((prev) => ...status: "rejected"...);

    // ❌ MISSING: persist status change to DB
  },
  []
);
```

### Message save — only happens once at stream end

```typescript
// use-workspace.ts:798-823
// This fires ONCE when the agent finishes responding.
// It saves finalProposedUpdates with status "pending".
// It is never called again after accept/reject.
fetch(`/api/agent/${runId}/sessions/${sessionId}/messages`, {
  method: "POST",
  body: JSON.stringify({
    messages: [
      { role: "user", text },
      { role: "agent", text: finalAgentText, metadata: agentMetadata },
    ],
  }),
});
```

### Session load — reads stale status from DB

```typescript
// use-workspace.ts:132-160
const data = await res.json();
const messages = (data.messages ?? []).map((m) => ({
  ...
  proposedUpdates: m.metadata?.proposedUpdates as ProposedUpdate[],
  // ← loads original "pending" status from DB
}));
```

---

## What's Missing

### 1. No DB function to update message metadata

`lib/db/chat-sessions.ts` has:
- `appendMessages()` — insert new messages ✅
- `getSessionMessages()` — read messages ✅
- `updateSessionTitle()` — update session title ✅
- **No `updateMessageMetadata()`** — nothing to update a message's JSONB metadata after creation ❌

### 2. No API route to PATCH a message

`app/api/agent/[runId]/sessions/[sessionId]/messages/route.ts` only exports `POST`. There is no `PATCH` handler to update an existing message.

### 3. No call from accept/reject to any API

Even if the above existed, `acceptProposedUpdate` and `rejectProposedUpdate` don't call any fetch.

---

## Files Involved

| File | Role | Key Lines |
|------|------|-----------|
| `app/dashboard/[runId]/_hooks/use-workspace.ts` | `acceptProposedUpdate` and `rejectProposedUpdate` — update React state only, no persistence | 853-873 (accept), 952-967 (reject) |
| `app/dashboard/[runId]/_hooks/use-workspace.ts` | Message save after SSE — writes initial "pending" status | 798-823 |
| `app/dashboard/[runId]/_hooks/use-workspace.ts` | `loadSession` — reads messages from DB, gets stale status | 132-160 |
| `lib/db/chat-sessions.ts` | DB layer — has `appendMessages` and `getSessionMessages` but no update function | 87-108 (append), 63-85 (get) |
| `lib/db/schema.ts` | `chatMessages` table — `metadata` JSONB column stores proposedUpdates | 179-188 |
| `app/api/agent/[runId]/sessions/[sessionId]/messages/route.ts` | Only `POST` handler, no `PATCH` | 6-30 |
| `app/api/agent/[runId]/sessions/[sessionId]/route.ts` | `GET` handler that loads session + messages for page load | — |
| `app/dashboard/[runId]/_lib/workspace-types.ts` | `ProposedUpdate` type with `status: "pending" \| "accepted" \| "rejected"` | 31-39 |

---

## Fix Approach

Three layers need to be added:

### 1. DB function — `updateMessageMetadata` in `lib/db/chat-sessions.ts`

```typescript
export async function updateMessageMetadata(
  messageId: string,
  metadata: Record<string, unknown>
) {
  await db
    .update(chatMessages)
    .set({ metadata })
    .where(eq(chatMessages.id, messageId));
}
```

### 2. API route — add `PATCH` to `messages/route.ts`

```typescript
export async function PATCH(req, { params }) {
  // auth + ownership check
  const { messageId, metadata } = await req.json();
  await updateMessageMetadata(messageId, metadata);
  return NextResponse.json({ ok: true });
}
```

### 3. Frontend — call API from accept/reject handlers

In both `acceptProposedUpdate` and `rejectProposedUpdate`, after updating React state, persist the change:

```typescript
// After setChatMessages, find the updated message and persist
const updatedMsg = chatMessagesRef.current.find(m => m.id === messageId);
if (updatedMsg && activeSessionIdRef.current) {
  fetch(`/api/agent/${runId}/sessions/${activeSessionIdRef.current}/messages`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messageId: updatedMsg.id,  // DB row ID needed — see note below
      metadata: {
        proposedUpdates: updatedMsg.proposedUpdates,
        // preserve other metadata fields
      },
    }),
  }).catch(() => {});
}
```

### Important note: message ID mapping

The `ChatMessage.id` in React state is a client-generated UUID (line 472: `id: crypto.randomUUID()`). The DB message has its own server-generated UUID. These are **different IDs**. The load path (`loadSession`) does use the DB ID (line 140: `id: m.id`), but messages created during the current session use client IDs until page refresh.

This means either:
- The save endpoint (`POST messages`) should return the DB IDs so the frontend can map them
- Or the frontend should use a separate identifier (like the `proposedUpdate.id`) in the PATCH call
- Or the PATCH should accept the `proposedUpdate.id` directly and update any message containing that update ID (query by JSONB content)
