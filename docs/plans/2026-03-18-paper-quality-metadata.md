# Paper Quality Metadata Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist lean paper-quality metadata for discovered scholarly sources in both project initialization and chat search flows, without breaking the current ingest pipeline.

**Architecture:** Extend the unified scholarly discovery result shape with a small `paperQuality` object, then thread that object through discovered-source ingest into persisted `sources.metadata` and chat search result metadata. Keep the schema additive and JSON-based so there is no DB migration and the current pipeline behavior stays intact.

**Tech Stack:** TypeScript, Next.js, LangGraph state, Drizzle-backed persistence, node:test

---

### Task 1: Add failing discovery-shape tests

**Files:**
- Modify: `tests/scholarly-search.test.tsx`

**Step 1: Write the failing test**

Add assertions that unified scholarly results include:
- `paperQuality.ids`
- `paperQuality.publication`
- `paperQuality.metrics`
- `paperQuality.flags`
- `paperQuality.hints`

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/scholarly-search.test.tsx`

Expected: FAIL because the current discovery result does not include `paperQuality`.

**Step 3: Write minimal implementation**

Update discovery normalization and merge logic to build a shared lean metadata shape from OpenAlex, Semantic Scholar, and arXiv.

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/scholarly-search.test.tsx`

Expected: PASS

### Task 2: Add failing ingest persistence test

**Files:**
- Modify: `tests/parsing-resilience.test.tsx`
- Modify: `lib/engine/nodes/build-source-set.ts`
- Modify: `lib/ingest/source-ingestion.ts`
- Modify: `lib/engine/state.ts`

**Step 1: Write the failing test**

Extend the discovered-source test so the mocked discovery result includes `paperQuality`, and assert that `ingestDiscoveredSource` receives it and that failed discovered ingests preserve it in `source.metadata`.

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/parsing-resilience.test.tsx`

Expected: FAIL because the current discovered ingest contract drops the metadata.

**Step 3: Write minimal implementation**

Add `paperQuality` to:
- the discovered job type
- `ingestDiscoveredSource` params
- `SourceMetadata`
- discovered failure metadata construction

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/parsing-resilience.test.tsx`

Expected: PASS

### Task 3: Add failing chat rendering/serialization test

**Files:**
- Modify: `tests/search-external-sources.test.tsx`
- Modify: `lib/agent/tools/search-external-sources.ts`
- Modify: `app/dashboard/[runId]/_components/chat-message.tsx`
- Modify: `lib/db/research-projects.ts`

**Step 1: Write the failing test**

Add assertions that chat search results carry `paperQuality` through the tool result and that the rendered source summary includes useful quality hints such as citations or influential citations when present.

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/search-external-sources.test.tsx`

Expected: FAIL because the current formatting/rendering does not include the new metadata hints.

**Step 3: Write minimal implementation**

Update:
- chat tool formatting to mention quality signals
- search result card UI to display compact badges
- `getSourceMetadataForRun` / `SourceMeta` to expose persisted `paperQuality` for project-side consumers

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/search-external-sources.test.tsx`

Expected: PASS

### Task 4: Full verification

**Files:**
- Modify as needed from prior tasks only

**Step 1: Run targeted suite**

Run:
- `node --import tsx --test tests/scholarly-search.test.tsx tests/parsing-resilience.test.tsx tests/search-external-sources.test.tsx`

Expected: PASS

**Step 2: Run lint on touched files**

Run:
- `npm run lint -- tests/scholarly-search.test.tsx tests/parsing-resilience.test.tsx tests/search-external-sources.test.tsx lib/discovery/scholarly-search.ts lib/engine/nodes/build-source-set.ts lib/ingest/source-ingestion.ts lib/engine/state.ts lib/db/research-projects.ts lib/agent/tools/search-external-sources.ts 'app/dashboard/[runId]/_components/chat-message.tsx'`

Expected: PASS

**Step 3: Review requirements against implementation**

Confirm:
- no DB migration added
- current ingest path still accepts discovered and uploaded sources
- paper-quality metadata is additive and optional
- chat search still works when metadata is missing
