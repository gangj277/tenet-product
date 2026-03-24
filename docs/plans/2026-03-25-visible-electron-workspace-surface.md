# Visible Electron Workspace Surface Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Electron-local workspaces visibly browsable in Finder and openable in IDEs without breaking the current local filesystem storage model.

**Architecture:** Keep `.lumen` as the canonical hidden storage root for project state, artifacts, chat, and metadata. Add a visible `lumen/` projection inside the user-selected workspace folder that exposes user-facing files and folders through stable directory aliases, and make Electron file-opening prefer those visible paths. Existing `.lumen`-only workspaces must auto-project into the visible surface without data migration.

**Tech Stack:** TypeScript, Next.js route handlers, Electron IPC, Node.js filesystem APIs, node:test

---

### Task 1: Define the visible workspace surface behavior

**Files:**
- Create: `docs/plans/2026-03-25-visible-electron-workspace-surface.md`
- Modify: `lib/storage/fs-adapter.ts`
- Test: `tests/storage-adapter.test.tsx`

**Step 1: Write the failing test**

Add tests asserting that a workspace-backed Electron project creates a visible `lumen/` folder containing user-facing paths such as `artifacts/overview.md`, `notes/`, `papers/`, `experiments/`, and `sources/`, while canonical storage remains in `.lumen/`.

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/storage-adapter.test.tsx`
Expected: FAIL because the visible `lumen/` workspace surface does not exist yet.

**Step 3: Write minimal implementation**

Add helper functions in `lib/storage/fs-adapter.ts` to:
- define `workspaceVisibleDir(workspacePath)`
- create/update visible directory aliases inside `lumen/`
- ensure the visible surface exists for workspace-backed projects

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/storage-adapter.test.tsx`
Expected: PASS for the new visible-surface assertions.

### Task 2: Preserve legacy `.lumen` workspaces

**Files:**
- Modify: `lib/storage/fs-adapter.ts`
- Test: `tests/storage-adapter.test.tsx`

**Step 1: Write the failing test**

Add a test that simulates an existing workspace with only `.lumen/` data and asserts that opening the adapter auto-creates the visible `lumen/` surface without moving or corrupting the canonical files.

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/storage-adapter.test.tsx`
Expected: FAIL because existing workspaces are not projected into a visible surface.

**Step 3: Write minimal implementation**

Update `lib/storage/fs-adapter.ts` to ensure the visible surface is projected whenever a workspace-backed project is prepared or accessed.

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/storage-adapter.test.tsx`
Expected: PASS for the legacy compatibility case.

### Task 3: Resolve local file paths to visible workspace files

**Files:**
- Modify: `lib/storage/fs-adapter.ts`
- Modify: `app/api/init/[runId]/local-file/route.ts`
- Test: `tests/storage-adapter.test.tsx`
- Test: `tests/local-workspace-file-route.test.tsx`

**Step 1: Write the failing test**

Update path-resolution tests so `getLocalWorkspaceFilePath()` returns visible paths inside `workspace/lumen/...` instead of hidden `.lumen/...`.

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/storage-adapter.test.tsx tests/local-workspace-file-route.test.tsx`
Expected: FAIL because local file resolution still points at hidden paths.

**Step 3: Write minimal implementation**

Adjust `getLocalWorkspaceFilePath()` to prefer visible paths for workspace-backed projects and keep hidden canonical paths only as fallback for non-workspace storage.

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/storage-adapter.test.tsx tests/local-workspace-file-route.test.tsx`
Expected: PASS.

### Task 4: Keep Electron open-in-IDE behavior aligned

**Files:**
- Modify: `app/dashboard/[runId]/_components/viewer/open-in-ide-button.tsx`
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Modify: `types/electron-api.d.ts`
- Test: `tests/local-workspace-file-route.test.tsx`

**Step 1: Write the failing test**

Extend route-level expectations as needed so the button’s lookup path resolves to the visible workspace surface.

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/local-workspace-file-route.test.tsx`
Expected: FAIL if the route or open path assumptions are still hidden-path based.

**Step 3: Write minimal implementation**

Keep the current Electron IPC shape, but ensure the renderer requests and opens the visible workspace path.

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/local-workspace-file-route.test.tsx`
Expected: PASS.

### Task 5: Verify the full change safely

**Files:**
- Test: `tests/storage-adapter.test.tsx`
- Test: `tests/local-workspace-file-route.test.tsx`
- Test: `tests/project-route-persistence.test.tsx`
- Verify: `electron/main.ts`
- Verify: `app/dashboard/[runId]/_components/viewer/open-in-ide-button.tsx`

**Step 1: Run focused tests**

Run: `node --import tsx --test tests/storage-adapter.test.tsx tests/local-workspace-file-route.test.tsx tests/project-route-persistence.test.tsx`
Expected: PASS.

**Step 2: Run Electron compile**

Run: `npm run electron:compile`
Expected: PASS.

**Step 3: Run app build**

Run: `npm run build`
Expected: PASS.

**Step 4: Run broader regression check**

Run: `npm test`
Expected: Only the same pre-existing unrelated failures, if any, remain.
