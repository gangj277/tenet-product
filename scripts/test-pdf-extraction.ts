/**
 * PDF extraction diagnostic using the real OpenAI-auth runtime provider.
 *
 * This script resolves a user by email or user id, loads the stored Codex/OpenAI
 * credentials for that user, and exercises the current PDF pipeline:
 *
 *   1. Fetch PDF bytes
 *   2. Extract raw text locally via pdfjs
 *   3. Normalize that raw text via gpt-5.4-mini using the user's provider
 *   4. Run the full parsePDF path for comparison
 *
 * Usage:
 *   npx tsx scripts/test-pdf-extraction.ts --email gangj277@gmail.com
 *   npx tsx scripts/test-pdf-extraction.ts --email gangj277@gmail.com --url https://arxiv.org/pdf/2312.10997.pdf
 *   npx tsx scripts/test-pdf-extraction.ts --user-id <uuid> --file /absolute/path/paper.pdf
 */

import fs from "node:fs";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { desc, eq } from "drizzle-orm";

const DEFAULT_EMAIL = "gangj277@gmail.com";
const DEFAULT_MODEL = "gpt-5.4-mini";
const DEFAULT_URL = "https://arxiv.org/pdf/2312.10997.pdf";
const DEFAULT_OUTPUT_DIR = "artifacts/diagnostics/pdf-extraction";
const NORMALIZATION_TIMEOUT_MS = 120_000;

interface CliOptions {
  email?: string;
  userId?: string;
  url?: string;
  filePath?: string;
  model: string;
  outputDir: string;
}

interface ResolvedUser {
  userId: string;
  email: string;
  validationStatus: string;
  validatedAt?: string | null;
  capabilities: Record<string, boolean>;
}

interface LoadedPdf {
  label: string;
  buffer: Buffer;
  sourceType: "url" | "file";
  contentType?: string;
  resolvedUrl?: string;
}

interface RuntimeDeps {
  db: typeof import("../lib/db/client").db;
  users: typeof import("../lib/db/schema").users;
  userLlmCredentials: typeof import("../lib/db/schema").userLlmCredentials;
  fetchSourceBytes: typeof import("../lib/ingest/source-ingestion").fetchSourceBytes;
  extractPdfTextLocally: typeof import("../lib/pdf/gemini-extract").extractPdfTextLocally;
  extractPdfTextWithModelDirectly: typeof import("../lib/pdf/gemini-extract").extractPdfTextWithModelDirectly;
  extractPdfTextWithModelFromUrl: typeof import("../lib/pdf/gemini-extract").extractPdfTextWithModelFromUrl;
  normalizeExtractedPdfText: typeof import("../lib/pdf/gemini-extract").normalizeExtractedPdfText;
  parsePDF: typeof import("../lib/pdf/gemini-extract").parsePDF;
  validateNormalizedDocument: typeof import("../lib/ingest/document-quality").validateNormalizedDocument;
  chunkDocument: typeof import("../lib/ingest/chunk-document").chunkDocument;
  ensureOpenAIProviderAccess: typeof import("../lib/llm/openai-access").ensureOpenAIProviderAccess;
}

let runtimeDeps: RuntimeDeps | null = null;

void main().catch((error) => {
  console.error(`Fatal: ${(error as Error).message}`);
  process.exit(1);
});

