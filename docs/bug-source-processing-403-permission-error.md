# Bug: Source Processing Fails — 403 Permission Error During Pipeline

**Status**: Resolved
**Priority**: High
**Reported**: 2026-03-23
**Affects**: Project init pipeline → "Parsing sources" step
**Symptom**: All discovered sources fail to parse (e.g. "29/30 done, 0 parsed, 29 failed")

---

## Error Details

### Browser Console Error

```
Uncaught (in promise) Object {
  code: 403,
  data: {
    code: 403,
    msg: "permission error",
    error: "exceptions.UserAuthError"
  },
  handled: false,
  httpError: false,
  httpStatus: 200,
  httpStatusText: "",
  message: "permission error",
  name: "n",
  originalError: {
    name: "Error",
    message: "permission error",
    stack: "Error: permission error\n    at oe.handleRes (chrom…abcbjgholdjcjblkibolbppb/background.js:4701:8162)"
  },
  reqInfo: {
    id: 2,
    pathPrefix: "/generate",
    method: "POST",
    path: "/tone",
    cmd: {...}
  }
}
```

### Key Observations

1. **This error originates from a Chrome extension**, not from Lumen's code.
   - The stack trace points to `chrome-extension://abcbjgholdjcjblkibolbppb/background.js`
   - Extension ID `abcbjgholdjcjblkibolbppb` — likely a writing/AI assistant extension (Grammarly, Jasper, QuillBot, or similar) based on the `/generate` and `/tone` path
   - The extension is intercepting outbound requests and injecting its own errors

2. **The `httpStatus: 200` but `code: 403` pattern** confirms this is an extension-layer error, not an HTTP transport error — the actual HTTP response was 200 OK, but the extension's internal permission check failed.

3. **This may or may not be the cause of the source parsing failures.** The extension could be:
   - Intercepting fetch requests to external source URLs (arXiv, Semantic Scholar PDFs)
   - Intercepting requests to the Codex API endpoint (`chatgpt.com/backend-api/codex/responses`)
   - Simply logging unrelated errors that coincide with the pipeline running

## Root Cause Confirmed

The browser-extension console error was a red herring. The backend failure path was caused by two server-side issues in the ChatGPT OAuth provider flow:

1. `lib/llm/openrouter.ts` stored the active user provider in a **process-global variable**.
   - `POST /api/init/[runId]/confirm` launched the graph in the background and left that global provider set while the pipeline kept running.
   - Any overlapping request could overwrite or clear the provider before `build_source_set -> parsePDF -> callLLM` executed for later sources.
   - That made source parsing use the wrong OAuth credentials or lose credentials entirely, which can surface as Codex permission failures.

2. `lib/engine/nodes/build-source-set.ts` fanned out **too many concurrent PDF normalizations**.
   - The previous limit of `20` concurrent ingests was unnecessarily aggressive for ChatGPT OAuth-backed Codex usage.
   - High fan-out increased the chance of provider throttling and made failures cascade across the entire source set.

## Fix Applied

- Replaced the process-global request provider with **`AsyncLocalStorage` request context isolation** in `lib/llm/openrouter.ts`
- Updated `app/api/init/route.ts` and `app/api/init/[runId]/confirm/route.ts` to run graph execution inside that isolated provider context
- Updated `app/api/agent/[runId]/chat/route.ts` and `lib/pdf/gemini-extract.ts` so ad hoc PDF parsing also uses the connected OAuth provider explicitly
- Added timeout handling around PDF normalization and lowered source-ingest concurrency from `20` to `4`
- Added regression tests for provider isolation, OAuth-backed PDF parsing, parser timeout behavior, and bounded source-parse concurrency

---

## Initial Investigation Hypotheses (Historical)

The sections below are preserved from the original investigation notes. They were useful triage leads at the time, but the confirmed backend root cause is documented above.

### Cause A: Chrome Extension Interference (Most Likely)

A browser extension is intercepting network requests made by the Lumen frontend or modifying request headers. This could cause:
- Source fetch requests to academic sites to fail
- Codex API calls to be blocked or modified
- CORS/auth headers to be stripped

**How to verify:**
1. Open `chrome://extensions/` and identify extension `abcbjgholdjcjblkibolbppb`
2. Disable it temporarily
3. Retry the pipeline
4. If sources parse successfully, the extension is the culprit

**Alternative:** Test in an Incognito window with all extensions disabled.

### Cause B: Codex API Rate Limits

The pipeline fires up to 20 concurrent source ingestion requests. Each source that's a PDF goes through:
1. `fetch(sourceUrl)` → download the PDF
2. `pdfjs-dist` → extract raw text locally
3. `callLLM()` → normalize via Codex API (gpt-5.4-mini)

