/**
 * PDF text extraction: local pdfjs-dist extraction → LLM normalization.
 * Works with the active OpenAI-auth provider via callLLM.
 */

import { callLLM } from "@/lib/llm/runtime";
import type { LLMProvider } from "@/lib/llm/provider";
import {
  createConcurrencyLimiter,
  RetryableRequestError,
  TimeoutError,
  retryAsync,
  withTimeout,
} from "@/lib/utils/async";
import {
  buildPdfJsServerOptions,
  resolvePdfJsAssetPaths,
} from "@/lib/pdf/pdfjs-assets";

export const EXTRACTION_PROMPT = `Read this extracted text from a research paper and produce a faithful, condensed representation of it in markdown.

YOUR CORE OBLIGATION: Preserve the paper's complete logical flow. The reader of your output should follow the exact same chain of reasoning as the reader of the original — from motivation through methodology through evidence to conclusions. Nothing added, nothing distorted.

You may rephrase for clarity and conciseness, but you must NEVER:
- Change the meaning or emphasis of any claim
- Omit a step in the argument's logical chain
- Alter, round, or paraphrase any quantitative data
- Add your own interpretation or analysis
- Invent section headers like "Summary", "Key Claims", or "Contribution"

You SHOULD:
- Condense verbose or repetitive prose into tighter language while preserving meaning
- Drop generic background that explains well-known concepts
- Drop transitions and signposting
- Drop bibliography list, acknowledgments, author bios, copyright notices
- Keep the paper's own section structure as markdown headings

WHAT MUST BE PRESERVED:
- The complete argument chain: question → hypothesis → method → evidence → interpretation → conclusion
- Every step of reasoning that connects one claim to the next
- ALL quantitative data exactly as written: numbers, p-values, effect sizes, CIs, sample sizes, metrics
- ALL results including null, negative, and unexpected findings
- ALL limitations, caveats, and boundary conditions the authors state
- Key comparisons to prior work with citation markers preserved exactly (e.g., [1], [Smith et al., 2024])
- Tables (in markdown format), equations (in LaTeX), and figure captions that contain data

Think of it this way: if someone read only your output and then described the paper's argument, they should get it exactly right — same claims, same evidence, same caveats, same logical structure. Just shorter and cleaner.`;

export const DIRECT_PDF_EXTRACTION_PROMPT = `Read the attached PDF of a research paper and extract its readable content directly into well-structured markdown.

YOUR CORE OBLIGATION: Preserve the paper's complete logical flow. The reader of your output should be able to follow the same chain of reasoning as the original paper.

You must:
- Preserve the paper's heading structure using markdown headings
- Preserve quantitative values exactly as written
- Preserve citations exactly as written
- Preserve tables as markdown when possible
- Preserve figure/table captions when they carry substantive content
- Preserve limitations and caveats
- Preserve equations in LaTeX when present

You must not:
- Summarize, interpret, or editorialize
- Invent headings that are not supported by the paper
- Drop negative, null, or contradictory findings
- Add commentary outside the extracted paper content

Output ONLY the extracted markdown text.`;

export interface ParseResult {
  text: string;
  pageCount: number;
}

const DEFAULT_PARSE_TIMEOUT_MS = 45_000;
const DEFAULT_PARSE_RETRIES = 0;
const PDFJS_WORKER_SPECIFIER = "pdfjs-dist/legacy/build/pdf.worker.mjs";
const withLocalPdfParseLimit = createConcurrencyLimiter(4);
const withModelParseLimit = createConcurrencyLimiter(2);

const globalForPdfJsWorker = globalThis as typeof globalThis & {
  pdfjsWorker?: { WorkerMessageHandler?: unknown };
  __lumenPdfJsWorkerReady?: string;
  __lumenPdfJsWorkerPromise?: Promise<void>;
};

export function getPdfJsWorkerSpecifier() {
  return PDFJS_WORKER_SPECIFIER;
}