async function main() {
  loadLocalEnv();
  runtimeDeps = await loadRuntimeDeps();

  const options = parseArgs(process.argv.slice(2));
  const user = await resolveUser(options);
  const provider = await getRuntimeDeps().ensureOpenAIProviderAccess(user.userId);
  const pdf = await loadPdf(options);

  console.log("\n=== PDF Extraction Diagnostic ===");
  console.log(`User: ${user.email} (${user.userId})`);
  console.log(`Credential status: ${user.validationStatus}`);
  console.log(`Capabilities: ${formatCapabilities(user.capabilities)}`);
  if (user.validatedAt) {
    console.log(`Validated at: ${user.validatedAt}`);
  }
  console.log(`Model: ${options.model}`);
  console.log(`Input: ${pdf.label}`);
  if (pdf.resolvedUrl) {
    console.log(`Resolved URL: ${pdf.resolvedUrl}`);
  }
  if (pdf.contentType) {
    console.log(`Content-Type: ${pdf.contentType}`);
  }
  console.log(`Bytes: ${pdf.buffer.length.toLocaleString()}`);

  const outputDir = prepareOutputDir(options.outputDir, pdf.label);

  const rawStart = Date.now();
  const raw = await getRuntimeDeps().extractPdfTextLocally(pdf.buffer);
  const rawDurationMs = Date.now() - rawStart;
  const rawOutputPath = path.join(outputDir, "01-raw-local.txt");
  fs.writeFileSync(rawOutputPath, raw.text, "utf8");

  const directByteStart = Date.now();
  let directBytesError: string | null = null;
  let directBytesText: string | null = null;
  let directBytesValidation:
    | ReturnType<RuntimeDeps["validateNormalizedDocument"]>
    | null = null;
  let directBytesChunks = 0;
  let directBytesOutputPath: string | null = null;
  try {
    directBytesText = await getRuntimeDeps().extractPdfTextWithModelDirectly(
      pdf.buffer,
      pdf.label,
      {
        model: options.model,
        provider,
        timeoutMs: NORMALIZATION_TIMEOUT_MS,
        retries: 0,
      }
    );
    directBytesValidation =
      getRuntimeDeps().validateNormalizedDocument(directBytesText);
    directBytesChunks = getRuntimeDeps().chunkDocument({
      sourceId: "diagnostic-source",
      sourceName: pdf.label,
      normalizedBlobKeyPrefix: "diagnostic-source",
      text: directBytesText,
    }).length;
    directBytesOutputPath = path.join(outputDir, "02-direct-input-file-gpt-5.4-mini.md");
    fs.writeFileSync(directBytesOutputPath, directBytesText, "utf8");
  } catch (error) {
    directBytesError = (error as Error).message;
  }
  const directByteDurationMs = Date.now() - directByteStart;

  const directUrlStart = Date.now();
  let directUrlText: string | null = null;
  let directUrlError: string | null = null;
  let directUrlValidation:
    | ReturnType<RuntimeDeps["validateNormalizedDocument"]>
    | null = null;
  let directUrlChunks = 0;
  let directUrlOutputPath: string | null = null;
  if (pdf.resolvedUrl) {
    try {
      directUrlText = await getRuntimeDeps().extractPdfTextWithModelFromUrl(
        pdf.resolvedUrl,
        pdf.label,
        {
          model: options.model,
          provider,
          timeoutMs: NORMALIZATION_TIMEOUT_MS,
          retries: 0,
        }
      );
      directUrlValidation =
        getRuntimeDeps().validateNormalizedDocument(directUrlText);
      directUrlChunks = getRuntimeDeps().chunkDocument({
        sourceId: "diagnostic-source",
        sourceName: pdf.label,
        normalizedBlobKeyPrefix: "diagnostic-source",
        text: directUrlText,
      }).length;
      directUrlOutputPath = path.join(outputDir, "03-direct-file-url-gpt-5.4-mini.md");
      fs.writeFileSync(directUrlOutputPath, directUrlText, "utf8");
    } catch (error) {
      directUrlError = (error as Error).message;
    }
  }
  const directUrlDurationMs = Date.now() - directUrlStart;

  const normalizationStart = Date.now();
  const normalizedFromRawText = await getRuntimeDeps().normalizeExtractedPdfText(
    raw.text,
    pdf.label,
    {
      model: options.model,
      provider,
      timeoutMs: NORMALIZATION_TIMEOUT_MS,
      retries: 0,
    }
  );
  const normalizationDurationMs = Date.now() - normalizationStart;
  const normalizedValidation =
    getRuntimeDeps().validateNormalizedDocument(normalizedFromRawText);
  const normalizedChunks = getRuntimeDeps().chunkDocument({
    sourceId: "diagnostic-source",
    sourceName: pdf.label,
    normalizedBlobKeyPrefix: "diagnostic-source",
    text: normalizedFromRawText,
  });
  const normalizedOutputPath = path.join(outputDir, "04-normalized-from-local-text-gpt-5.4-mini.md");
  fs.writeFileSync(normalizedOutputPath, normalizedFromRawText, "utf8");

  const fullParseStart = Date.now();
  const parsed = await getRuntimeDeps().parsePDF(pdf.buffer, pdf.label, {
    model: options.model,
    provider,
    timeoutMs: NORMALIZATION_TIMEOUT_MS,
    retries: 0,
  });
  const fullParseDurationMs = Date.now() - fullParseStart;
  const fullParseOutputPath = path.join(outputDir, "05-full-parse-path.md");
  fs.writeFileSync(fullParseOutputPath, parsed.text, "utf8");

  const summary = {
    generatedAt: new Date().toISOString(),
    user: {
      userId: user.userId,
      email: user.email,
      validationStatus: user.validationStatus,
      validatedAt: user.validatedAt ?? null,
      capabilities: user.capabilities,
    },
    input: {
      sourceType: pdf.sourceType,
      label: pdf.label,
      resolvedUrl: pdf.resolvedUrl ?? null,
      contentType: pdf.contentType ?? null,
      bytes: pdf.buffer.length,
    },
    rawLocalExtraction: {
      pageCount: raw.pageCount,
      charCount: raw.text.length,
      durationMs: rawDurationMs,
      outputPath: rawOutputPath,
    },
    directModelExtractionFromBytes: {
      model: options.model,
      charCount: directBytesText?.length ?? null,
      durationMs: directByteDurationMs,
      validationOk: directBytesValidation?.ok ?? false,
      validationReason: directBytesValidation?.reason ?? null,
      chunkCount: directBytesChunks,
      outputPath: directBytesOutputPath,
      error: directBytesError,
    },
    directModelExtractionFromUrl: {
      model: options.model,
      charCount: directUrlText?.length ?? null,
      durationMs: directUrlDurationMs,
      validationOk: directUrlValidation?.ok ?? false,
      validationReason: directUrlValidation?.reason ?? null,
      chunkCount: directUrlChunks,
      outputPath: directUrlOutputPath,
      error: directUrlError,
    },
    llmNormalizationFromLocalText: {
      model: options.model,
      charCount: normalizedFromRawText.length,
      durationMs: normalizationDurationMs,
      validationOk: normalizedValidation.ok,
      validationReason: normalizedValidation.reason ?? null,
      chunkCount: normalizedChunks.length,
      outputPath: normalizedOutputPath,
    },
    fullParsePath: {
      pageCount: parsed.pageCount,
      charCount: parsed.text.length,
      durationMs: fullParseDurationMs,
      outputPath: fullParseOutputPath,
    },
  };
  const summaryPath = path.join(outputDir, "summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");

  console.log("\n=== Results ===");
  console.log(
    `Raw local extraction: ${formatMs(rawDurationMs)} | ${raw.pageCount} pages | ${raw.text.length.toLocaleString()} chars`
  );
  console.log(
    `Direct bytes extract: ${formatMs(directByteDurationMs)} | ${directBytesText ? `${directBytesText.length.toLocaleString()} chars` : `failed (${directBytesError})`}`
  );
  if (pdf.resolvedUrl) {
    console.log(
      `Direct URL extract:   ${formatMs(directUrlDurationMs)} | ${directUrlText ? `${directUrlText.length.toLocaleString()} chars` : `failed (${directUrlError})`}`
    );
  }
  console.log(
    `Raw-text normalize:   ${formatMs(normalizationDurationMs)} | ${normalizedFromRawText.length.toLocaleString()} chars | ${normalizedValidation.ok ? "valid" : `invalid (${normalizedValidation.reason})`}`
  );
  console.log(
    `Full parse path:      ${formatMs(fullParseDurationMs)} | ${parsed.pageCount} pages | ${parsed.text.length.toLocaleString()} chars`
  );
  console.log(`Output dir: ${outputDir}`);
  console.log(`Summary:    ${summaryPath}`);
}

