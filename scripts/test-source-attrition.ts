/**
 * Source attrition diagnostic — exercises the real source-ingestion path under
 * the connected OpenAI-auth provider and reports where papers fail.
 *
 * Usage:
 *   npx tsx scripts/test-source-attrition.ts
 *   npx tsx scripts/test-source-attrition.ts --query "retrieval augmented generation factual accuracy"
 *   npx tsx scripts/test-source-attrition.ts --url https://arxiv.org/pdf/2312.10997.pdf
 *   npx tsx scripts/test-source-attrition.ts --user-id <uuid> --limit 10 --concurrency 2
 */

import fs from "node:fs";
import path from "node:path";
import { desc, eq } from "drizzle-orm";
import {
  buildSourceAttritionReport,
  classifyFailurePhase,
  type AttritionReport,
  type FetchAttempt,
  type SourceDiagnostic,
} from "@/lib/diagnostics/source-attrition-report";

const DEFAULT_QUERY =
  "retrieval augmented generation hallucination reduction enterprise";
const DEFAULT_LIMIT = 15;
const DEFAULT_CONCURRENCY = 2;
const DEFAULT_QUERY_VARIATIONS = [
  "RAG grounding factual accuracy LLM",
  "enterprise support copilot retrieval quality",
];

interface CliOptions {
  query: string;
  limit: number;
  concurrency: number;
  userId?: string;
  urls: string[];
  outputPath: string;
}

interface InputSource {
  title: string;
  url: string;
  pdfUrl?: string;
  providers: string[];
}

interface RuntimeDeps {
  db: typeof import("../lib/db/client").db;
  userLlmCredentials: typeof import("../lib/db/schema").userLlmCredentials;
  users: typeof import("../lib/db/schema").users;
  discoverScholarlySources: typeof import("../lib/discovery/scholarly-search").discoverScholarlySources;
  fetchSourceBytes: typeof import("../lib/ingest/source-ingestion").fetchSourceBytes;
  ingestDiscoveredSource: typeof import("../lib/ingest/source-ingestion").ingestDiscoveredSource;
  ensureOpenAIProviderAccess: typeof import("../lib/llm/openai-access").ensureOpenAIProviderAccess;
  runWithRequestProvider: typeof import("../lib/llm/runtime").runWithRequestProvider;
  allSettledWithConcurrency: typeof import("../lib/utils/async").allSettledWithConcurrency;
  generateId: typeof import("../lib/utils/id").generateId;
}

let runtimeDeps: RuntimeDeps | null = null;

void main().catch((error) => {
  console.error(`Fatal: ${(error as Error).message}`);
  process.exit(1);
});

async function main() {
  loadLocalEnv();
  runtimeDeps = await loadRuntimeDeps();
  const {
    ensureOpenAIProviderAccess,
    runWithRequestProvider,
    allSettledWithConcurrency,
  } = getRuntimeDeps();
  const options = parseArgs(process.argv.slice(2));
  const userId = options.userId ?? (await pickDefaultUserId());

  if (!userId) {
    throw new Error(
      "No connected OpenAI-auth user found. Connect once in the app or pass --user-id."
    );
  }

  const provider = await ensureOpenAIProviderAccess(userId);
  const inputSources =
    options.urls.length > 0
      ? buildDirectSources(options.urls)
      : await discoverSources(options.query, options.limit);

  console.log("\n=== Source Attrition Diagnostic ===");
  console.log(`User: ${userId}`);
  if (options.urls.length > 0) {
    console.log(`Mode: direct URLs (${inputSources.length})`);
  } else {
    console.log(`Query: "${options.query}"`);
    console.log(`Discovered: ${inputSources.length}`);
  }
  console.log(`Concurrency: ${options.concurrency}`);

  const results = await runWithRequestProvider(provider, () =>
    allSettledWithConcurrency(
      inputSources.map((source, index) => ({ source, index })),
      options.concurrency,
      async ({ source, index }) => diagnoseSource(index, source)
    )
  );

  const diagnostics = results.map((result, index) =>
    result.status === "fulfilled"
      ? result.value
      : {
          index,
          title: inputSources[index]?.title ?? `Source ${index + 1}`,
          url: inputSources[index]?.url ?? "",
          pdfUrl: inputSources[index]?.pdfUrl,
          providers: inputSources[index]?.providers ?? ["unknown"],
          fetchAttempts: [],
          finalStatus: "failed" as const,
          failurePhase: "ingest" as const,
          failureReason:
            (result.reason as Error)?.message ?? "Unknown diagnostic failure",
        }
  );

  const report = buildSourceAttritionReport({
    userId,
    query: options.urls.length > 0 ? undefined : options.query,
    directUrls: options.urls.length > 0 ? options.urls : undefined,
    diagnostics,
  });

  printReport(report);
  writeReport(report, options.outputPath);
}

