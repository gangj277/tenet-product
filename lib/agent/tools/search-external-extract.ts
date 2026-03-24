import crypto from "crypto";
import type { DiscoveredSource } from "@/lib/discovery/scholarly-search";
import { ingestDiscoveredSource } from "@/lib/ingest/source-ingestion";
import { blobStore } from "@/lib/storage/blob-store";
import { callLLMJson } from "@/lib/llm/runtime";
import { MODEL_LITE } from "@/lib/llm/models";
import {
  MAX_EXTRACTION_CHARS,
  DEEP_SEARCH_EXTRACTION_SCHEMA,
  type DeepSearchExtraction,
  type IngestedSourceWithText,
} from "./search-external-types";

/** Ingest a single discovered source (fetch → parse → store) and load its normalized text. */
export async function ingestAndLoad(
  source: DiscoveredSource
): Promise<IngestedSourceWithText | null> {
  const sourceId = crypto.randomUUID();

  const result = await ingestDiscoveredSource({
    sourceId,
    title: source.title,
    sourceUrl: source.url,
    pdfUrl: source.pdfUrl,
    paperQuality: source.paperQuality,
  });

  if (result.source.parseStatus === "failed") {
    return null;
  }

  const normalizedBlobKey = result.source.metadata?.normalizedBlobKey;
  if (!normalizedBlobKey) return null;

  const normalizedText = await blobStore.getText(normalizedBlobKey);
  if (!normalizedText || normalizedText.length < 200) return null;

  return { source, ingested: result, normalizedText };
}

/** Use an LLM to extract findings from a single ingested source. */
export async function extractFromSource(
  item: IngestedSourceWithText,
  extractionGoal: string
): Promise<DeepSearchExtraction> {
  const systemPrompt = buildExtractionPrompt(extractionGoal, item.source.title);

  // Truncate for LLM context — full text is already stored in blob store
  const extractionText = item.normalizedText.length > MAX_EXTRACTION_CHARS
    ? item.normalizedText.slice(0, MAX_EXTRACTION_CHARS)
    : item.normalizedText;

  const { data } = await callLLMJson<DeepSearchExtraction>({
    model: MODEL_LITE,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: extractionText },
    ],
    temperature: 0.2,
    maxTokens: 2048,
    jsonSchema: DEEP_SEARCH_EXTRACTION_SCHEMA,
  });

  return data;
}

function buildExtractionPrompt(extractionGoal: string, sourceTitle: string): string {
  return `You are extracting specific information from a research paper to answer a targeted question.

EXTRACTION GOAL: ${extractionGoal}

SOURCE: "${sourceTitle}"

Instructions:
- Extract ONLY findings relevant to the extraction goal above
- Use exact quotes from the text to support each finding
- If the paper has nothing relevant, return an empty findings array and say so in the summary
- Do not invent, infer, or generalize beyond what the text explicitly states
- Note the section of the paper where each finding was found (e.g. "Abstract", "Methods", "Results", "Discussion")
- Include any limitations the authors mention that are relevant to the extraction goal
- Prefer a small number of high-relevance findings over exhaustive low-relevance ones
- Rate relevance: high = directly answers the extraction goal, medium = partially relevant, low = tangentially related`;
}