function parseArgs(argv: string[]): CliOptions {
  let email: string | undefined = DEFAULT_EMAIL;
  let userId: string | undefined;
  let url: string | undefined = DEFAULT_URL;
  let filePath: string | undefined;
  let model = DEFAULT_MODEL;
  let outputDir = DEFAULT_OUTPUT_DIR;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--email" && next) {
      email = next.trim().toLowerCase();
      i += 1;
      continue;
    }
    if (arg === "--user-id" && next) {
      userId = next;
      i += 1;
      continue;
    }
    if (arg === "--url" && next) {
      url = next;
      filePath = undefined;
      i += 1;
      continue;
    }
    if (arg === "--file" && next) {
      filePath = path.resolve(next);
      url = undefined;
      i += 1;
      continue;
    }
    if (arg === "--model" && next) {
      model = next;
      i += 1;
      continue;
    }
    if (arg === "--output-dir" && next) {
      outputDir = next;
      i += 1;
      continue;
    }
  }

  return { email, userId, url, filePath, model, outputDir };
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

async function loadRuntimeDeps(): Promise<RuntimeDeps> {
  const [{ db }, { users, userLlmCredentials }, ingest, pdf, quality, chunk, access] =
    await Promise.all([
      import("../lib/db/client"),
      import("../lib/db/schema"),
      import("../lib/ingest/source-ingestion"),
      import("../lib/pdf/gemini-extract"),
      import("../lib/ingest/document-quality"),
      import("../lib/ingest/chunk-document"),
      import("../lib/llm/openai-access"),
    ]);

  return {
    db,
    users,
    userLlmCredentials,
    fetchSourceBytes: ingest.fetchSourceBytes,
    extractPdfTextLocally: pdf.extractPdfTextLocally,
    extractPdfTextWithModelDirectly: pdf.extractPdfTextWithModelDirectly,
    extractPdfTextWithModelFromUrl: pdf.extractPdfTextWithModelFromUrl,
    normalizeExtractedPdfText: pdf.normalizeExtractedPdfText,
    parsePDF: pdf.parsePDF,
    validateNormalizedDocument: quality.validateNormalizedDocument,
    chunkDocument: chunk.chunkDocument,
    ensureOpenAIProviderAccess: access.ensureOpenAIProviderAccess,
  };
}

