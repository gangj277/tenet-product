# Bug: `memoryStore.cancelPendingQuestion is not a function`

## Error

```
⨯ Error: failed to pipe response
  [cause]: TypeError: memoryStore.cancelPendingQuestion is not a function
    at Object.start (app/api/agent/[runId]/chat/route.ts:203:21)

  201 |       } finally {
  202 |         // Clean up any pending ask_user question (e.g. if stream was aborted)
> 203 |         memoryStore.cancelPendingQuestion(runId);
  204 |         const costAfter = costTracker.snapshot().totalCostUsd;
  205 |         recordUserCost(session.userId, costAfter - costBefore);
  206 |         controller.close();

POST /api/agent/{runId}/chat 500
```

Occurs frequently during agent chat interactions.

---

## What's Happening

The `finally` block of the SSE `ReadableStream` (chat route line 201-207) calls `memoryStore.cancelPendingQuestion(runId)` to clean up any pending `ask_user` question when the stream ends. The call crashes because `cancelPendingQuestion` is `undefined` on the imported `memoryStore` object.

**The function definitely exists** in `lib/storage/memory-store.ts` at line 162. It's part of the object literal returned by `createMemoryStore()`. And the same function is successfully called from `lib/agent/graph.ts:198`.

---

## Root Cause: Turbopack Module Staleness

The error message includes `__TURBOPACK__imported__module__...__.memoryStore.cancelPendingQuestion`, which means this is a **Turbopack (Next.js dev bundler) module resolution issue** — not a code logic bug.

The `memoryStore` singleton uses the `globalThis` caching pattern to survive hot-reloads:

```typescript
// lib/storage/memory-store.ts:182-188
const globalForMemoryStore = globalThis as typeof globalThis & {
  __lumenMemoryStore?: MemoryStore;
};

export const memoryStore =
  globalForMemoryStore.__lumenMemoryStore ??
  (globalForMemoryStore.__lumenMemoryStore = createMemoryStore());
```

### Why it breaks

When Turbopack hot-reloads `memory-store.ts`, the **old** `memoryStore` instance (already cached on `globalThis.__lumenMemoryStore`) is reused. But if `createMemoryStore()` was updated (or the module shape changed between reloads), the cached instance may be from an **older version** of `createMemoryStore` that didn't have `cancelPendingQuestion`.

This happens when:
1. A prior dev session cached a `memoryStore` on `globalThis` before `cancelPendingQuestion` was added
2. Turbopack partially reloads modules but `globalThis.__lumenMemoryStore` still holds the stale instance
3. The chat route imports the module, gets the stale object, and the method doesn't exist

This explains why it's **intermittent** — it depends on whether the dev server has been restarted since the function was added, and whether Turbopack's cache is stale.

---

## Files Involved

| File | Role |
|------|------|
| `lib/storage/memory-store.ts` | Defines `createMemoryStore()` and the `globalThis`-cached singleton. `cancelPendingQuestion` is at line 162. |
| `app/api/agent/[runId]/chat/route.ts` | SSE stream handler. Calls `memoryStore.cancelPendingQuestion(runId)` in the `finally` block at line 203. |
| `lib/agent/graph.ts` | Also calls `memoryStore.cancelPendingQuestion` at line 198 (inside ask_user timeout catch). |

---

## Fixes

### Quick fix: Restart dev server
```bash
# Kill and restart the Next.js dev server to clear globalThis cache
```
This clears `globalThis.__lumenMemoryStore` and forces `createMemoryStore()` to run fresh.

### Defensive fix: Guard the call
Add a safety check at the call site so a stale singleton doesn't crash the entire SSE stream:

```typescript
// app/api/agent/[runId]/chat/route.ts:203
if (typeof memoryStore.cancelPendingQuestion === "function") {
  memoryStore.cancelPendingQuestion(runId);
}
```

### Proper fix: Invalidate stale singleton on shape change
Force the singleton to rebuild if the shape has changed:

```typescript
// lib/storage/memory-store.ts — replace the singleton pattern
const STORE_VERSION = 2; // bump when adding/removing methods

const globalForMemoryStore = globalThis as typeof globalThis & {
  __lumenMemoryStore?: MemoryStore;
  __lumenMemoryStoreVersion?: number;
};

export const memoryStore = (() => {
  if (
    globalForMemoryStore.__lumenMemoryStore &&
    globalForMemoryStore.__lumenMemoryStoreVersion === STORE_VERSION
  ) {
    return globalForMemoryStore.__lumenMemoryStore;
  }
  const store = createMemoryStore();
  globalForMemoryStore.__lumenMemoryStore = store;
  globalForMemoryStore.__lumenMemoryStoreVersion = STORE_VERSION;
  return store;
})();
```

This way, adding a new method and bumping `STORE_VERSION` forces all dev instances to get a fresh store.

---

## Impact

When this error fires, the **entire chat POST returns 500**. The user sees no agent response. The SSE stream fails to pipe. Pending ask_user questions are never cleaned up (potential memory leak / stuck state for the run).

**Production risk**: Low — production builds don't use Turbopack and `globalThis` caching works correctly with a stable bundle. But it severely disrupts the dev experience.
