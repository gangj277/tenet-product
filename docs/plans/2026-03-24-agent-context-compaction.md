# Agent Context Compaction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automatic and manual context compaction to the research agent while preserving continuation state across turns and exposing live usage in the chat header.

**Architecture:** A shared compaction service in `lib/agent` will estimate prompt size, synthesize a versioned compaction snapshot, and optionally return a compacted message set for the current loop. The client will persist that snapshot in message metadata, rebuild future `conversationHistory` from `snapshot + raw tail`, and expose a header ring plus `/compact` command that use the same state model.

**Tech Stack:** Next.js app routes, React hooks/components, Node test runner, OpenAI auth provider, custom ReAct loop.

---

### Task 1: Add failing metadata and request-builder tests

**Files:**
- Modify: `tests/chat-message-metadata.test.tsx`
- Create: `tests/chat-context-state.test.tsx`
- Modify: `app/dashboard/[runId]/_lib/chat-message-metadata.ts`
- Create: `app/dashboard/[runId]/_lib/chat-context-state.ts`

**Step 1: Write the failing test**
- Add round-trip coverage for `activatedSkills` and `compactionSnapshot`.
- Add request-history coverage for `synthetic compact memory + raw tail`.

**Step 2: Run test to verify it fails**
- Run: `npm test -- tests/chat-message-metadata.test.tsx tests/chat-context-state.test.tsx`

**Step 3: Write minimal implementation**
- Add shared compaction metadata types and request-history helpers.

**Step 4: Run test to verify it passes**
- Run: `npm test -- tests/chat-message-metadata.test.tsx tests/chat-context-state.test.tsx`

### Task 2: Add failing runtime compaction tests

**Files:**
- Create: `tests/agent-compaction.test.tsx`
- Create: `lib/agent/compaction.ts`
- Modify: `lib/agent/state.ts`
- Modify: `lib/agent/graph.ts`

**Step 1: Write the failing test**
- Cover token estimation, history compaction snapshot generation, turn compaction protected suffixes, and compaction SSE emission.

**Step 2: Run test to verify it fails**
- Run: `npm test -- tests/agent-compaction.test.tsx`

**Step 3: Write minimal implementation**
- Build the compaction service and wire the pre-call gate into the agent loop.

**Step 4: Run test to verify it passes**
- Run: `npm test -- tests/agent-compaction.test.tsx`

### Task 3: Add failing route tests for `/compact` and chat payload propagation

**Files:**
- Create: `tests/chat-session-compact-route.test.tsx`
- Modify: `tests/chat-reasoning-effort.test.tsx`
- Create: `app/api/agent/[runId]/sessions/[sessionId]/compact/route.ts`
- Modify: `app/api/agent/[runId]/chat/route.ts`

**Step 1: Write the failing test**
- Cover auth/ownership for the compact route, appended status message, and propagation of `agentState`/`historyVisibleMessageCount` into `runAgentLoop`.

**Step 2: Run test to verify it fails**
- Run: `npm test -- tests/chat-session-compact-route.test.tsx tests/chat-reasoning-effort.test.tsx`

**Step 3: Write minimal implementation**
- Add the new route and extend the chat route payload handling.

**Step 4: Run test to verify it passes**
- Run: `npm test -- tests/chat-session-compact-route.test.tsx tests/chat-reasoning-effort.test.tsx`

### Task 4: Add failing UI tests for the header ring and manual `/compact`

**Files:**
- Create: `tests/chat-header-usage-indicator.test.tsx`
- Modify: `app/dashboard/[runId]/_components/chat/agent-chat.tsx`
- Modify: `app/dashboard/[runId]/_components/chat/chat-composer.tsx`
- Modify: `app/dashboard/[runId]/_hooks/use-workspace.ts`
- Modify: `app/dashboard/[runId]/page.tsx`

**Step 1: Write the failing test**
- Cover ring rendering states and `/compact` interception semantics.

**Step 2: Run test to verify it fails**
- Run: `npm test -- tests/chat-header-usage-indicator.test.tsx`

**Step 3: Write minimal implementation**
- Add the indicator UI and manual compaction flow.

**Step 4: Run test to verify it passes**
- Run: `npm test -- tests/chat-header-usage-indicator.test.tsx`

### Task 5: Final verification

**Files:**
- Verify touched files only

**Step 1: Run targeted test suite**
- Run: `npm test -- tests/chat-message-metadata.test.tsx tests/chat-context-state.test.tsx tests/agent-compaction.test.tsx tests/chat-session-compact-route.test.tsx tests/chat-reasoning-effort.test.tsx tests/chat-header-usage-indicator.test.tsx`

**Step 2: Run lint/type checks if fast enough**
- Run: project-appropriate targeted checks for touched files.

**Step 3: Review diff**
- Confirm unrelated dirty files are untouched.
