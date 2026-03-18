import path from "path";
import { readFile } from "fs/promises";
import { blobStore } from "@/lib/storage/blob-store";
import type {
  ParsedSource,
  SourceEntry,
  SourceMetadata,
  SourceChunk,
} from "@/lib/engine/state";
import { memoryStore } from "@/lib/storage/memory-store";
import { parsePDF } from "@/lib/pdf/gemini-extract";
import { chunkDocument } from "./chunk-document";
import {
  estimateTokens,
  validateNormalizedDocument,
} from "./document-quality";
import type { PaperQualityMeta } from "@/lib/discovery/paper-quality";

const PDF_PARSE_PRIMARY_MODEL = "google/gemini-2.5-flash-lite";
const PDF_PARSE_FALLBACK_MODEL = "google/gemini-2.5-flash";

export interface SourceFetchResult {
  buffer: Buffer;
  contentType: string;
  resolvedUrl: string;
}

export interface IngestedSource {
  source: SourceEntry;
  parsedSource?: ParsedSource;
  sourceChunks: SourceChunk[];
  warnings: string[];
}

export async function ingestUploadedSource(params: {
  source: SourceEntry;
}): Promise<IngestedSource> {
  const { source } = params;
  const rawBuffer = await readUploadedSourceBuffer(source.storageUrl);

  return ingestSourceFromBytes({
    source,
    rawBuffer,
    sourceUrl: source.metadata?.sourceUrl ?? source.name,
    resolvedUrl: source.metadata?.resolvedUrl ?? source.name,
    httpContentType: source.mimeType,
  });
}

async function readUploadedSourceBuffer(storageUrl: string) {
  try {
    return await blobStore.getBuffer(storageUrl);
  } catch {
    const inMemory = memoryStore.getFile(storageUrl);
    if (inMemory) {
      return inMemory;
    }

    return readFile(storageUrl);
  }
}

export async function ingestDiscoveredSource(params: {
  sourceId: string;
  title: string;
  sourceUrl: string;
  pdfUrl?: string;
  paperQuality?: PaperQualityMeta;
}): Promise<IngestedSource> {
  const candidates = uniqueUrls([
    params.pdfUrl,
    params.sourceUrl,
  ]);

  let lastError: Error | null = null;

  for (const candidate of candidates) {
    try {
      const fetched = await fetchSourceBytes(candidate);
      const checksum = "";

      return ingestSourceFromBytes({
        source: {
          sourceId: params.sourceId,
          name: params.title,
          origin: "discovered",
          mimeType: fetched.contentType || "application/octet-stream",
          checksum,
          storageUrl: "",
          parseStatus: "pending",
          metadata: {
            sourceKind: "html",
            sourceUrl: params.sourceUrl,
            resolvedUrl: fetched.resolvedUrl,
            sniffedMimeType: "application/octet-stream",
            rawBlobKey: "",
            byteSize: fetched.buffer.length,
            paperQuality: params.paperQuality,
          },
        },
        rawBuffer: fetched.buffer,
        sourceUrl: params.sourceUrl,
        resolvedUrl: fetched.resolvedUrl,
        httpContentType: fetched.contentType,
      });
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError ?? new Error(`Unable to fetch source: ${params.sourceUrl}`);
}

export async function fetchSourceBytes(url: string): Promise<SourceFetchResult> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "application/pdf,text/html,*/*",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Source fetch failed: ${response.status} ${url}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: response.headers.get("content-type") ?? "",
    resolvedUrl: response.url || url,
  };
}

export async function ingestSourceFromBytes(params: {
  source: SourceEntry;
  rawBuffer: Buffer;
  sourceUrl: string;
  resolvedUrl: string;
  httpContentType?: string;
}): Promise<IngestedSource> {
  const { source, rawBuffer, sourceUrl, resolvedUrl, httpContentType } = params;
  const sniffedMimeType = sniffMimeType(rawBuffer, resolvedUrl, httpContentType);
  const sourceKind = sniffedMimeType === "application/pdf" ? "pdf" : "html";
  const extension = sourceKind === "pdf" ? ".pdf" : ".html";
  const rawBlobKey = `sources/${source.sourceId}/raw${extension}`;

  await blobStore.putBuffer(
    rawBlobKey,
    rawBuffer,
    sniffedMimeType
  );

  const baseMetadata: SourceMetadata = {
    sourceKind,
    sourceUrl,
    resolvedUrl,
    httpContentType,
    sniffedMimeType,
    rawBlobKey,
    byteSize: rawBuffer.length,
    ...(source.metadata?.paperQuality
      ? { paperQuality: source.metadata.paperQuality }
      : {}),
  };

  if (sniffedMimeType === "application/pdf") {
    return ingestPdfSource({
      source,
      rawBuffer,
      metadata: baseMetadata,
    });
  }

  if (sniffedMimeType === "text/html") {
    return ingestHtmlSource({
      source,
      rawBuffer,
      metadata: baseMetadata,
    });
  }

  return {
    source: {
      ...source,
      storageUrl: rawBlobKey,
      mimeType: sniffedMimeType,
      parseStatus: "failed",
      metadata: {
        ...baseMetadata,
        parseQuality: "rejected",
        parseError: "Unsupported binary source",
      },
    },
    sourceChunks: [],
    warnings: ["Unsupported binary source"],
  };
}