function parseArgs(argv: string[]): CliOptions {
  let query = DEFAULT_QUERY;
  let limit = DEFAULT_LIMIT;
  let concurrency = DEFAULT_CONCURRENCY;
  let userId: string | undefined;
  const urls: string[] = [];
  let outputPath = "artifacts/diagnostics/source-attrition-report.json";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--query" && next) {
      query = next;
      i += 1;
      continue;
    }
    if (arg === "--limit" && next) {
      limit = Number(next);
      i += 1;
      continue;
    }
    if (arg === "--concurrency" && next) {
      concurrency = Number(next);
      i += 1;
      continue;
    }
    if (arg === "--user-id" && next) {
      userId = next;
      i += 1;
      continue;
    }
    if (arg === "--url" && next) {
      urls.push(next);
      i += 1;
      continue;
    }
    if (arg === "--output" && next) {
      outputPath = next;
      i += 1;
      continue;
    }

    if (!arg.startsWith("--")) {
      query = arg;
    }
  }

  return {
    query,
    limit: Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT,
    concurrency:
      Number.isFinite(concurrency) && concurrency > 0
        ? concurrency
        : DEFAULT_CONCURRENCY,
    userId,
    urls,
    outputPath,
  };
}

function loadLocalEnv() {
  for (const filename of [".env", ".env.local"]) {
    const filePath = path.join(process.cwd(), filename);
    if (!fs.existsSync(filePath)) continue;

    const contents = fs.readFileSync(filePath, "utf8");
    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const separatorIndex = line.indexOf("=");
      if (separatorIndex <= 0) continue;

      const key = line.slice(0, separatorIndex).trim();
      if (process.env[key]) continue;

      let value = line.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  }
}

async function pickDefaultUserId(): Promise<string | undefined> {
  const { db, userLlmCredentials, users } = getRuntimeDeps();
  const [row] = await db
    .select({
      userId: userLlmCredentials.userId,
      email: users.email,
      validationStatus: userLlmCredentials.validationStatus,
      updatedAt: userLlmCredentials.updatedAt,
    })
    .from(userLlmCredentials)
    .innerJoin(users, eq(users.id, userLlmCredentials.userId))
    .orderBy(desc(userLlmCredentials.updatedAt))
    .limit(1);

  if (row) {
    console.log(
      `Using latest connected user: ${row.userId} (${row.email}, ${row.validationStatus})`
    );
  }

  return row?.userId;
}

async function discoverSources(query: string, limit: number): Promise<InputSource[]> {
  const { discoverScholarlySources } = getRuntimeDeps();
  const discovered = await discoverScholarlySources({
    query,
    numResults: limit,
    queryVariations: DEFAULT_QUERY_VARIATIONS,
  });

  return discovered.map((source) => ({
    title: source.title,
    url: source.url,
    pdfUrl: source.pdfUrl,
    providers: source.providers ?? [source.provider],
  }));
}

function buildDirectSources(urls: string[]): InputSource[] {
  return urls.map((url) => {
    const pathname = safePathname(url);
    const inferredPdf = pathname.toLowerCase().endsWith(".pdf");

    return {
      title: inferTitleFromUrl(url),
      url,
      pdfUrl: inferredPdf ? url : undefined,
      providers: ["direct"],
    };
  });
}

async function diagnoseSource(
  index: number,
  source: InputSource
): Promise<SourceDiagnostic> {
  const { ingestDiscoveredSource, generateId } = getRuntimeDeps();
  const candidateUrls = uniqueUrls([source.pdfUrl, source.url]);
  const fetchAttempts: FetchAttempt[] = [];

  for (const candidateUrl of candidateUrls) {
    fetchAttempts.push(await attemptFetch(candidateUrl));
  }

  let diagnostic: SourceDiagnostic;

  try {
    const ingested = await ingestDiscoveredSource({
      sourceId: generateId(),
      title: source.title,
      sourceUrl: source.url,
      pdfUrl: source.pdfUrl,
    });

    const parseStatus = ingested.source.parseStatus;
    const parseError = ingested.source.metadata?.parseError;
    diagnostic = {
      index,
      title: source.title,
      url: source.url,
      pdfUrl: source.pdfUrl,
      providers: source.providers,
      fetchAttempts,
      finalStatus: parseStatus === "parsed" ? "parsed" : "failed",
      parseStatus,
      parseEngine: ingested.source.metadata?.parseEngine,
      parseQuality: ingested.source.metadata?.parseQuality,
      resolvedUrl: ingested.source.metadata?.resolvedUrl,
      chunkCount: ingested.sourceChunks.length,
      charCount: ingested.parsedSource?.charCount,
      parseDiagnostics: ingested.source.metadata?.parseDiagnostics,
      winnerStage:
        ingested.source.metadata?.parseDiagnostics
          ?.filter((attempt) => attempt.ok)
          .at(-1)?.stage,
      failurePhase:
        parseStatus === "failed" ? classifyFailurePhase(parseError) : undefined,
      failureReason: parseStatus === "failed" ? parseError : undefined,
    };
  } catch (error) {
    const message = (error as Error)?.message ?? "Unknown ingest failure";
    diagnostic = {
      index,
      title: source.title,
      url: source.url,
      pdfUrl: source.pdfUrl,
      providers: source.providers,
      fetchAttempts,
      finalStatus: "failed",
      failurePhase: classifyFailurePhase(message),
      failureReason: message,
    };
  }

  const icon = diagnostic.finalStatus === "parsed" ? "OK" : "FAIL";
  const detail =
    diagnostic.finalStatus === "parsed"
      ? `${diagnostic.parseEngine ?? "unknown"} / ${diagnostic.chunkCount ?? 0} chunks`
      : `${diagnostic.failurePhase ?? "unknown"}: ${truncate(
          diagnostic.failureReason ?? "Unknown failure",
          120
        )}`;
  console.log(
    `${icon} ${String(index + 1).padStart(2)}. ${truncate(source.title, 72)} - ${detail}`
  );

  return diagnostic;
}

