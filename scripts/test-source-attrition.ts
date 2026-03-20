/**
 * Source attrition diagnostic — traces where sources are lost between discovery and parsing.
 *
 * Usage:
 *   npx tsx scripts/test-source-attrition.ts
 *   npx tsx scripts/test-source-attrition.ts "your custom research query"
 */

import {
  discoverScholarlySources,
  type ScholarlyDiscoveredSource,
} from "../lib/discovery/scholarly-search";
import {
  fetchSourceBytes,
  sniffMimeType,
  extractHtmlText,
  type SourceFetchResult,
} from "../lib/ingest/source-ingestion";
import { validateNormalizedDocument } from "../lib/ingest/document-quality";
import { parsePDF } from "../lib/pdf/gemini-extract";

// ── Config ──────────────────────────────────────────────────────────

const DEFAULT_QUERY =
  "retrieval augmented generation hallucination reduction enterprise";
const NUM_RESULTS = 15;
const QUERY_VARIATIONS = [
  "RAG grounding factual accuracy LLM",
  "enterprise support copilot retrieval quality",
];

// ── Types ───────────────────────────────────────────────────────────

interface SourceDiagnostic {
  index: number;
  title: string;
  url: string;
  pdfUrl?: string;
  providers: string[];

  // Phase 1: fetch
  fetchAttempts: FetchAttempt[];
  fetchStatus: "ok" | "failed";
  fetchedUrl?: string;
  fetchedContentType?: string;
  fetchedBytes?: number;

  // Phase 2: MIME detection
  sniffedMime?: string;

  // Phase 3: parse / extract
  extractedTextLength?: number;
  extractedTextPreview?: string;

  // Phase 4: validation
  validationResult?: { ok: boolean; reason?: string; estimatedTokens: number };

  // Phase 5: PDF parse (if applicable)
  pdfParseStatus?: "ok" | "failed" | "skipped";
  pdfParseError?: string;
  pdfParsedTextLength?: number;

  // Final
  finalStatus: "parsed" | "failed";
  failureReason?: string;
  failurePhase?: "fetch" | "mime" | "extract" | "validate" | "pdf-parse";
}

interface FetchAttempt {
  url: string;
  status: "ok" | "failed";
  httpStatus?: number;
  error?: string;
  contentType?: string;
  bytes?: number;
  durationMs: number;
}

interface AttritionReport {
  query: string;
  discoveredCount: number;
  sources: SourceDiagnostic[];
  summary: {
    parsed: number;
    failed: number;
    failuresByPhase: Record<string, number>;
    failureReasons: string[];
  };
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const query = process.argv[2] || DEFAULT_QUERY;
  console.log(`\n=== Source Attrition Diagnostic ===`);
  console.log(`Query: "${query}"`);
  console.log(`Requesting ${NUM_RESULTS} results...\n`);

  // Phase 0: Discovery
  console.log(`[Discovery] Searching scholarly sources...`);
  let discovered: ScholarlyDiscoveredSource[];
  try {
    discovered = await discoverScholarlySources({
      query,
      numResults: NUM_RESULTS,
      queryVariations: QUERY_VARIATIONS,
    });
  } catch (err) {
    console.error(`[Discovery] FAILED: ${(err as Error).message}`);
    process.exit(1);
  }

  console.log(`[Discovery] Found ${discovered.length} sources after dedup\n`);

  // Phase 1-4: Trace each source through the ingestion pipeline
  const diagnostics: SourceDiagnostic[] = [];

  for (let i = 0; i < discovered.length; i++) {
    const src = discovered[i];
    const diag = await traceSource(i, src);
    diagnostics.push(diag);

    const icon = diag.finalStatus === "parsed" ? "\u2705" : "\u274C";
    const reason = diag.failureReason ? ` [${diag.failurePhase}] ${diag.failureReason}` : "";
    console.log(
      `  ${icon} ${String(i + 1).padStart(2)}. ${truncate(src.title, 60)}${reason}`
    );
  }

  // Summary
  const report = buildReport(query, discovered.length, diagnostics);

  console.log(`\n=== Summary ===`);
  console.log(`Discovered: ${report.discoveredCount}`);
  console.log(`Parsed:     ${report.summary.parsed}`);
  console.log(`Failed:     ${report.summary.failed}`);
  console.log(`\nFailures by phase:`);
  for (const [phase, count] of Object.entries(report.summary.failuresByPhase)) {
    console.log(`  ${phase}: ${count}`);
  }

  if (report.summary.failureReasons.length > 0) {
    console.log(`\nFailure details:`);
    for (const reason of report.summary.failureReasons) {
      console.log(`  - ${reason}`);
    }
  }

  // Dump full report
  const outputPath = "artifacts/diagnostics/source-attrition-report.json";
  const { mkdir, writeFile } = await import("fs/promises");
  const { dirname } = await import("path");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`\nFull report: ${outputPath}`);
}

// ── Per-source tracing ──────────────────────────────────────────────

