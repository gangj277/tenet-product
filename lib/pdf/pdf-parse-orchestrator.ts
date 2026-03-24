import type { LLMProvider } from "@/lib/llm/provider";
import {
  extractPdfTextLocally,
  extractPdfTextWithModelDirectly,
  extractPdfTextWithModelFromUrl,
  normalizeExtractedPdfText,
} from "@/lib/pdf/gemini-extract";
import {
  validateNormalizedDocument,
  validateRawExtractedPdfText,
} from "@/lib/ingest/document-quality";
import type { PdfParseAttempt } from "@/lib/engine/state";

export const DEFAULT_DIRECT_PDF_MODEL = "gpt-5.4-mini";
export const DEFAULT_DIRECT_BYTES_MAX_BYTES = 20 * 1024 * 1024;

export interface ParsePdfWithFallbacksOptions {
  resolvedUrl?: string;
  provider?: LLMProvider;
  primaryModel?: string;
  fallbackModel?: string;
  directModel?: string;
  directBytesMaxBytes?: number;
}

export interface PdfParseFallbackSuccess {
  ok: true;
  text: string;
  pageCount: number;
  parseEngine: string;
  parseAttempts: number;
  parseQuality: "validated" | "fallback_validated";
  attempts: PdfParseAttempt[];
  winnerStage: PdfParseAttempt["stage"];
}

export interface PdfParseFallbackFailure {
  ok: false;
  parseEngine: string;
  parseAttempts: number;
  parseQuality: "rejected";
  parseError: string;
  attempts: PdfParseAttempt[];
}

export type PdfParseFallbackResult =
  | PdfParseFallbackSuccess
  | PdfParseFallbackFailure;