export async function ensurePdfJsWorkerConfigured(pdfjsLib: {
  GlobalWorkerOptions: { workerSrc?: string };
}) {
  const workerSrc = getPdfJsWorkerSpecifier();
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

  if (
    globalForPdfJsWorker.__lumenPdfJsWorkerReady === workerSrc &&
    globalForPdfJsWorker.pdfjsWorker?.WorkerMessageHandler
  ) {
    return;
  }

  if (!globalForPdfJsWorker.__lumenPdfJsWorkerPromise) {
    globalForPdfJsWorker.__lumenPdfJsWorkerPromise = import("pdfjs-dist/legacy/build/pdf.worker.mjs")
      .then((workerModule) => {
        globalForPdfJsWorker.pdfjsWorker = {
          ...(globalForPdfJsWorker.pdfjsWorker ?? {}),
          WorkerMessageHandler: workerModule.WorkerMessageHandler,
        };
        globalForPdfJsWorker.__lumenPdfJsWorkerReady = workerSrc;
      })
      .finally(() => {
        globalForPdfJsWorker.__lumenPdfJsWorkerPromise = undefined;
      });
  }

  await globalForPdfJsWorker.__lumenPdfJsWorkerPromise;
}

async function getPdfDocument(buffer: Buffer) {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  await ensurePdfJsWorkerConfigured(pdfjsLib);

  const data = new Uint8Array(buffer);
  const assetPaths = resolvePdfJsAssetPaths();
  return withLocalPdfParseLimit(async () =>
    pdfjsLib.getDocument(
      buildPdfJsServerOptions({
        data,
        assetPaths,
        verbosity: pdfjsLib.VerbosityLevel.ERRORS,
      })
    ).promise
  );
}

export async function getPdfPageCount(buffer: Buffer): Promise<number> {
  const doc = await getPdfDocument(buffer);
  try {
    return doc.numPages;
  } finally {
    await doc.destroy();
  }
}

/**
 * Extract raw text from a PDF buffer using pdfjs-dist (local, no API needed).
 */
export async function extractPdfTextLocally(
  buffer: Buffer
): Promise<{ text: string; pageCount: number }> {
  const doc = await getPdfDocument(buffer);
  const pageCount = doc.numPages;

  const pages: string[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => item.str ?? "")
      .join(" ");
    pages.push(pageText);
  }

  await doc.destroy();
  return { text: pages.join("\n\n"), pageCount };
}

export async function extractPdfTextWithModelDirectly(
  buffer: Buffer,
  filename: string,
  options: {
    model?: string;
    provider?: LLMProvider;
    timeoutMs?: number;
    retries?: number;
  } = {}
): Promise<string> {
  if (!buffer.length) {
    throw new Error(`PDF buffer is empty for "${filename}"`);
  }

  return extractPdfTextWithModelInput(
    [
      {
        type: "input_file" as const,
        filename,
        file_data: buffer.toString("base64"),
      },
      {
        type: "input_text" as const,
        text: "Extract the full paper text into faithful markdown.",
      },
    ],
    filename,
    options
  );
}

export async function extractPdfTextWithModelFromUrl(
  fileUrl: string,
  filename: string,
  options: {
    model?: string;
    provider?: LLMProvider;
    timeoutMs?: number;
    retries?: number;
  } = {}
): Promise<string> {
  if (!fileUrl.trim()) {
    throw new Error(`PDF URL is empty for "${filename}"`);
  }

  return extractPdfTextWithModelInput(
    [
      {
        type: "input_file" as const,
        file_url: fileUrl,
      },
      {
        type: "input_text" as const,
        text: "Extract the full paper text into faithful markdown.",
      },
    ],
    filename,
    options
  );
}

