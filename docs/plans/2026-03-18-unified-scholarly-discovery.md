# Unified Scholarly Discovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Exa-only discovery path with one orchestrated scholarly search pipeline that merges OpenAlex, Semantic Scholar, and arXiv results into extractor-ready discovered sources.

**Architecture:** Add a normalized discovery layer in `lib/discovery` that queries the three provider adapters in parallel, maps them into a common paper shape, deduplicates by DOI/arXiv ID/URL/title-year, and prefers the best extractor URL and metadata per paper. Then wire `build_source_set` to consume that unified discovery layer while keeping the existing ingest path unchanged.

**Tech Stack:** TypeScript, Node test runner, existing provider adapters, existing ingest pipeline

---

### Task 1: Lock the unified normalization and dedupe behavior

**Files:**
- Create: `tests/scholarly-search.test.tsx`
- Create: `lib/discovery/scholarly-search.ts`

**Step 1: Write the failing test**

```typescript
test("discoverScholarlySources merges OpenAlex, Semantic Scholar, and arXiv into deduped extractor-ready sources", async () => {
  // Assert provider orchestration, dedupe, provider union, and URL preference order.
});
```

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/scholarly-search.test.tsx`
Expected: FAIL because the unified module does not exist yet.

**Step 3: Write minimal implementation**

```typescript
export async function discoverScholarlySources(...) {
  // Query providers, map results, dedupe, sort, return normalized sources.
}
```

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/scholarly-search.test.tsx`
Expected: PASS

### Task 2: Wire build_source_set to the unified pipeline

**Files:**
- Modify: `lib/engine/nodes/build-source-set.ts`
- Modify: `tests/parsing-resilience.test.tsx`

**Step 1: Write the failing test**

```typescript
test("buildSourceSet uses unified scholarly discovery results for discovered jobs", async () => {
  // Patch discovery + ingestion modules and assert discovered scholarly sources are ingested.
});
```

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/parsing-resilience.test.tsx`
Expected: FAIL because build_source_set still imports Exa discovery.

**Step 3: Write minimal implementation**

```typescript
import { discoverScholarlySources } from "@/lib/discovery/scholarly-search";
// Keep ingestDiscoveredSource contract unchanged.
```

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/parsing-resilience.test.tsx`
Expected: PASS

### Task 3: Verify the unified path end-to-end

**Files:**
- Modify: `lib/agent/tools/search-external-sources.ts` only if we decide to share the same discovery layer there too

**Step 1: Run targeted automated tests**

Run: `node --import tsx --test tests/scholarly-search.test.tsx tests/parsing-resilience.test.tsx`
Expected: PASS

**Step 2: Run provider harnesses as smoke checks**

Run: `npm run test:openalex -- "retrieval augmented generation"`
Expected: PASS

Run: `npm run test:semantic-scholar -- "retrieval augmented generation"`
Expected: PASS or public fallback warning with valid results.

Run: `npm run test:arxiv -- "retrieval augmented generation"`
Expected: PASS

**Step 3: Run lint for changed files**

Run: `npm run lint -- tests/scholarly-search.test.tsx tests/parsing-resilience.test.tsx lib/discovery/scholarly-search.ts lib/engine/nodes/build-source-set.ts`
Expected: PASS