export async function parsePdfWithFallbacks(
  buffer: Buffer,
  filename: string,
  options: ParsePdfWithFallbacksOptions = {}
): Promise<PdfParseFallbackResult> {
  const attempts: PdfParseAttempt[] = [];
  let pageCount = 0;
  let rawText = "";
  let rawValidation:
    | ReturnType<typeof validateRawExtractedPdfText>
    | undefined;

  const primaryModel = options.primaryModel ?? "google/gemini-2.5-flash-lite";
  const fallbackModel = options.fallbackModel ?? "google/gemini-2.5-flash";
  const directModel = options.directModel ?? DEFAULT_DIRECT_PDF_MODEL;
  const directBytesMaxBytes =
    options.directBytesMaxBytes ?? DEFAULT_DIRECT_BYTES_MAX_BYTES;

  const localAttempt = await recordAttempt(
    attempts,
    "local_extract",
    "pdfjs-local",
    async () => {
      const local = await extractPdfTextLocally(buffer);
      pageCount = local.pageCount;
      rawText = local.text;
      rawValidation = validateRawExtractedPdfText(local.text);
      if (!rawValidation.ok) {
        throw new Error(rawValidation.reason ?? "Raw PDF extraction was not usable");
      }
      return { charCount: local.text.length };
    }
  );

  if (localAttempt.ok && rawText) {
    const primaryAttempt = await recordAttempt(
      attempts,
      "normalize_primary",
      primaryModel,
      async () => {
        const normalized = await normalizeExtractedPdfText(rawText, filename, {
          model: primaryModel,
          provider: options.provider,
        });
        const validation = validateNormalizedDocument(normalized);
        if (!validation.ok) {
          throw new Error(validation.reason ?? "Primary normalization failed validation");
        }
        return {
          text: normalized,
          charCount: normalized.length,
          quality: "validated" as const,
        };
      }
    );

    if (primaryAttempt.ok && primaryAttempt.text) {
      return {
        ok: true,
        text: primaryAttempt.text,
        pageCount,
        parseEngine: "pdfjs+normalize-lite",
        parseAttempts: attempts.length,
        parseQuality: "validated",
        attempts,
        winnerStage: "normalize_primary",
      };
    }

    const fallbackAttempt = await recordAttempt(
      attempts,
      "normalize_fallback",
      fallbackModel,
      async () => {
        const normalized = await normalizeExtractedPdfText(rawText, filename, {
          model: fallbackModel,
          provider: options.provider,
        });
        const validation = validateNormalizedDocument(normalized);
        if (!validation.ok) {
          throw new Error(validation.reason ?? "Fallback normalization failed validation");
        }
        return {
          text: normalized,
          charCount: normalized.length,
          quality: "fallback_validated" as const,
        };
      }
    );

    if (fallbackAttempt.ok && fallbackAttempt.text) {
      return {
        ok: true,
        text: fallbackAttempt.text,
        pageCount,
        parseEngine: "pdfjs+normalize-full",
        parseAttempts: attempts.length,
        parseQuality: "fallback_validated",
        attempts,
        winnerStage: "normalize_fallback",
      };
    }
  }

  if (buffer.length <= directBytesMaxBytes) {
    const directBytesAttempt = await recordAttempt(
      attempts,
      "direct_bytes",
      directModel,
      async () => {
        const extracted = await extractPdfTextWithModelDirectly(buffer, filename, {
          model: directModel,
          provider: options.provider,
        });
        const validation = validateNormalizedDocument(extracted);
        if (!validation.ok) {
          throw new Error(validation.reason ?? "Direct byte extraction failed validation");
        }
        return {
          text: extracted,
          charCount: extracted.length,
          quality: "fallback_validated" as const,
        };
      }
    );

    if (directBytesAttempt.ok && directBytesAttempt.text) {
      return {
        ok: true,
        text: directBytesAttempt.text,
        pageCount,
        parseEngine: "pdf-direct-bytes",
        parseAttempts: attempts.length,
        parseQuality: "fallback_validated",
        attempts,
        winnerStage: "direct_bytes",
      };
    }
  }

  if (options.resolvedUrl) {
    const directUrlAttempt = await recordAttempt(
      attempts,
      "direct_url",
      directModel,
      async () => {
        const extracted = await extractPdfTextWithModelFromUrl(
          options.resolvedUrl!,
          filename,
          {
            model: directModel,
            provider: options.provider,
          }
        );
        const validation = validateNormalizedDocument(extracted);
        if (!validation.ok) {
          throw new Error(validation.reason ?? "Direct URL extraction failed validation");
        }
        return {
          text: extracted,
          charCount: extracted.length,
          quality: "fallback_validated" as const,
        };
      }
    );

    if (directUrlAttempt.ok && directUrlAttempt.text) {
      return {
        ok: true,
        text: directUrlAttempt.text,
        pageCount,
        parseEngine: "pdf-direct-url",
        parseAttempts: attempts.length,
        parseQuality: "fallback_validated",
        attempts,
        winnerStage: "direct_url",
      };
    }
  }

  if (rawText && rawValidation?.ok) {
    const rawSalvageAttempt = await recordAttempt(
      attempts,
      "raw_salvage",
      "pdfjs-local",
      async () => ({
        text: rawText,
        charCount: rawText.length,
        quality: "fallback_validated" as const,
      })
    );

    if (rawSalvageAttempt.ok && rawSalvageAttempt.text) {
      return {
        ok: true,
        text: rawSalvageAttempt.text,
        pageCount,
        parseEngine: "pdfjs-raw-text",
        parseAttempts: attempts.length,
        parseQuality: "fallback_validated",
        attempts,
        winnerStage: "raw_salvage",
      };
    }
  }

  const parseError =
    attempts
      .map((attempt) => attempt.error)
      .filter((value): value is string => Boolean(value))
      .join(" | ") || "PDF parsing failed";

  return {
    ok: false,
    parseEngine: attempts.at(-1)?.engine ?? "pdfjs-local",
    parseAttempts: attempts.length,
    parseQuality: "rejected",
    parseError,
    attempts,
  };
}

async function recordAttempt(
  attempts: PdfParseAttempt[],
  stage: PdfParseAttempt["stage"],
  engine: string,
  operation: () => Promise<{
    text?: string;
    charCount?: number;
    quality?: PdfParseAttempt["quality"];
    warning?: string;
  }>
): Promise<PdfParseAttempt & { text?: string }> {
  const startedAt = Date.now();
  try {
    const result = await operation();
    const attempt: PdfParseAttempt = {
      stage,
      engine,
      ok: true,
      durationMs: Date.now() - startedAt,
      ...(typeof result.charCount === "number"
        ? { charCount: result.charCount }
        : {}),
      ...(result.quality ? { quality: result.quality } : {}),
      ...(result.warning ? { warning: result.warning } : {}),
    };
    attempts.push(attempt);
    return { ...attempt, text: result.text };
  } catch (error) {
    const attempt: PdfParseAttempt = {
      stage,
      engine,
      ok: false,
      durationMs: Date.now() - startedAt,
      error: (error as Error)?.message ?? "Unknown parse attempt failure",
    };
    attempts.push(attempt);
    return attempt;
  }
}
