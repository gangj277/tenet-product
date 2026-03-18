# OpenAlex Search Harness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a small OpenAlex search client and a runnable script that exercises live paper searches using `OPENALEX_API_KEY` from local env.

**Architecture:** Introduce a focused `lib/discovery/openalex.ts` wrapper for search request construction and response parsing, covered by a unit test. Add a `scripts/test-openalex-search.ts` harness that loads `.env.local`, executes one or more queries, and prints compact results for manual inspection.

**Tech Stack:** TypeScript, Node test runner, `tsx`, Next env loading, OpenAlex REST API.

---

### Task 1: Cover OpenAlex request/response behavior

**Files:**
- Create: `tests/openalex-search.test.tsx`
- Create: `lib/discovery/openalex.ts`

**Step 1: Write the failing test**
- Assert the client sends the API key header, builds the expected search URL, and normalizes a minimal OpenAlex response.

**Step 2: Run test to verify it fails**
- Run: `node --import tsx --test tests/openalex-search.test.tsx`

**Step 3: Write minimal implementation**
- Add `searchOpenAlexWorks()` and minimal response types.

**Step 4: Run test to verify it passes**
- Run: `node --import tsx --test tests/openalex-search.test.tsx`

### Task 2: Add the runnable harness

**Files:**
- Create: `scripts/test-openalex-search.ts`
- Modify: `package.json`
- Modify: `.env.local`

**Step 1: Add a script entry**
- Add an npm script for the harness.

**Step 2: Add the harness**
- Load `.env.local`, require `OPENALEX_API_KEY`, accept CLI queries, and print top search hits.

**Step 3: Save the provided API key locally**
- Add `OPENALEX_API_KEY` to `.env.local`.

**Step 4: Run the harness**
- Run: `npm run test:openalex -- "retrieval augmented generation"`

### Task 3: Verify end-to-end

**Files:**
- Modify only if needed

**Step 1: Re-run unit test**
- Run: `node --import tsx --test tests/openalex-search.test.tsx`

**Step 2: Run the harness with a second query**
- Run: `npm run test:openalex -- "model collapse synthetic data"`