async function attemptFetch(url: string): Promise<FetchAttempt> {
  const { fetchSourceBytes } = getRuntimeDeps();
  const startedAt = Date.now();

  try {
    const result = await fetchSourceBytes(url);
    return {
      url,
      status: "ok",
      contentType: result.contentType,
      bytes: result.buffer.length,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      url,
      status: "failed",
      durationMs: Date.now() - startedAt,
      error: (error as Error)?.message ?? "Unknown fetch failure",
    };
  }
}

function printReport(report: AttritionReport) {
  console.log("\n=== Summary ===");
  console.log(`Parsed: ${report.parsedCount}/${report.discoveredCount}`);
  console.log(`Failed: ${report.failedCount}/${report.discoveredCount}`);

  if (Object.keys(report.byPhase).length > 0) {
    console.log("\nFailures by phase:");
    for (const [phase, count] of Object.entries(report.byPhase)) {
      console.log(`  ${phase}: ${count}`);
    }
  }

  if (Object.keys(report.byParseEngine).length > 0) {
    console.log("\nParse engines:");
    for (const [engine, count] of Object.entries(report.byParseEngine)) {
      console.log(`  ${engine}: ${count}`);
    }
  }

  if (Object.keys(report.byParseQuality).length > 0) {
    console.log("\nParse quality:");
    for (const [quality, count] of Object.entries(report.byParseQuality)) {
      console.log(`  ${quality}: ${count}`);
    }
  }

  if (Object.keys(report.byWinnerStage).length > 0) {
    console.log("\nWinning stages:");
    for (const [stage, count] of Object.entries(report.byWinnerStage)) {
      console.log(`  ${stage}: ${count}`);
    }
  }

  if (Object.keys(report.byWinnerFamily).length > 0) {
    console.log("\nWinning families:");
    for (const [family, count] of Object.entries(report.byWinnerFamily)) {
      console.log(`  ${family}: ${count}`);
    }
  }
}

function writeReport(report: AttritionReport, outputPath: string) {
  const absolutePath = path.isAbsolute(outputPath)
    ? outputPath
    : path.join(process.cwd(), outputPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, JSON.stringify(report, null, 2), "utf8");
  console.log(`\nFull report: ${absolutePath}`);
}

function uniqueUrls(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function inferTitleFromUrl(url: string) {
  const pathname = safePathname(url);
  const slug = pathname.split("/").pop() || url;
  return slug.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim() || url;
}

function safePathname(url: string) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function truncate(text: string, maxLength: number) {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3)}...`;
}

async function loadRuntimeDeps(): Promise<RuntimeDeps> {
  const [{ discoverScholarlySources }, clientModule, schemaModule, ingestModule, accessModule, runtimeModule, asyncModule, idModule] =
    await Promise.all([
      import("../lib/discovery/scholarly-search"),
      import("../lib/db/client"),
      import("../lib/db/schema"),
      import("../lib/ingest/source-ingestion"),
      import("../lib/llm/openai-access"),
      import("../lib/llm/runtime"),
      import("../lib/utils/async"),
      import("../lib/utils/id"),
    ]);

  return {
    db: clientModule.db,
    userLlmCredentials: schemaModule.userLlmCredentials,
    users: schemaModule.users,
    discoverScholarlySources,
    fetchSourceBytes: ingestModule.fetchSourceBytes,
    ingestDiscoveredSource: ingestModule.ingestDiscoveredSource,
    ensureOpenAIProviderAccess: accessModule.ensureOpenAIProviderAccess,
    runWithRequestProvider: runtimeModule.runWithRequestProvider,
    allSettledWithConcurrency: asyncModule.allSettledWithConcurrency,
    generateId: idModule.generateId,
  };
}

function getRuntimeDeps() {
  if (!runtimeDeps) {
    throw new Error("Runtime dependencies not loaded");
  }

  return runtimeDeps;
}
