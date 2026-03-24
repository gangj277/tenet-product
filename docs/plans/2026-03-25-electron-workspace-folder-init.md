# Electron Workspace Folder Init Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Require Electron local-mode project creation to initialize each workspace inside a user-chosen folder.

**Architecture:** Electron exposes a native folder picker through preload IPC. The dashboard new-project flow requests a folder before calling the existing project-init APIs. In Electron mode, those APIs require a `workspacePath` and pass it into the filesystem adapter, which stores project state inside a `.lumen` directory in the selected folder while preserving the internal project index for lookup and migration safety.

**Tech Stack:** Next.js app routes, Electron IPC/preload, TypeScript, filesystem storage adapter, Node test runner.

---

### Task 1: Define the failing backend behavior

**Files:**
- Modify: `tests/project-route-persistence.test.tsx`
- Modify: `tests/storage-adapter.test.tsx`

**Step 1: Write the failing tests**

- Add an Electron-mode route test asserting `POST /api/projects` rejects requests without `workspacePath`.
- Add an Electron-mode route test asserting `POST /api/projects` forwards `workspacePath` to storage.
- Add an Electron-mode route test asserting `POST /api/init` rejects requests without `workspacePath`.
- Add a filesystem adapter test asserting a workspace created with `workspacePath` writes project files into `<workspacePath>/.lumen`.
- Add a filesystem adapter test asserting deleting that project removes `.lumen` but not the chosen parent folder.

**Step 2: Run tests to verify they fail**

Run:
```bash
node --import tsx --test tests/project-route-persistence.test.tsx tests/storage-adapter.test.tsx
```

Expected:
- New Electron workspace-path tests fail because routes currently accept empty payloads in Electron mode.
- New filesystem adapter workspace-root tests fail because the adapter currently stores everything only under `LUMEN_DATA_DIR/projects/<projectId>`.

### Task 2: Add storage contract support for chosen workspace folders

**Files:**
- Modify: `lib/storage/adapter.ts`
- Modify: `lib/storage/postgres-adapter.ts`
- Modify: `lib/storage/fs-adapter.ts`
- Modify: `lib/storage/project-types.ts`

**Step 1: Extend the storage contract**

- Add optional `workspacePath?: string` to `createResearchProjectRun` and `createDraftWorkspaceProjectRun`.
- Keep the Postgres adapter signature-compatible but ignore `workspacePath`.

**Step 2: Implement filesystem workspace-root initialization**

- Persist `workspacePath` metadata in the filesystem project index.
- When `workspacePath` is provided, initialize storage under `<workspacePath>/.lumen`.
- Link the internal project lookup directory to that storage root so existing path helpers continue to work.
- Reject duplicate initialization of the same workspace folder.
- On delete, remove `.lumen` and the internal link while leaving the user-selected parent folder intact.

**Step 3: Run focused tests**

Run:
```bash
node --import tsx --test tests/project-route-persistence.test.tsx tests/storage-adapter.test.tsx
```

Expected:
- Backend behavior tests pass.

### Task 3: Enforce Electron route requirements

**Files:**
- Modify: `app/api/projects/route.ts`
- Modify: `app/api/init/route.ts`

**Step 1: Parse and validate `workspacePath`**

- Accept `workspacePath` in both route bodies.
- In Electron mode, return `400` when it is missing or blank.
- Pass it through to storage creation methods.

**Step 2: Run route tests**

Run:
```bash
node --import tsx --test tests/project-route-persistence.test.tsx
```

Expected:
- Electron-specific route tests pass.

### Task 4: Add the Electron folder picker

**Files:**
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Modify: `types/electron-api.d.ts`

**Step 1: Expose a native folder chooser**

- Add an IPC handler that opens `dialog.showOpenDialog` with `openDirectory`.
- Return a stable payload like `{ canceled: boolean, path: string | null }`.
- Expose it on `window.electronAPI`.

**Step 2: Verify Electron compile**

Run:
```bash
npm run electron:compile
```

Expected:
- Electron TypeScript compile passes.

### Task 5: Wire the new-project UI to the native picker

**Files:**
- Modify: `app/dashboard/new/page.tsx`

**Step 1: Add local-mode folder selection flow**

- Before blank-workspace creation or research init in Electron mode, call `window.electronAPI.chooseWorkspaceFolder()`.
- Abort cleanly when the chooser is canceled.
- Show a clear inline error when folder selection fails.

**Step 2: Pass `workspacePath` to the API**

- Include the selected folder path in `POST /api/projects` and `POST /api/init`.

**Step 3: Run focused verification**

Run:
```bash
node --import tsx --test tests/project-route-persistence.test.tsx tests/storage-adapter.test.tsx
npm run electron:compile
npm run build
```

Expected:
- Tests and builds pass.

### Task 6: Manual Electron verification

**Files:**
- None

**Step 1: Launch Electron**

Run:
```bash
npm run electron:dev
```

**Step 2: Verify behavior**

- Creating a blank workspace prompts for a folder.
- Starting research from a question also prompts for a folder.
- Canceling the picker leaves the user on `/dashboard/new` without creating a project.
- Accepting the picker creates `<chosen-folder>/.lumen`.
- Quitting and relaunching preserves the workspace.
- Deleting the project removes `<chosen-folder>/.lumen` but not the chosen parent folder.