With 30 sources, that's 30 concurrent LLM calls through the Codex endpoint. The ChatGPT Pro plan has rate limits (5-hour rolling window), and 30 rapid-fire requests could hit them.

**How to verify:**
- Check the server terminal for error messages like `Codex 429: ...` or `Codex 400: ...`
- If rate-limited, reduce `MAX_CONCURRENT_SOURCE_INGESTS` in `lib/engine/nodes/build-source-set.ts` (currently 20)

### Cause C: Source Fetch Failures (Network/CORS)

The source URLs (academic paper PDFs) may be unreachable:
- Some publishers block automated access (Elsevier, Springer, IEEE)
- arXiv PDFs may rate-limit rapid successive downloads
- CORS issues when fetching from the browser context

**How to verify:**
- Check server terminal for fetch timeout/error messages
- The source fetching happens server-side (Next.js API route), so CORS shouldn't be an issue
- Check if `fetchSourceBytes` in `lib/ingest/source-ingestion.ts` is throwing

---

## Architecture Context

### Current Pipeline Flow (Post-OpenAI Integration)

```
POST /api/init
  → setRequestProvider(codexProvider)
  → initGraph.invoke()
    → intake_user_context
    → infer_user_perspective (callLLMJson → Codex → gpt-5.4)
    → [interrupt: user confirms]

POST /api/init/[runId]/confirm
  → setRequestProvider(codexProvider)
  → initGraph.invoke(resume)
    → plan_search_queries (callLLMJson → Codex → gpt-5.4)
    → build_source_set
      → discoverScholarlySources (Semantic Scholar, OpenAlex, arXiv)
      → For each source (up to 20 concurrent):
        → fetchSourceBytes(url)         ← could fail here
        → pdfjs-dist local extraction   ← or here
        → callLLM normalization          ← or here (Codex API)
    → classify_and_analyze
    → consolidate_findings
    → synthesize_project
    → persist_project
```

### Files to Investigate

| File | Purpose |
|------|---------|
| `lib/ingest/source-ingestion.ts` | Source fetching + PDF parsing orchestration |
| `lib/pdf/gemini-extract.ts` | pdfjs-dist extraction + LLM normalization |
| `lib/engine/nodes/build-source-set.ts` | Concurrent source ingestion (MAX_CONCURRENT = 20) |
| `lib/llm/providers/codex.ts` | Codex API provider (Responses API format) |
| `lib/llm/openrouter.ts` | Request-scoped provider resolution |

---

## Recommended Debug Steps

1. **Disable all Chrome extensions** and retry → isolates browser interference
2. **Check server terminal** for `[consolidate]`, `[plan-search]`, `[synthesize]`, `[init]` error logs
3. **Reduce concurrency**: Change `MAX_CONCURRENT_SOURCE_INGESTS` from 20 to 5 in `build-source-set.ts`
4. **Test source fetching directly**: `curl -L https://arxiv.org/pdf/2305.17493 -o test.pdf` — verify sources are reachable
5. **Test Codex API directly**: Run the test script in the repo (see below)

### Test Script

```bash
# From project root:
export $(grep -v '^#' .env.local | xargs)
npx tsx -e "
import { setRequestProvider, clearRequestProvider } from './lib/llm/openrouter';
import { createProviderForUser } from './lib/llm/provider-factory';
import { parsePDF } from './lib/pdf/gemini-extract';

async function main() {
  const provider = await createProviderForUser('e768e2c9-331c-42ba-87ba-6d88536230e7');
  setRequestProvider(provider);
  try {
    const res = await fetch('https://arxiv.org/pdf/2305.17493');
    const buffer = Buffer.from(await res.arrayBuffer());
    const result = await parsePDF(buffer, 'test.pdf');
    console.log('Pages:', result.pageCount, 'Text:', result.text.length, 'chars');
    console.log('SUCCESS');
  } finally { clearRequestProvider(); }
  process.exit(0);
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
"
```

This test was verified working on 2026-03-23 — arXiv PDF → 18 pages → 15k chars clean markdown via Codex gpt-5.4-mini.

---

## Resolution Checklist

- [ ] Identify and disable the interfering Chrome extension
- [ ] Verify pipeline works in Incognito mode
- [ ] If rate limiting: reduce `MAX_CONCURRENT_SOURCE_INGESTS` to 5
- [ ] If source fetch failures: add retry logic or skip unreachable sources gracefully
- [ ] Add server-side error logging to `ingestDiscoveredSource` catch blocks
- [ ] Consider adding a "retry failed sources" button in the UI
