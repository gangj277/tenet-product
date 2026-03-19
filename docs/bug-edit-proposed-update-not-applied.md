# Bug: Edit-Type Proposed Updates Not Applied Properly

## Symptom

When the agent calls `edit_experiment` or `update_existing_file` (mode: edit), the user sees a proposed update card in chat with Accept/Dismiss buttons. Clicking **Accept** marks the card as "Applied" but the actual content in the viewer **does not reflect the changes**. Refreshing the page also shows the old content — the edit is lost.

This affects both experiment design edits (structured JSON) and markdown file edits (core artifacts like synthesis, claims, etc.).

---

## The Accept Pipeline (How It Should Work)

```
User clicks Accept
  → acceptProposedUpdate()            [use-workspace.ts:853]
    → setChatMessages(status → "accepted")
    → updateContent(key, newContent)   [use-workspace.ts:873]
      → setEditedContents(map.set(key, newContent))   [use-workspace.ts:305]
      → editedRef.current.set(key, newContent)         [use-workspace.ts:310]
      → dirtyKeysRef.current.add(key)                  [use-workspace.ts:313]
      → debounce 2s → flushSave()
        → PATCH /api/init/{runId}/artifacts             [use-workspace.ts:265]
        → setArtifacts(merge edits into artifacts)      [use-workspace.ts:273]

Meanwhile, the viewer reads content via:
  getContent(key)                      [use-workspace.ts:238]
    → editedContents.has(key) ? editedContents.get(key) : getArtifactContent(artifacts, key)

DocumentViewer receives content as a prop from page.tsx:
  content={ws.getContent(ws.activeFileKey)}           [page.tsx:75]
```

### The core logic is correct — so why doesn't it work?

---

## Likely Root Causes (Investigate These)

### 1. `setChatMessages` closure captures stale `appliedUpdate`

In `acceptProposedUpdate` (use-workspace.ts:853-873), the `appliedUpdate` variable is assigned **inside** the `setChatMessages` updater function. The updater runs asynchronously inside React's state update, but the code that uses `appliedUpdate` (line 872: `if (appliedUpdate) { updateContent(...) }`) runs **synchronously after `setChatMessages` is called**, not after the state update completes.

**The question**: Does `appliedUpdate` actually get assigned before line 872 executes? In React 18 with batching, `setChatMessages(fn)` queues the updater — but the updater function `fn` is called synchronously within the same `setChatMessages` call. So `appliedUpdate` _should_ be set. **But verify this at runtime with a console.log/debugger** — if React defers the updater, `appliedUpdate` would be `undefined` and `updateContent` would never be called.

```typescript
// use-workspace.ts:853-873
const acceptProposedUpdate = useCallback(
  (messageId: string, updateId: string) => {
    let appliedUpdate: ProposedUpdate | undefined;

    setChatMessages((prev) =>        // ← updater queued
      prev.map((m) => {
        // ... finds the update ...
        appliedUpdate = pu;           // ← assigned inside updater
        return { ...pu, status: "accepted" };
      })
    );

    // Does this run BEFORE or AFTER the updater above?
    if (appliedUpdate) {              // ← if undefined, nothing happens
      updateContent(appliedUpdate.key, appliedUpdate.content);
    }
  },
  [updateContent]
);
```

**Fix if this is the issue**: Extract the update from the current messages first (via a ref or by reading chatMessages directly), then call `setChatMessages` and `updateContent` independently.

### 2. `getContent` memoization may not re-trigger renders

`getContent` is a `useCallback` that depends on `[artifacts, editedContents]` (use-workspace.ts:246). When `updateContent` is called, it calls `setEditedContents` which creates a new Map, so `editedContents` reference changes and `getContent` should get a new identity.

