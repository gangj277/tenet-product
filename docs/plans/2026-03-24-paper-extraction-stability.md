# Paper Extraction Stability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make scholarly source ingestion materially more stable by fixing the bundled PDF worker path, adding a real extraction diagnostic harness, and hardening fallback behavior around fetch and PDF normalization.

**Architecture:** Keep the existing byte-first ingest pipeline, but remove the Turbopack-incompatible `pdfjs` worker bootstrap and replace it with a bundle-safe worker loader. Extend the existing attrition harness so it exercises the actual `ingestDiscoveredSource` path under a real OpenAI-auth provider, then use the resulting diagnostics to guide fetch/parser fallback decisions.

**Tech Stack:** Next.js App Router, TypeScript, pdfjs-dist, Node test runner, Drizzle ORM, OpenAI-auth runtime.

---

### Task 1: Lock in the live PDF worker regression

**Files:**
- Modify: `tests/pdf-worker-config.test.tsx`
- Modify: `lib/pdf/gemini-extract.ts`

**Step 1: Write the failing test**

- Add a regression test that proves the PDF worker bootstrap does not depend on `createRequire(...).resolve(...)` plus `import(workerSrc)`.
- Add a regression test that the worker loader uses a bundler-safe literal module specifier and exposes `WorkerMessageHandler`.

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/pdf-worker-config.test.tsx`

Expected: failure showing the current worker bootstrap still relies on the dynamic import path that breaks in the Next server bundle.

**Step 3: Write minimal implementation**

- Replace the worker resolution/bootstrap in `lib/pdf/gemini-extract.ts` with a literal-import strategy that Turbopack can statically analyze.
- Keep the worker cached on `globalThis` so repeated parses do not thrash module loading.

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/pdf-worker-config.test.tsx`

Expected: pass.

### Task 2: Add extraction-fallback coverage

**Files:**
- Modify: `tests/source-ingestion.test.tsx`
- Modify: `tests/parsing-resilience.test.tsx`
- Modify: `lib/pdf/gemini-extract.ts`
- Modify: `lib/ingest/source-ingestion.ts`

**Step 1: Write the failing tests**

- Add a test proving PDF ingestion can fall back cleanly when the primary PDF normalization path throws.
- Add a test proving ingestion records stage-specific parse errors instead of collapsing to a generic failure.

**Step 2: Run tests to verify they fail**

Run: `node --import tsx --test tests/source-ingestion.test.tsx tests/parsing-resilience.test.tsx`

Expected: failures showing the missing fallback or weak diagnostics.

**Step 3: Write minimal implementation**

- Add the smallest parser fallback that improves robustness without changing the overall ingest contract.
- Preserve useful failure reasons in source metadata and warnings.

**Step 4: Run tests to verify they pass**

Run: `node --import tsx --test tests/source-ingestion.test.tsx tests/parsing-resilience.test.tsx`

Expected: pass.

### Task 3: Upgrade the paper-extraction diagnostic harness

**Files:**
- Modify: `scripts/test-source-attrition.ts`
- Modify: `package.json`
- Modify only if needed: `lib/llm/provider-factory.ts`

**Step 1: Write the failing test or executable expectation**

- Define the harness contract in code:
  - loads app env
  - binds a real OpenAI-auth provider
  - exercises actual `ingestDiscoveredSource`
  - emits machine-readable failure buckets and per-source stage diagnostics

**Step 2: Run the harness to verify the current gaps**

Run: `npx tsx scripts/test-source-attrition.ts --query "retrieval augmented generation factual accuracy" --limit 10`

Expected: current script either misses the real provider path or does not report enough detail.

**Step 3: Write minimal implementation**

- Add CLI flags for query, limit, concurrency, user selection, and output path.
- Load the connected OpenAI-auth user/provider automatically when possible.
- Use `runWithRequestProvider(...)` plus the real ingest path so results match the app.

**Step 4: Run the harness to verify it works**

Run: `npx tsx scripts/test-source-attrition.ts --query "retrieval augmented generation factual accuracy" --limit 10`

Expected: JSON and console summary show parsed/failed counts and grouped causes.

### Task 4: Verify the integrated pipeline surface

**Files:**
- Modify only if failures require it

**Step 1: Run focused tests**

Run: `node --import tsx --test tests/pdf-worker-config.test.tsx tests/source-ingestion.test.tsx tests/parsing-resilience.test.tsx`

Expected: pass.

**Step 2: Run lint on touched files**

Run: `npx eslint lib/pdf/gemini-extract.ts lib/ingest/source-ingestion.ts scripts/test-source-attrition.ts tests/pdf-worker-config.test.tsx tests/source-ingestion.test.tsx tests/parsing-resilience.test.tsx`

Expected: pass.

**Step 3: Run the real extraction harness**

Run: `npx tsx scripts/test-source-attrition.ts --query "retrieval augmented generation factual accuracy" --limit 10`

Expected: materially better parse yield and a concrete breakdown of the residual failures.