async function traceSource(
  index: number,
  src: ScholarlyDiscoveredSource
): Promise<SourceDiagnostic> {
  const diag: SourceDiagnostic = {
    index,
    title: src.title,
    url: src.url,
    pdfUrl: src.pdfUrl,
    providers: src.providers ?? [src.provider],
    fetchAttempts: [],
    fetchStatus: "failed",
    finalStatus: "failed",
  };

  // Build candidate URLs (pdfUrl first, then main url)
  const candidates: string[] = [];
  if (src.pdfUrl) candidates.push(src.pdfUrl);
  if (src.url && src.url !== src.pdfUrl) candidates.push(src.url);

  // Phase 1: Fetch
  let fetched: SourceFetchResult | null = null;
  for (const candidateUrl of candidates) {
    const attempt = await attemptFetch(candidateUrl);
    diag.fetchAttempts.push(attempt);

    if (attempt.status === "ok") {
      fetched = {
        buffer: attempt._buffer!,
        contentType: attempt.contentType ?? "",
        resolvedUrl: candidateUrl,
      };
      diag.fetchStatus = "ok";
      diag.fetchedUrl = candidateUrl;
      diag.fetchedContentType = attempt.contentType;
      diag.fetchedBytes = attempt.bytes;
      break;
    }
  }

  if (!fetched) {
    diag.failureReason = diag.fetchAttempts.map((a) => `${a.url}: ${a.error}`).join("; ");
    diag.failurePhase = "fetch";
    return diag;
  }

  // Phase 2: MIME sniffing
  const mime = sniffMimeType(fetched.buffer, fetched.resolvedUrl, fetched.contentType);
  diag.sniffedMime = mime;

  if (mime === "application/octet-stream") {
    diag.failureReason = `Unsupported MIME (content-type: ${fetched.contentType}, ${fetched.buffer.length} bytes)`;
    diag.failurePhase = "mime";
    return diag;
  }

  // Phase 3: Extract text
  if (mime === "text/html") {
    const html = fetched.buffer.toString("utf8");
    const text = extractHtmlText(html);
    diag.extractedTextLength = text.length;
    diag.extractedTextPreview = text.slice(0, 200);

    // Phase 4: Validate
    const validation = validateNormalizedDocument(text);
    diag.validationResult = validation;
    diag.pdfParseStatus = "skipped";

    if (!validation.ok) {
      diag.failureReason = validation.reason ?? "Validation failed";
      diag.failurePhase = "validate";
      return diag;
    }

    diag.finalStatus = "parsed";
    return diag;
  }

  if (mime === "application/pdf") {
    // Phase 5: PDF parse
    diag.pdfParseStatus = "failed";

    try {
      const result = await parsePDF(fetched.buffer, `${src.title}.pdf`, {
        timeoutMs: 45_000,
      });
      diag.pdfParsedTextLength = result.text.length;
      diag.extractedTextLength = result.text.length;
      diag.extractedTextPreview = result.text.slice(0, 200);

      const validation = validateNormalizedDocument(result.text);
      diag.validationResult = validation;

      if (!validation.ok) {
        diag.failureReason = validation.reason ?? "PDF text failed validation";
        diag.failurePhase = "validate";
        diag.pdfParseStatus = "failed";
        return diag;
      }

      diag.pdfParseStatus = "ok";
      diag.finalStatus = "parsed";
      return diag;
    } catch (err) {
      diag.pdfParseError = (err as Error).message;
      diag.failureReason = `PDF parse failed: ${(err as Error).message}`;
      diag.failurePhase = "pdf-parse";
      return diag;
    }
  }

  diag.failureReason = `Unhandled MIME: ${mime}`;
  diag.failurePhase = "mime";
  return diag;
}

// ── Fetch helper ────────────────────────────────────────────────────

interface FetchAttemptInternal extends FetchAttempt {
  _buffer?: Buffer;
}

async function attemptFetch(url: string): Promise<FetchAttemptInternal> {
  const start = Date.now();
  try {
    const result = await fetchSourceBytes(url);
    return {
      url,
      status: "ok",
      contentType: result.contentType,
      bytes: result.buffer.length,
      durationMs: Date.now() - start,
      _buffer: result.buffer,
    };
  } catch (err) {
    const message = (err as Error).message;
    // Try to extract HTTP status from error message
    const statusMatch = message.match(/failed: (\d+)/);
    return {
      url,
      status: "failed",
      error: message,
      httpStatus: statusMatch ? parseInt(statusMatch[1]) : undefined,
      durationMs: Date.now() - start,
    };
  }
}

// ── Report builder ──────────────────────────────────────────────────

function buildReport(
  query: string,
  discoveredCount: number,
  diagnostics: SourceDiagnostic[]
): AttritionReport {
  const parsed = diagnostics.filter((d) => d.finalStatus === "parsed");
  const failed = diagnostics.filter((d) => d.finalStatus === "failed");

  const failuresByPhase: Record<string, number> = {};
  const failureReasons: string[] = [];

  for (const d of failed) {
    const phase = d.failurePhase ?? "unknown";
    failuresByPhase[phase] = (failuresByPhase[phase] ?? 0) + 1;
    failureReasons.push(`[${phase}] ${truncate(d.title, 40)}: ${d.failureReason}`);
  }

  return {
    query,
    discoveredCount,
    sources: diagnostics.map(({ ...d }) => {
      // Strip internal buffer references for JSON serialization
      for (const attempt of d.fetchAttempts) {
        delete (attempt as FetchAttemptInternal)._buffer;
      }
      return d;
    }),
    summary: {
      parsed: parsed.length,
      failed: failed.length,
      failuresByPhase,
      failureReasons,
    },
  };
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

// ── Run ─────────────────────────────────────────────────────────────

void main().catch((err) => {
  console.error(`Fatal: ${(err as Error).message}`);
  process.exit(1);
});
