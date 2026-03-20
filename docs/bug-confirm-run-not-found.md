# Bug: "Run not found" on Confirm After Research Brief

**Scope**: This is strictly a runtime state-persistence bug. No UI, functionality, or capability changes needed.

---

## Symptom

User submits a research question at `/dashboard/new`. The pipeline runs, infers a perspective, and presents the research brief for review. User clicks **"Looks good — start analysis"**. The confirm `POST /api/init/[runId]/confirm` returns `404 — Run not found`.

## Root Cause

Two separate in-memory singletons hold critical state:

1. **`memoryStore`** (`lib/storage/memory-store.ts`) — a module-level `Map<string, RunEntry>` that stores run metadata (status, projectId, artifacts).
2. **`MemorySaver`** (`lib/engine/graph.ts`) — LangGraph's in-memory checkpointer that stores the graph's execution state (needed to resume after `interrupt()`).

Both are plain JavaScript module-scope variables with no `globalThis` caching. In Next.js dev mode, modules can be re-evaluated on hot-reload or across API route compilations. When this happens, one or both Maps are reset to empty, so:

- The confirm endpoint calls `memoryStore.getRun(runId)` → returns `undefined` → 404.
- Even if the run entry survived, `initGraph.invoke(new Command({ resume }), config)` would fail because the `MemorySaver` lost the checkpointed graph state for that `thread_id`.

### Why It Happens in Dev but Would Also Happen in Prod

- **Dev**: Next.js re-evaluates modules on file changes. Any edit to any file can wipe both Maps.
- **Prod**: A single process restart, or running multiple instances behind a load balancer, would have the same effect. These Maps are not durable.

## Affected Files

| File | What it holds | Problem |
|------|--------------|---------|
| `lib/storage/memory-store.ts` | `runs`, `artifacts`, `uploadedFiles`, `progress` Maps | Module-scope Maps lost on re-evaluation |
| `lib/engine/graph.ts` | `MemorySaver` (LangGraph checkpointer) | Module-scope checkpointer lost on re-evaluation |
| `app/api/init/route.ts` | Writes to both stores on init | Data written here disappears before confirm |
| `app/api/init/[runId]/confirm/route.ts` | Reads from both stores on confirm | Reads stale/empty state → 404 |

## Fix Options

### Option A: `globalThis` Caching (Quick Fix for Dev)

Cache both singletons on `globalThis` so they survive Next.js module re-evaluation in dev mode. This is the standard Next.js pattern (same as how `PrismaClient` / Drizzle connections are cached).

```typescript
// lib/storage/memory-store.ts
const globalStore = globalThis as unknown as { __memoryStore?: typeof memoryStore };
export const memoryStore = globalStore.__memoryStore ??= createMemoryStore();

// lib/engine/graph.ts
const globalGraph = globalThis as unknown as { __initGraph?: CompiledGraph };
export const initGraph = globalGraph.__initGraph ??= buildInitGraph();
```

**Pros**: 5-minute fix, solves dev-mode issue immediately.
**Cons**: Still in-memory — won't survive process restarts or multi-instance prod.

### Option B: Durable Checkpointer + DB Runs (Production Fix)

Replace both in-memory stores with persistent backends:

1. Replace `MemorySaver` with `@langchain/langgraph-checkpoint-postgres` — LangGraph's official PostgreSQL checkpointer. We already have a PostgreSQL database (`lumen_dev`) with Drizzle set up.
2. Replace `memoryStore` run/artifact tracking with actual DB writes to the existing `runs`, `artifacts`, `projects` tables in `lib/db/schema.ts` (these tables already exist but are unused by the engine).

**Pros**: Fully durable, production-ready, uses existing DB infrastructure.
**Cons**: More work — need to wire engine nodes to write to DB instead of Maps.

### Option C: A then B (Recommended)

Ship Option A now to unblock development. Then migrate to Option B as a separate task when wiring the engine to the database.

## Reproduction Steps

1. `npm run dev`
2. Go to `/dashboard/new`, submit a research question
3. Wait for the research brief to appear
4. Edit any file in the codebase (triggers hot-reload), OR just wait — sometimes the module re-evaluates on its own
5. Click "Looks good — start analysis"
6. Observe: `POST /api/init/[runId]/confirm` → 404 "Run not found"
