# arXiv Search Harness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an arXiv search adapter and live harness that return extractor-ready abstract and PDF URLs for paper discovery.

**Architecture:** Build a small `lib/discovery/arxiv.ts` client around the official arXiv Atom API. The adapter will construct precise `search_query` strings using arXiv field prefixes, parse Atom feed metadata and entries into a normalized paper shape, and expose the abstract-page URL plus PDF URL so the existing ingest pipeline can consume arXiv results directly.

**Tech Stack:** TypeScript, Node test runner, Atom XML parsing with local helpers, arXiv API

---

### Task 1: Lock the arXiv query builder and URL mapping

**Files:**
- Create: `tests/arxiv-search.test.tsx`
- Create: `lib/discovery/arxiv.ts`

**Step 1: Write the failing test**

```typescript
test("searchArxivPapers builds a fielded arXiv query and normalizes Atom entries", async () => {
  // Assert search_query, sort params, abstract URL, PDF URL, and metadata mapping.
});
```

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/arxiv-search.test.tsx`
Expected: FAIL because the module or export does not exist yet.

**Step 3: Write minimal implementation**

```typescript
export async function searchArxivPapers(...) {
  // Build search_query and parse Atom feed entries into extractor-ready paper results.
}
```

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/arxiv-search.test.tsx`
Expected: PASS

### Task 2: Add a runnable live arXiv search harness

**Files:**
- Create: `scripts/test-arxiv-search.ts`
- Modify: `package.json`

**Step 1: Write the failing test**

```typescript
test("searchArxivPapers supports default relevance sorting and returns result counts", async () => {
  // Validate feed-level metadata and operator-facing output expectations.
});
```

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/arxiv-search.test.tsx`
Expected: FAIL until the script-facing API shape is complete.

**Step 3: Write minimal implementation**

```typescript
// Load queries from argv, call searchArxivPapers, and print source/extractor URLs.
```

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/arxiv-search.test.tsx`
Expected: PASS

### Task 3: Verify live arXiv behavior

**Files:**
- Modify: `lib/discovery/arxiv.ts` if the live feed shape differs from the fixture

**Step 1: Run targeted automated tests**

Run: `node --import tsx --test tests/arxiv-search.test.tsx`
Expected: PASS

**Step 2: Run live harness**

Run: `npm run test:arxiv -- "retrieval augmented generation"`
Expected: PASS with arXiv abstract URLs and PDF URLs printed for top results.

**Step 3: Run lint for changed files**

Run: `npm run lint -- tests/arxiv-search.test.tsx lib/discovery/arxiv.ts scripts/test-arxiv-search.ts`
Expected: PASS
