# Remove Exa Entirely Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove Exa from the entire repo by migrating the remaining chat-side external search flow and shared discovery types to the unified scholarly engine.

**Architecture:** Reuse `discoverScholarlySources` as the only academic discovery backend, export a single shared discovered-source type from that module, and update agent/UI consumers to import that type directly. Once the chat tool is migrated and covered by tests, delete the Exa module, remove the `exa-js` dependency, and drop the Next.js external-package entry.

**Tech Stack:** TypeScript, Node test runner, existing scholarly discovery adapters, Next.js config

---

### Task 1: Lock the chat-side migration

**Files:**
- Create: `tests/search-external-sources.test.tsx`
- Modify: `lib/agent/tools/search-external-sources.ts`

**Step 1: Write the failing test**

```typescript
test("executeSearchExternalSources uses unified scholarly discovery instead of Exa", async () => {
  // Patch scholarly-search to succeed and Exa to throw.
});
```

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/search-external-sources.test.tsx`
Expected: FAIL because the tool still imports Exa.

**Step 3: Write minimal implementation**

```typescript
import { discoverScholarlySources } from "@/lib/discovery/scholarly-search";
// Keep return shape unchanged for the UI.
```

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/search-external-sources.test.tsx`
Expected: PASS

### Task 2: Migrate shared discovery type imports

**Files:**
- Modify: `lib/agent/state.ts`
- Modify: `lib/agent/tools/index.ts`
- Modify: `app/dashboard/[runId]/_hooks/use-workspace.ts`
- Modify: `app/dashboard/[runId]/_lib/workspace-types.ts`
- Modify: `app/dashboard/[runId]/_components/chat-message.tsx`

**Step 1: Update imports**

```typescript
import type { DiscoveredSource } from "@/lib/discovery/scholarly-search";
```

**Step 2: Run existing tests/lint**

Run: `npm run lint -- ...`
Expected: PASS

### Task 3: Remove Exa code and dependency

**Files:**
- Delete: `lib/discovery/exa.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `next.config.ts`

**Step 1: Remove package/config references**

Run: `npm uninstall exa-js`
Expected: package files updated

**Step 2: Delete obsolete module**

Run: N/A (use patch)

**Step 3: Verify no references remain**

Run: `rg -n "exa-js|EXA_API_KEY|/discovery/exa|discoverSources\\(" . -S`
Expected: no runtime references remain

### Task 4: Verify full removal

**Files:**
- None, verification only

**Step 1: Run targeted tests**

Run: `node --import tsx --test tests/search-external-sources.test.tsx tests/scholarly-search.test.tsx tests/parsing-resilience.test.tsx`
Expected: PASS

**Step 2: Run lint on changed files**

Run: `npm run lint -- tests/search-external-sources.test.tsx lib/agent/tools/search-external-sources.ts lib/agent/state.ts lib/agent/tools/index.ts app/dashboard/[runId]/_hooks/use-workspace.ts app/dashboard/[runId]/_lib/workspace-types.ts app/dashboard/[runId]/_components/chat-message.tsx lib/discovery/scholarly-search.ts next.config.ts`
Expected: PASS

**Step 3: Confirm Exa is gone**

Run: `rg -n "exa-js|EXA_API_KEY|/discovery/exa|discoverSources\\(" . -S`
Expected: no matches except historical plan docs if any
