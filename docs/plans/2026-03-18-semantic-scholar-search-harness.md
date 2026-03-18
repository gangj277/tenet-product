# Semantic Scholar Search Harness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Semantic Scholar bulk-search client and test script that returns extractor-ready URLs for discovered papers.

**Architecture:** Build a small discovery adapter in `lib/discovery` that wraps Semantic Scholar bulk search, normalizes each paper into the same landing/PDF URL shape the ingest pipeline already expects, and keeps the live script separate from product wiring. Verify behavior with test-first coverage for URL normalization, key handling, and fallback URL selection before running live API checks.

**Tech Stack:** TypeScript, Node test runner, Next env loading, Semantic Scholar Graph API

---

### Task 1: Capture bulk-search URL normalization requirements

**Files:**
- Create: `tests/semantic-scholar-search.test.tsx`
- Create: `lib/discovery/semantic-scholar.ts`

**Step 1: Write the failing test**

```typescript
test("searchSemanticScholarPapers normalizes extractor-ready URLs from bulk results", async () => {
  // Assert bulk endpoint, API key header, and URL fallback selection.
});
```

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/semantic-scholar-search.test.tsx`
Expected: FAIL because the module or export does not exist yet.

**Step 3: Write minimal implementation**

```typescript
export async function searchSemanticScholarPapers(...) {
  // Call bulk endpoint and normalize url/openAccessPdf/externalIds into landingPageUrl and pdfUrl.
}
```

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/semantic-scholar-search.test.tsx`
Expected: PASS

### Task 2: Add a runnable live search harness

**Files:**
- Create: `scripts/test-semantic-scholar-search.ts`
- Modify: `package.json`

**Step 1: Write the failing test**

```typescript
test("CLI exits with a clear message when SEMANTIC_SCHOLAR_API_KEY is missing", async () => {
  // Validate operator ergonomics for the live script.
});
```

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/semantic-scholar-search.test.tsx`
Expected: FAIL because the script helper does not exist yet.

**Step 3: Write minimal implementation**

```typescript
loadEnvConfig(process.cwd());
// Read queries, call searchSemanticScholarPapers, print landing/pdf URLs.
```

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/semantic-scholar-search.test.tsx`
Expected: PASS

### Task 3: Verify live API behavior and document constraints

**Files:**
- Modify: `lib/discovery/semantic-scholar.ts` if live behavior requires small fixes

**Step 1: Run targeted automated tests**

Run: `node --import tsx --test tests/semantic-scholar-search.test.tsx`
Expected: PASS

**Step 2: Run live harness**

Run: `npm run test:semantic-scholar -- "retrieval augmented generation"`
Expected: Either normalized results with landing/PDF URLs or a precise authentication/rate-limit failure that reflects current API status.

**Step 3: Run lint for changed files**

Run: `npm run lint -- tests/semantic-scholar-search.test.tsx lib/discovery/semantic-scholar.ts scripts/test-semantic-scholar-search.ts`
Expected: PASS
