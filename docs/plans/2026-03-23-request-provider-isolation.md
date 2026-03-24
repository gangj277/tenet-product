# Request Provider Isolation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the research init pipeline and PDF parsing flow reliably use the connected ChatGPT OAuth provider without cross-request credential leakage or fallback failures.

**Architecture:** Replace the process-global request provider override with async-context-local storage so each init/confirm pipeline keeps its own provider across concurrent work. Add regression coverage for provider isolation and pass the user provider explicitly where ad hoc PDF parsing happens outside the pipeline context.

**Tech Stack:** Next.js route handlers, Node `AsyncLocalStorage`, TypeScript, Node test runner

---

### Task 1: Capture the failing provider-isolation behavior

**Files:**
- Create: `tests/request-provider-context.test.tsx`
- Modify: `lib/llm/openrouter.ts`

**Step 1: Write the failing test**

```typescript
test("request provider contexts stay isolated across overlapping async work", async () => {
  const mod = await import("../lib/llm/openrouter.ts");
  // run two overlapping request contexts and assert each call uses its own provider
});
```

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/request-provider-context.test.tsx`
Expected: FAIL because the second context overwrites the first global provider or clearing the provider breaks the first request.

**Step 3: Write minimal implementation**

```typescript
const requestProviderStorage = new AsyncLocalStorage<LLMProvider | null>();

export function runWithRequestProvider<T>(provider: LLMProvider, fn: () => T): T {
  return requestProviderStorage.run(provider, fn);
}
```

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/request-provider-context.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/request-provider-context.test.tsx lib/llm/openrouter.ts
git commit -m "fix: isolate request-scoped llm providers"
```

### Task 2: Preserve provider context through init and confirm pipeline execution

**Files:**
- Modify: `app/api/init/route.ts`
- Modify: `app/api/init/[runId]/confirm/route.ts`
- Modify: `lib/llm/openrouter.ts`

**Step 1: Write the failing test**

Add route-level or context-level assertions that the init and confirm flow use `runWithRequestProvider(...)` instead of relying on global mutation.

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/request-provider-context.test.tsx tests/init-pipeline-forensic.test.tsx`
Expected: FAIL or remain unprotected until routes are updated.

**Step 3: Write minimal implementation**

Wrap graph invocation in the provider context:

```typescript
result = provider
  ? await runWithRequestProvider(provider, () => initGraph.invoke(initialState, config))
  : await initGraph.invoke(initialState, config);
```

Use the same pattern for the fire-and-forget confirm pipeline so the spawned async work inherits the correct provider context.

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/request-provider-context.test.tsx tests/init-pipeline-forensic.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/init/route.ts app/api/init/[runId]/confirm/route.ts lib/llm/openrouter.ts tests/request-provider-context.test.tsx
git commit -m "fix: preserve llm provider context in init pipeline"
```

### Task 3: Ensure PDF parsing works with ChatGPT OAuth outside pipeline context

**Files:**
- Modify: `lib/pdf/gemini-extract.ts`
- Modify: `app/api/agent/[runId]/chat/route.ts`
- Modify: `tests/request-provider-context.test.tsx`

**Step 1: Write the failing test**

```typescript
test("parsePDF can use an explicit provider for oauth-backed routes", async () => {
  // assert parsePDF delegates to the supplied provider rather than requiring global state
});
```

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/request-provider-context.test.tsx`
Expected: FAIL because `parsePDF` currently only uses `callLLM(...)`.

**Step 3: Write minimal implementation**

Add an optional `provider` parameter to `parsePDF(...)` and use `provider.callLLM(...)` when supplied; update chat attachment parsing to pass the authenticated provider.

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/request-provider-context.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/pdf/gemini-extract.ts app/api/agent/[runId]/chat/route.ts tests/request-provider-context.test.tsx
git commit -m "fix: use oauth provider for pdf parsing"
```

### Task 4: Verify the end-to-end research flow

**Files:**
- Test: `tests/init-pipeline-forensic.test.tsx`
- Test: `tests/parsing-resilience.test.tsx`
- Test: `tests/request-provider-context.test.tsx`

**Step 1: Run targeted regression suite**

Run: `node --import tsx --test tests/request-provider-context.test.tsx tests/parsing-resilience.test.tsx tests/init-pipeline-forensic.test.tsx`
Expected: PASS

**Step 2: Run broader repo verification**

Run: `npm test`
Expected: PASS

**Step 3: Inspect diff and user-facing behavior**

Run: `git diff -- app/api/init/route.ts app/api/init/[runId]/confirm/route.ts lib/llm/openrouter.ts lib/pdf/gemini-extract.ts app/api/agent/[runId]/chat/route.ts tests/request-provider-context.test.tsx`
Expected: Only request-provider isolation and PDF-provider plumbing changes

**Step 4: Commit**

```bash
git add docs/plans/2026-03-23-request-provider-isolation.md
git commit -m "docs: add request provider isolation plan"
```
