import type { PaperQualityMeta } from "@/lib/discovery/paper-quality";

function normalizeDoiUrl(doi?: string): string | null {
  const trimmed = doi?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://doi.org/${trimmed.replace(/^doi:\s*/i, "")}`;
}

export function getPrimarySourceUrl({
  sourceUrl,
  paperQuality,
}: {
  sourceUrl?: string;
  paperQuality?: PaperQualityMeta;
}): string | null {
  const trimmedSourceUrl = sourceUrl?.trim();
  if (trimmedSourceUrl) return trimmedSourceUrl;
  return normalizeDoiUrl(paperQuality?.ids?.doi);
}

export function getArxivPdfUrl(
  paperQuality?: PaperQualityMeta
): string | null {
  const arxivId = paperQuality?.ids?.arxivId?.trim();
  if (!arxivId) return null;
  if (/^https?:\/\//i.test(arxivId)) return arxivId;
  return `https://arxiv.org/pdf/${arxivId}`;
}