**But**: `page.tsx` line 75 calls `ws.getContent(ws.activeFileKey)` as a prop to `DocumentViewer`. This means the content string itself needs to change for DocumentViewer to re-render. If `getContent` returns the same string (e.g. because the Map wasn't updated yet when React renders), DocumentViewer won't re-render.

**Verify**: Add a `console.log` in `getContent` when it's called for the edited key after accept. Check if the returned string is the new content or old content.

### 3. `flushSave` succeeds but `setArtifacts` merge is wrong

After `flushSave` PATCHes the server and succeeds, it updates `artifacts` state (use-workspace.ts:273-289). Then `editedContents` still has the entry. Later, if `editedContents` gets cleared or if another state update causes `getContent` to read from `artifacts` instead, the content could revert.

**Check**: Does `editedContents` ever get cleared? Search for `.clear()` or `new Map()` calls on `setEditedContents`.

### 4. Race condition with `activeFileKey` navigation

Our earlier fix (in `acceptProposedUpdate`) added `setActiveFileKey(appliedUpdate.key)` for edit-type updates. If the user is already viewing that file, this is a no-op. But if they're viewing a different file, `setActiveFileKey` triggers a re-render with the new key. At that point, `getContent(newKey)` must return the newly accepted content from `editedContents`.

**Check**: Does the navigation happen, and does `getContent` return the right content at that point?

### 5. Server-side `updateArtifactContents` may silently fail for experiments

In `research-projects.ts:398-406`, the experiment update path does an UPDATE then falls back to INSERT if rowCount === 0. But the UPDATE uses `and(eq(experiments.id, experimentId), eq(experiments.runId, runId))`. If `experimentId` doesn't match (e.g. the key format is wrong), rowCount is 0, and it INSERTs a new row with a new ID — but the original row is unchanged. On next page load, the original row's content is fetched.

**Check**: Log `experimentId` and `runId` in `updateArtifactContents` and verify they match existing DB rows.

---

## Files Involved

| File | Role | Key Lines |
|------|------|-----------|
| `app/dashboard/[runId]/_hooks/use-workspace.ts` | Main workspace state. Contains `acceptProposedUpdate`, `updateContent`, `getContent`, `flushSave`, `autoApplyNewUpdate`, SSE handler. | 238-317 (getContent, updateContent, flushSave), 349-412 (autoApplyNewUpdate), 609-643 (SSE proposed_update), 852-950 (acceptProposedUpdate) |
| `app/dashboard/[runId]/page.tsx` | Wires `ws.getContent(ws.activeFileKey)` as content prop to DocumentViewer. | 75 |
| `app/dashboard/[runId]/_components/document-viewer.tsx` | Renders content. Routes to ExperimentViewer or MarkdownDocumentViewer based on fileType. | 46-93 (routing), 167-174 (TipTap sync) |
| `app/dashboard/[runId]/_components/experiment-viewer.tsx` | Renders structured ExperimentDesign JSON. Parses content prop via `useMemo`. | 33-40 |
| `lib/db/research-projects.ts` | `updateArtifactContents` — persists edits to DB. Experiment path at line 398. | 374-429 |
| `app/api/init/[runId]/artifacts/route.ts` | PATCH handler that calls `updateArtifactContents`. | (check this file) |
| `lib/agent/tools/edit-experiment.ts` | Agent tool that deep-merges experiment edits and emits `proposed_update`. | 10-63 |
| `lib/agent/tools/update-existing-file.ts` | Agent tool for markdown file edits (rewrite or line_edit mode). | 21-129 |
| `lib/agent/state.ts` | `WorkspaceContext` interface — `workspaceFiles` record passed to tools. | 58-65 |
| `app/api/agent/[runId]/chat/route.ts` | Builds `workspaceFiles` from artifacts + editedContents overlay for agent context. | 131-150 |
| `app/dashboard/[runId]/_lib/workspace-types.ts` | `ProposedUpdate`, `FileEntry`, `getArtifactContent` types/helpers. | 31-39, 204-225 |

---

## Debugging Steps

1. **Add console.log in `acceptProposedUpdate`** right after `setChatMessages`:
   ```typescript
   console.log("[accept] appliedUpdate:", appliedUpdate?.key, appliedUpdate?.type, !!appliedUpdate?.content);
   ```
   If `appliedUpdate` is `undefined`, that's the bug — the setState updater hasn't run yet.

2. **Add console.log in `updateContent`**:
   ```typescript
   console.log("[updateContent]", key, "content length:", md.length);
   ```
   Verify it's called with the right key and non-empty content.

3. **Add console.log in `getContent`** for experiment/core keys:
   ```typescript
   console.log("[getContent]", key, "from edited:", editedContents.has(key), "length:", result.length);
   ```
   Verify that after accept, the next render returns the new content.

4. **Check the network tab** for the PATCH to `/api/init/{runId}/artifacts`. Verify:
   - It fires ~2s after accept
   - Request body contains the right key and full merged content
   - Response is 200

5. **Refresh the page after accepting** — if content reverts, the PATCH either didn't fire or the server didn't persist correctly. Check DB directly.

---

## Context: What We Already Fixed (May Not Be Sufficient)

- Added `fileType: "experiment-design"` to experiment FileEntry in `autoApplyNewUpdate` and `acceptProposedUpdate` new-experiment blocks
- Added `setActiveFileKey` navigation and sidebar label update for edit-type accepts
- Added title extraction from experiment JSON in `updateArtifactContents`
- Added `lastSyncedContentRef` in MarkdownDocumentViewer to exit edit mode on external content change
- Created diff view components (`LineDiffView`, `ExperimentDiffView`)
- Threaded `getContent` to ProposedUpdateCard for diff previews

These fixes address secondary symptoms but the primary issue — **content not actually updating in the viewer after accept** — persists and likely requires one of the root cause fixes described above.
