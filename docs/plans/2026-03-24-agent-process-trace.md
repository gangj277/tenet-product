# Agent Process Trace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show a fluent, user-readable timeline of the agent's actual work in the right chat sidebar while each response is streaming and after it completes.

**Architecture:** Add a structured `processTrace` array to each agent chat message, derive entries from existing SSE `tool_call` and selected `activity` events in `useWorkspace`, persist that metadata with the rest of the agent message, and render it with a dedicated message card in the agent bubble. Keep the trace model pure and testable so streaming-state changes do not stay embedded in the hook.

**Tech Stack:** Next.js App Router, React 19, TypeScript, node:test, server-rendered React component tests.

---

### Task 1: Define the process trace model

**Files:**
- Create: `app/dashboard/[runId]/_lib/agent-process-trace.ts`
- Modify: `app/dashboard/[runId]/_lib/workspace-types.ts`
- Test: `tests/agent-process-trace.test.tsx`

**Step 1: Write the failing test**

Cover:
- human-readable summaries for `read_workspace_files`, `search_workspace`, and `update_existing_file`
- activity-phase handling for non-tool progress like `Composing response`
- lifecycle transitions from active -> completed/error

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/agent-process-trace.test.tsx`
Expected: FAIL because the trace utility module and types do not exist yet.

**Step 3: Write minimal implementation**

Add:
- `AgentProcessStep` type with `id`, `kind`, `label`, `detail`, `status`, optional `toolName`
- pure helpers to summarize tool calls, add steps, complete the active step, and mark failures

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/agent-process-trace.test.tsx`
Expected: PASS

### Task 2: Render the trace in the agent bubble

**Files:**
- Create: `app/dashboard/[runId]/_components/chat/message/process-trace-card.tsx`
- Modify: `app/dashboard/[runId]/_components/chat/message/agent-bubble.tsx`
- Test: `tests/agent-bubble-process-trace.test.tsx`

**Step 1: Write the failing test**

Cover:
- `AgentBubble` renders the process trace card when `message.processTrace` exists
- rendered output includes a compact “Agent Work” section and the human-readable step labels/details

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/agent-bubble-process-trace.test.tsx`
Expected: FAIL because no trace card is rendered yet.

**Step 3: Write minimal implementation**

Add a compact timeline card that:
- shows completed vs active steps clearly
- keeps the current active step visually emphasized
- fits existing sidebar card styling

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/agent-bubble-process-trace.test.tsx`
Expected: PASS

### Task 3: Feed live SSE events into the trace and persist them

**Files:**
- Modify: `app/dashboard/[runId]/_hooks/use-workspace.ts`
- Modify: `app/dashboard/[runId]/_lib/workspace-types.ts`
- Test: `tests/chat-session-messages-route.test.tsx`

**Step 1: Write the failing test**

Cover:
- persisted metadata accepts `processTrace`
- load/save chat message metadata shape includes `processTrace`

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/chat-session-messages-route.test.tsx`
Expected: FAIL after adding the new expectations because `processTrace` is not carried through yet.

**Step 3: Write minimal implementation**

Update the hook so that:
- `tool_call` appends a readable active step
- selected `activity` events update or append a readable phase
- `done` and `error` finalize the active step
- `processTrace` is included when persisting and hydrating session metadata

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/chat-session-messages-route.test.tsx`
Expected: PASS

### Task 4: Verify the feature end-to-end at the targeted level

**Files:**
- Verify only

**Step 1: Run focused tests**

Run: `npm test -- tests/agent-process-trace.test.tsx tests/agent-bubble-process-trace.test.tsx tests/chat-session-messages-route.test.tsx`
Expected: PASS with 0 failures

**Step 2: Run broader relevant regression tests**

Run: `npm test -- tests/proposed-update-navigation.test.tsx tests/chat-reasoning-effort.test.tsx`
Expected: PASS with 0 failures

**Step 3: Manual sanity review**

Check:
- trace entries read like user-facing process, not raw tool jargon
- current active step stays legible during streaming
- completed messages still show their trace after refresh because metadata persists
