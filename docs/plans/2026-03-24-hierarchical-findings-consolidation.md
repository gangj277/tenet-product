# Hierarchical Findings Consolidation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the monolithic findings consolidation step with a deterministic reduce-and-cluster stage, parallel cluster-level consolidation, and a final global merge that preserves evidence quality while cutting latency.

**Architecture:** Keep chunk-level evidence extraction unchanged, then reduce duplicate evidence deterministically, cluster related claims locally, consolidate each cluster in parallel with the lite model, and run one smaller final merge with the primary model. Keep the visible pipeline UI unchanged by surfacing the new internal phases as sub-steps under `consolidate_findings`.

**Tech Stack:** TypeScript, LangGraph, Node test runner, structured JSON LLM calls, OpenAI-auth provider

---

### Task 1: Lock the target behavior with tests

**Files:**
- Create: `tests/hierarchical-consolidation.test.tsx`
- Modify: `tests/synthesize-project-blobs.test.tsx`

**Step 1: Write failing tests**

- Assert deterministic reduction deduplicates repeated evidence across `EvidenceMap` categories.
- Assert related claims cluster together while clearly distinct claims stay separate.
- Assert `consolidateFindings` performs cluster consolidations first and final merge second.
- Assert the final merge prompt receives cluster summaries rather than the full raw evidence map.

**Step 2: Run tests to verify failure**

Run: `node --import tsx --test --test-force-exit tests/hierarchical-consolidation.test.tsx tests/synthesize-project-blobs.test.tsx`

**Step 3: Commit**

`git commit -m "test: cover hierarchical findings consolidation"`

### Task 2: Implement deterministic reduction and clustering

**Files:**
- Create: `lib/engine/consolidation/reduce-and-cluster.ts`
- Modify: `lib/engine/state.ts`

**Step 1: Write minimal implementation**

- Add pure helpers to flatten and dedupe evidence.
- Add claim normalization, tokenization, similarity scoring, and stable clustering.
- Add compact cluster payload builders for downstream LLM calls.

**Step 2: Run targeted tests**

Run: `node --import tsx --test --test-force-exit tests/hierarchical-consolidation.test.tsx`

**Step 3: Commit**

`git commit -m "feat: add deterministic evidence reduction and clustering"`

### Task 3: Implement hierarchical consolidation

**Files:**
- Modify: `lib/engine/nodes/consolidate-findings.ts`
- Modify: `lib/engine/prompts/consolidation.ts`
- Modify: `lib/storage/memory-store.ts`

**Step 1: Write minimal implementation**

- Replace the single global consolidation call with:
  - reduction sub-step
  - parallel cluster consolidations
  - final merge call
- Keep the outer step id `consolidate_findings` and expose internal sub-steps through progress updates.

**Step 2: Run targeted tests**

Run: `node --import tsx --test --test-force-exit tests/hierarchical-consolidation.test.tsx tests/synthesize-project-blobs.test.tsx`

**Step 3: Commit**

`git commit -m "feat: add hierarchical findings consolidation"`

### Task 4: Verify end-to-end compatibility

**Files:**
- Modify: `lib/engine/nodes/synthesize-project.ts` if required by the updated findings shape

**Step 1: Run compatibility tests**

Run: `node --import tsx --test --test-force-exit tests/hierarchical-consolidation.test.tsx tests/synthesize-project-blobs.test.tsx tests/analyze-evidence-chunks.test.tsx tests/init-graph-fail-fast.test.tsx`

**Step 2: Run lint**

Run: `npx eslint lib/engine/consolidation/reduce-and-cluster.ts lib/engine/nodes/consolidate-findings.ts lib/engine/prompts/consolidation.ts lib/storage/memory-store.ts tests/hierarchical-consolidation.test.tsx tests/synthesize-project-blobs.test.tsx`

**Step 3: Commit**

`git commit -m "chore: verify hierarchical findings pipeline"`
