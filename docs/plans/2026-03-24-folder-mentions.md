# Folder Mentions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let chat users mention folders as well as files so the agent can read folder-scoped workspace context and place new notes into a mentioned folder.

**Architecture:** Lift folder paths into shared workspace state so the sidebar and chat composer use the same folder list, including empty note folders created in the current session. Extend mention chips to serialize canonical file and folder tokens, pass folder paths into agent context, expose folder structure in the system prompt, and carry folder metadata through new-note proposals so accepted agent-created notes land in the intended folder.

**Tech Stack:** Next.js app routes, React hooks/components, Node test runner, custom agent tool layer.

---

### Task 1: Add failing mention serialization and agent-context tests

**Files:**
- Create: `tests/chat-mentions.test.tsx`
- Modify: `tests/chat-reasoning-effort.test.tsx`
- Create: `tests/agent-folder-context.test.tsx`

**Step 1: Write the failing test**
- Assert mention chips serialize canonical file keys instead of display labels.
- Assert folder chips serialize folder mention tokens and make the editor non-empty.
- Assert the chat route forwards folder paths into `runAgentLoop`.
- Assert `write_new_file` and the system prompt preserve folder context.

**Step 2: Run test to verify it fails**
- Run: `npm test -- tests/chat-mentions.test.tsx tests/chat-reasoning-effort.test.tsx tests/agent-folder-context.test.tsx`

**Step 3: Write minimal implementation**
- Update serializer expectations, route payload handling, and agent tool/prompt types.

**Step 4: Run test to verify it passes**
- Run: `npm test -- tests/chat-mentions.test.tsx tests/chat-reasoning-effort.test.tsx tests/agent-folder-context.test.tsx`

### Task 2: Lift shared folder state and add mention entries

**Files:**
- Modify: `app/dashboard/[runId]/_hooks/use-workspace.ts`
- Modify: `app/dashboard/[runId]/page.tsx`
- Modify: `app/dashboard/[runId]/_components/sidebar/file-sidebar.tsx`
- Modify: `app/dashboard/[runId]/_components/chat/chat-composer.tsx`
- Modify: `app/dashboard/[runId]/_components/chat/file-mention-picker.tsx`
- Modify: `app/dashboard/[runId]/_components/chat/composer/composer-chips.ts`
- Modify: `app/dashboard/[runId]/_components/chat/composer/composer-serializer.ts`
- Create: `app/dashboard/[runId]/_components/chat/composer/mention-utils.ts`

**Step 1: Write the minimal state flow**
- Store shared folder paths in `useWorkspace`.
- Feed folder paths to the sidebar and chat composer.
- Replace sidebar-local empty-folder state with the shared folder list.

**Step 2: Implement mention entry support**
- Build mixed file/folder mention entries from workspace files and shared folder paths.
- Render folders in the mention picker with a folder badge/icon.
- Serialize chips to canonical tokens such as `@overview` and `@folder:"Research/Methods"`.

**Step 3: Run focused tests**
- Run: `npm test -- tests/chat-mentions.test.tsx`

### Task 3: Make folder mentions actionable for the agent and accepted note creation

**Files:**
- Modify: `lib/agent/state.ts`
- Modify: `lib/agent/prompts/constitution.ts`
- Modify: `app/api/agent/[runId]/chat/route.ts`
- Modify: `lib/agent/tools/write-new-file.ts`
- Modify: `lib/agent/tools/tool-schemas.ts`
- Modify: `lib/agent/tools/tool-dispatcher.ts`
- Modify: `app/dashboard/[runId]/_hooks/use-workspace.ts`

**Step 1: Extend agent context**
- Add explicit `folderPaths` to `WorkspaceContext`.
- Include a folder map and folder mention rules in the system prompt.

**Step 2: Extend new note proposals**
- Allow `write_new_file` to accept an optional `folder`.
- Preserve folder metadata in proposed updates.
- When a new note proposal is auto-applied or accepted, persist label/folder/content via the notes API and update the shared folder list.

**Step 3: Run focused tests**
- Run: `npm test -- tests/chat-reasoning-effort.test.tsx tests/agent-folder-context.test.tsx`

### Task 4: Final verification

**Files:**
- Verify touched files only

**Step 1: Run targeted suite**
- Run: `npm test -- tests/chat-mentions.test.tsx tests/chat-reasoning-effort.test.tsx tests/agent-folder-context.test.tsx`

**Step 2: Run lint if the touched surface is clean enough**
- Run: `npm run lint -- app/dashboard/[runId]/_components/chat/chat-composer.tsx app/dashboard/[runId]/_components/chat/file-mention-picker.tsx app/dashboard/[runId]/_components/chat/composer/composer-chips.ts app/dashboard/[runId]/_components/chat/composer/composer-serializer.ts app/dashboard/[runId]/_hooks/use-workspace.ts app/dashboard/[runId]/page.tsx app/dashboard/[runId]/_components/sidebar/file-sidebar.tsx lib/agent/state.ts lib/agent/prompts/constitution.ts lib/agent/tools/write-new-file.ts lib/agent/tools/tool-schemas.ts lib/agent/tools/tool-dispatcher.ts app/api/agent/[runId]/chat/route.ts tests/chat-mentions.test.tsx tests/chat-reasoning-effort.test.tsx tests/agent-folder-context.test.tsx`

**Step 3: Review diff**
- Confirm unrelated workspace changes are untouched.
