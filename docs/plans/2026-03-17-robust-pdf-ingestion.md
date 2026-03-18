# Robust PDF Ingestion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current URL/text-based source pipeline with a byte-first PDF/HTML ingest flow, bounded chunk analysis, and metadata-only persistence.

**Architecture:** Every source is fetched or read as raw bytes first, classified from bytes plus headers, stored in blob storage, normalized into validated text, chunked under a hard token budget, and analyzed chunk-by-chunk. Postgres stores source metadata, chunk manifests, and artifacts; normalized/raw document bodies live in blob storage.

**Tech Stack:** Next.js, TypeScript, LangGraph, Drizzle ORM, Postgres, OpenRouter, Gemini, Cloudflare R2, Node test runner.

---

### Task 1: Lock in regression coverage for the new ingest contract

**Files:**
- Modify: `tests/parsing-resilience.test.tsx`
- Create: `tests/source-ingestion.test.tsx`
- Create: `tests/persist-research-artifacts.test.tsx`

**Step 1: Write failing tests**

- Add a test proving a `.pdf?...` URL whose bytes start with `%PDF` is classified as PDF, not HTML.
- Add a test proving PDF-like parser output is rejected by document-quality validation and excluded from parsed sources.
- Add a test proving persistence writes metadata/blob keys and chunk manifests, not giant `parsed_content`.

**Step 2: Run tests to verify they fail**

Run: `node --import tsx --test tests/source-ingestion.test.tsx tests/persist-research-artifacts.test.tsx`

Expected: failures showing missing or incorrect byte classification and persistence behavior.

**Step 3: Implement the minimal production code**

- Finish `lib/ingest/source-ingestion.ts` and `lib/db/research-projects.ts` to satisfy the new expectations.

**Step 4: Run tests to verify they pass**

Run: `node --import tsx --test tests/source-ingestion.test.tsx tests/persist-research-artifacts.test.tsx tests/parsing-resilience.test.tsx`

Expected: all targeted tests pass.

### Task 2: Complete the byte-first ingest path

**Files:**
- Modify: `app/api/upload/route.ts`
- Modify: `lib/engine/nodes/build-source-set.ts`
- Modify: `lib/ingest/source-ingestion.ts`
- Modify: `lib/engine/state.ts`

**Step 1: Write/update failing tests**

- Extend ingest tests to cover uploaded PDFs and discovered HTML sources.
- Extend parsing resilience coverage for bounded parse concurrency.

**Step 2: Run tests to verify they fail**

Run: `node --import tsx --test tests/source-ingestion.test.tsx tests/parsing-resilience.test.tsx`

**Step 3: Write minimal implementation**

- Uploads write raw bytes to blob storage immediately and annotate source metadata.
- `build_source_set` routes discovered and uploaded sources through the same ingestion API, accumulates parsed sources and source chunks, and records source-level failures without crashing the run.

**Step 4: Run tests to verify they pass**

Run: `node --import tsx --test tests/source-ingestion.test.tsx tests/parsing-resilience.test.tsx`

### Task 3: Replace whole-document evidence analysis with chunk analysis

**Files:**
- Modify: `lib/engine/nodes/analyze-evidence.ts`
- Modify: `lib/engine/nodes/synthesize-project.ts`
- Modify: `lib/storage/blob-store.ts` (only if helper APIs are needed)

**Step 1: Write failing tests**

- Add a test proving evidence analysis consumes chunk blobs, not inline full-document `content`.
- Add a test proving a single source is not sent three times as a full raw prompt.

**Step 2: Run tests to verify they fail**

Run: `node --import tsx --test tests/analyze-evidence-chunks.test.tsx`

**Step 3: Write minimal implementation**

- Analyze each chunk once using a canonical schema.
- Reduce chunk evidence into per-source evidence.
- Load normalized text from blob storage for source summaries instead of inline `parsedSources.content`.

**Step 4: Run tests to verify they pass**

Run: `node --import tsx --test tests/analyze-evidence-chunks.test.tsx`

### Task 4: Harden provider calls and persistence

**Files:**
- Modify: `lib/pdf/gemini-extract.ts`
- Modify: `lib/llm/openrouter.ts`
- Modify: `lib/db/schema.ts`
- Modify: `lib/db/research-projects.ts`
- Create: `drizzle/0001_source_chunks.sql`
- Modify: `drizzle/meta/0000_snapshot.json`
- Modify: `drizzle/meta/_journal.json`

**Step 1: Write/update failing tests**

- Cover timeout behavior, retry policy, and deterministic `400` non-retry behavior.
- Cover source chunk persistence.

**Step 2: Run tests to verify they fail**

Run: `node --import tsx --test tests/parsing-resilience.test.tsx tests/persist-research-artifacts.test.tsx`

**Step 3: Write minimal implementation**

- `parsePDF` supports model override plus timeout/retry envelope.
- `callLLM` retries only retryable provider failures.
- Source metadata persists to `sources.metadata`; chunk manifests persist to `source_chunks`; `parsed_content` remains unused.

**Step 4: Run tests to verify they pass**

Run: `node --import tsx --test tests/parsing-resilience.test.tsx tests/persist-research-artifacts.test.tsx`

### Task 5: Verify the integrated pipeline

**Files:**
- Modify only if failures require it

**Step 1: Run focused tests**

Run: `node --import tsx --test tests/source-ingestion.test.tsx tests/analyze-evidence-chunks.test.tsx tests/persist-research-artifacts.test.tsx tests/parsing-resilience.test.tsx`

**Step 2: Run lint on touched files**

Run: `npm run lint -- app/api/upload/route.ts lib/engine/nodes/build-source-set.ts lib/engine/nodes/analyze-evidence.ts lib/engine/nodes/synthesize-project.ts lib/ingest/source-ingestion.ts lib/pdf/gemini-extract.ts lib/llm/openrouter.ts lib/db/research-projects.ts lib/db/schema.ts tests/source-ingestion.test.tsx tests/analyze-evidence-chunks.test.tsx tests/persist-research-artifacts.test.tsx tests/parsing-resilience.test.tsx`

**Step 3: Fix any breakage and rerun**

- Iterate until the focused test and lint commands are green.