function getRuntimeDeps(): RuntimeDeps {
  if (!runtimeDeps) {
    throw new Error("Runtime dependencies are not loaded.");
  }
  return runtimeDeps;
}

async function resolveUser(options: CliOptions): Promise<ResolvedUser> {
  const { db, users, userLlmCredentials } = getRuntimeDeps();

  if (options.userId) {
    const [row] = await db
      .select({
        userId: users.id,
        email: users.email,
        validationStatus: userLlmCredentials.validationStatus,
        validatedAt: userLlmCredentials.validatedAt,
        capabilities: userLlmCredentials.capabilities,
      })
      .from(users)
      .innerJoin(userLlmCredentials, eq(users.id, userLlmCredentials.userId))
      .where(eq(users.id, options.userId))
      .limit(1);

    if (!row) {
      throw new Error(`No connected OpenAI-auth credentials found for user id ${options.userId}.`);
    }

    return {
      userId: row.userId,
      email: row.email,
      validationStatus: row.validationStatus,
      validatedAt: row.validatedAt?.toISOString() ?? null,
      capabilities: row.capabilities ?? {},
    };
  }

  if (options.email) {
    const normalizedEmail = options.email.trim().toLowerCase();
    const [row] = await db
      .select({
        userId: users.id,
        email: users.email,
        validationStatus: userLlmCredentials.validationStatus,
        validatedAt: userLlmCredentials.validatedAt,
        capabilities: userLlmCredentials.capabilities,
      })
      .from(users)
      .innerJoin(userLlmCredentials, eq(users.id, userLlmCredentials.userId))
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!row) {
      throw new Error(`No connected OpenAI-auth credentials found for ${normalizedEmail}.`);
    }

    return {
      userId: row.userId,
      email: row.email,
      validationStatus: row.validationStatus,
      validatedAt: row.validatedAt?.toISOString() ?? null,
      capabilities: row.capabilities ?? {},
    };
  }

  const [row] = await db
    .select({
      userId: userLlmCredentials.userId,
      email: users.email,
      validationStatus: userLlmCredentials.validationStatus,
      validatedAt: userLlmCredentials.validatedAt,
      capabilities: userLlmCredentials.capabilities,
    })
    .from(userLlmCredentials)
    .innerJoin(users, eq(users.id, userLlmCredentials.userId))
    .orderBy(desc(userLlmCredentials.updatedAt))
    .limit(1);

  if (!row) {
    throw new Error("No connected OpenAI-auth credentials found.");
  }

  return {
    userId: row.userId,
    email: row.email,
    validationStatus: row.validationStatus,
    validatedAt: row.validatedAt?.toISOString() ?? null,
    capabilities: row.capabilities ?? {},
  };
}

async function loadPdf(options: CliOptions): Promise<LoadedPdf> {
  if (options.filePath) {
    const buffer = await readFile(options.filePath);
    return {
      label: path.basename(options.filePath),
      buffer,
      sourceType: "file",
    };
  }

  const url = options.url ?? DEFAULT_URL;
  const fetched = await getRuntimeDeps().fetchSourceBytes(url);
  const pathname = safePathname(fetched.resolvedUrl || url);

  return {
    label: path.basename(pathname) || "paper.pdf",
    buffer: fetched.buffer,
    sourceType: "url",
    contentType: fetched.contentType,
    resolvedUrl: fetched.resolvedUrl,
  };
}

function prepareOutputDir(baseOutputDir: string, label: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = label
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "paper";
  const absolute = path.isAbsolute(baseOutputDir)
    ? baseOutputDir
    : path.join(process.cwd(), baseOutputDir);
  const outputDir = path.join(absolute, `${timestamp}-${slug}`);
  fs.mkdirSync(outputDir, { recursive: true });
  return outputDir;
}

function safePathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function formatMs(value: number): string {
  if (value < 1000) return `${value}ms`;
  return `${(value / 1000).toFixed(2)}s`;
}

function formatCapabilities(capabilities: Record<string, boolean>): string {
  const enabled = Object.entries(capabilities)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key);
  return enabled.length > 0 ? enabled.join(", ") : "none";
}