async function extractPdfTextWithModelInput(
  content: Array<
    | {
        type: "input_file";
        filename?: string;
        file_data?: string;
        file_url?: string;
      }
    | {
        type: "input_text";
        text: string;
      }
  >,
  filename: string,
  options: {
    model?: string;
    provider?: LLMProvider;
    timeoutMs?: number;
    retries?: number;
  } = {}
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_PARSE_TIMEOUT_MS;
  const retries = options.retries ?? DEFAULT_PARSE_RETRIES;

  const llmOptions = {
    model: options.model ?? "gpt-5.4-mini",
    messages: [
      { role: "system" as const, content: DIRECT_PDF_EXTRACTION_PROMPT },
      {
        role: "user" as const,
        content,
      },
    ],
    temperature: 0,
    maxTokens: 16384,
  };

  const response = await retryAsync({
    retries,
    shouldRetry: (error) =>
      error instanceof RetryableRequestError ||
      error instanceof TimeoutError ||
      error instanceof TypeError,
    getDelayMs: (attempt) => 1000 * attempt,
    operation: async () =>
      withModelParseLimit(() =>
        withTimeout(
          async () =>
            options.provider
              ? options.provider.callLLM(llmOptions)
              : callLLM({ ...llmOptions, timeoutMs }),
          timeoutMs,
          `Direct PDF extraction timed out for "${filename}" after ${Math.round(timeoutMs / 1000)}s`
        )
      ),
  });

  if (!response.content || response.content.length < 100) {
    throw new Error("Direct PDF extraction returned empty or near-empty result");
  }

  return response.content;
}

/**
 * Normalize already-extracted PDF text via an explicit provider or the active
 * request-scoped/default provider.
 */
export async function normalizeExtractedPdfText(
  rawText: string,
  filename: string,
  options: {
    model?: string;
    provider?: LLMProvider;
    // Legacy options kept for compat but no longer used
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    retries?: number;
  } = {}
): Promise<string> {
  if (!rawText || rawText.trim().length < 50) {
    throw new Error(`PDF extraction returned minimal text for "${filename}" (${rawText.length} chars)`);
  }

  // Step 2: Normalize via LLM (uses request-scoped provider if set, else server default)
  // Truncate to ~30k chars to stay within context limits
  const truncated = rawText.slice(0, 30000);
  const timeoutMs = options.timeoutMs ?? DEFAULT_PARSE_TIMEOUT_MS;
  const retries = options.retries ?? DEFAULT_PARSE_RETRIES;

  const llmOptions = {
    model: options.model ?? "google/gemini-2.5-flash-lite", // maps to gpt-5.4-mini for Codex users
    messages: [
      { role: "system" as const, content: EXTRACTION_PROMPT },
      {
        role: "user" as const,
        content: `[Source: ${filename}]\n\n${truncated}`,
      },
    ],
    temperature: 0,
    maxTokens: 16384,
  };

  const response = await retryAsync({
    retries,
    shouldRetry: (error) =>
      error instanceof RetryableRequestError ||
      error instanceof TimeoutError ||
      error instanceof TypeError,
    getDelayMs: (attempt) => 1000 * attempt,
    operation: async () =>
      withModelParseLimit(() =>
        withTimeout(
          async () =>
            options.provider
              ? options.provider.callLLM(llmOptions)
              : callLLM({ ...llmOptions, timeoutMs }),
          timeoutMs,
          `PDF normalization timed out for "${filename}" after ${Math.round(timeoutMs / 1000)}s`
        )
      ),
  });

  if (!response.content || response.content.length < 100) {
    throw new Error("LLM normalization returned empty or near-empty result");
  }

  return response.content;
}

/**
 * Parse a PDF: extract text locally, then normalize via an explicit provider or
 * the active request-scoped/default provider.
 */
export async function parsePDF(
  buffer: Buffer,
  filename: string,
  options: {
    model?: string;
    provider?: LLMProvider;
    // Legacy options kept for compat but no longer used
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    retries?: number;
  } = {}
): Promise<ParseResult> {
  const { text: rawText, pageCount } = await extractPdfTextLocally(buffer);

  return {
    text: await normalizeExtractedPdfText(rawText, filename, options),
    pageCount,
  };
}
