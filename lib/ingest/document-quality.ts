const PDF_MARKERS = [
  "%PDF-",
  "xref",
  "/Type/Annot",
  " endobj",
  " startxref",
  "%%EOF",
] as const;

export const MAX_DOCUMENT_ANALYSIS_TOKENS = 120_000;

export interface ValidationResult {
  ok: boolean;
  estimatedTokens: number;
  reason?: string;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function validateNormalizedDocument(text: string): ValidationResult {
  const trimmed = text.trim();
  const estimatedTokens = estimateTokens(trimmed);

  if (trimmed.startsWith("%PDF-")) {
    return {
      ok: false,
      estimatedTokens,
      reason: "Parser output still contains raw PDF bytes",
    };
  }

  const suspiciousMarkerCount = PDF_MARKERS.reduce(
    (count, marker) => count + (trimmed.match(new RegExp(escapeRegExp(marker), "g"))?.length ?? 0),
    0
  );

  if (suspiciousMarkerCount >= 8) {
    return {
      ok: false,
      estimatedTokens,
      reason: "Parser output contains PDF internals instead of clean text",
    };
  }

  const alphaNumericChars =
    trimmed.match(/[A-Za-z0-9\u00C0-\u024F\u4E00-\u9FFF]/g)?.length ?? 0;
  const printableChars = trimmed.match(/[ -~\n\r\t]/g)?.length ?? 0;
  const printableRatio = printableChars / Math.max(trimmed.length, 1);
  const alphaNumericRatio = alphaNumericChars / Math.max(trimmed.length, 1);

  if (printableRatio < 0.9 || alphaNumericRatio < 0.2) {
    return {
      ok: false,
      estimatedTokens,
      reason: "Parser output looks too binary to trust",
    };
  }

  if (trimmed.length < 400) {
    return {
      ok: false,
      estimatedTokens,
      reason: "Normalized document was too short to analyze",
    };
  }

  if (estimatedTokens > MAX_DOCUMENT_ANALYSIS_TOKENS) {
    return {
      ok: false,
      estimatedTokens,
      reason: `Document exceeded the analysis budget (${estimatedTokens} tokens estimated)`,
    };
  }

  return {
    ok: true,
    estimatedTokens,
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