async function ingestPdfSource(params: {
  source: SourceEntry;
  rawBuffer: Buffer;
  metadata: SourceMetadata;
}): Promise<IngestedSource> {
  const { source, rawBuffer, metadata } = params;
  const filename = ensurePdfFilename(source.name);
  const primary = await parsePDF(rawBuffer, filename, {
    model: PDF_PARSE_PRIMARY_MODEL,
  });
  const primaryValidation = validateNormalizedDocument(primary.text);

  let finalText = primary.text;
  let parseEngine = PDF_PARSE_PRIMARY_MODEL;
  let parseAttempts = 1;
  let parseQuality: SourceMetadata["parseQuality"] = "validated";
  let validation = primaryValidation;

  if (!primaryValidation.ok) {
    const fallback = await parsePDF(rawBuffer, filename, {
      model: PDF_PARSE_FALLBACK_MODEL,
    });
    parseAttempts = 2;
    parseEngine = PDF_PARSE_FALLBACK_MODEL;
    finalText = fallback.text;
    validation = validateNormalizedDocument(fallback.text);
    parseQuality = validation.ok ? "fallback_validated" : "rejected";
  }

  if (!validation.ok) {
    return {
      source: {
        ...source,
        storageUrl: metadata.rawBlobKey,
        mimeType: "application/pdf",
        parseStatus: "failed",
        metadata: {
          ...metadata,
          parseEngine,
          parseAttempts,
          parseQuality: "rejected",
          parseError: validation.reason,
        },
      },
      sourceChunks: [],
      warnings: validation.reason ? [validation.reason] : [],
    };
  }

  return buildNormalizedSource({
    source,
    normalizedText: finalText,
    mimeType: "application/pdf",
    metadata: {
      ...metadata,
      parseEngine,
      parseAttempts,
      parseQuality,
    },
  });
}

async function ingestHtmlSource(params: {
  source: SourceEntry;
  rawBuffer: Buffer;
  metadata: SourceMetadata;
}): Promise<IngestedSource> {
  const html = params.rawBuffer.toString("utf8");
  const text = extractHtmlText(html);
  const validation = validateNormalizedDocument(text);

  if (!validation.ok) {
    return {
      source: {
        ...params.source,
        storageUrl: params.metadata.rawBlobKey,
        mimeType: "text/html",
        parseStatus: "failed",
        metadata: {
          ...params.metadata,
          parseEngine: "html-readability",
          parseAttempts: 1,
          parseQuality: "rejected",
          parseError: validation.reason,
        },
      },
      sourceChunks: [],
      warnings: validation.reason ? [validation.reason] : [],
    };
  }

  return buildNormalizedSource({
    source: params.source,
    normalizedText: text,
    mimeType: "text/html",
    metadata: {
      ...params.metadata,
      parseEngine: "html-readability",
      parseAttempts: 1,
      parseQuality: "validated",
    },
  });
}

async function buildNormalizedSource(params: {
  source: SourceEntry;
  normalizedText: string;
  mimeType: string;
  metadata: SourceMetadata;
}): Promise<IngestedSource> {
  const { source, normalizedText, mimeType, metadata } = params;
  const normalizedBlobKey = `sources/${source.sourceId}/normalized.md`;
  await blobStore.putText(
    normalizedBlobKey,
    normalizedText,
    "text/markdown; charset=utf-8"
  );

  const chunksWithContent = chunkDocument({
    sourceId: source.sourceId,
    sourceName: source.name,
    normalizedBlobKeyPrefix: `sources/${source.sourceId}`,
    text: normalizedText,
  });

  const sourceChunks: SourceChunk[] = [];
  for (const chunk of chunksWithContent) {
    await blobStore.putText(
      chunk.blobKey,
      chunk.content,
      "text/markdown; charset=utf-8"
    );
    sourceChunks.push({
      sourceId: chunk.sourceId,
      sourceName: chunk.sourceName,
      chunkIndex: chunk.chunkIndex,
      headingPath: chunk.headingPath,
      tokenEstimate: chunk.tokenEstimate,
      charCount: chunk.charCount,
      blobKey: chunk.blobKey,
    });
  }

  const estimatedTokens = estimateTokens(normalizedText);
  const parsedSource: ParsedSource = {
    sourceId: source.sourceId,
    name: source.name,
    normalizedBlobKey,
    charCount: normalizedText.length,
    estimatedTokens,
    parseQuality: (metadata.parseQuality ?? "validated") as "validated" | "fallback_validated",
    metadata: {
      sourceKind: metadata.sourceKind,
      sourceUrl: metadata.sourceUrl,
      resolvedUrl: metadata.resolvedUrl,
      chunkCount: sourceChunks.length,
      parseEngine: metadata.parseEngine,
    },
  };

  return {
    source: {
      ...source,
      storageUrl: metadata.rawBlobKey,
      mimeType,
      parseStatus: "parsed",
      metadata: {
        ...metadata,
        normalizedBlobKey,
        charCount: normalizedText.length,
        estimatedTokens,
      },
    },
    parsedSource,
    sourceChunks,
    warnings: [],
  };
}


export function sniffMimeType(
  buffer: Buffer,
  url: string,
  httpContentType?: string
): "application/pdf" | "text/html" | "application/octet-stream" {
  const normalizedContentType = (httpContentType ?? "").toLowerCase();
  if (buffer.subarray(0, 5).toString("utf8") === "%PDF-") {
    return "application/pdf";
  }

  if (normalizedContentType.includes("pdf")) {
    return "application/pdf";
  }

  if (
    normalizedContentType.includes("html") ||
    /^\s*<(?:!doctype html|html|head|body)/i.test(
      buffer.subarray(0, 512).toString("utf8")
    )
  ) {
    return "text/html";
  }

  if (path.extname(new URL(url).pathname).toLowerCase() === ".pdf") {
    return "application/pdf";
  }

  return "application/octet-stream";
}

export function extractHtmlText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueUrls(urls: Array<string | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of urls) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function ensurePdfFilename(name: string) {
  return name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
}
