import type { DiscoveredSource } from "@/lib/discovery/scholarly-search";
import type { IngestedSource } from "@/lib/ingest/source-ingestion";

// ── Constants ──

export const MAX_DEEP_SEARCH_SOURCES = 5;
export const MAX_EXTRACTION_CHARS = 60_000;
export const INGEST_CONCURRENCY = 5;
export const EXTRACTION_CONCURRENCY = 5;

// ── Types ──

export type ProgressCallback = (message: string) => void;

export interface SearchQuery {
  query: string;
  intent: string;
}

export interface DeepSearchExtraction {
  findings: Array<{
    claim: string;
    quote: string;
    relevance: "high" | "medium" | "low";
    section: string;
  }>;
  summary: string;
  limitations: string;
}

/** A source that has been ingested (fetched, parsed, stored) with its normalized text loaded. */
export interface IngestedSourceWithText {
  source: DiscoveredSource;
  ingested: IngestedSource;
  normalizedText: string;
}

export interface FailedSource {
  source: DiscoveredSource;
  reason: string;
}

export interface ExtractionResult {
  source: DiscoveredSource;
  extraction: DeepSearchExtraction;
}

export interface SearchExternalSourcesArgs {
  searches: SearchQuery[];
  num_results?: number;
  extraction_goal?: string;
}

// ── JSON Schema ──

export const DEEP_SEARCH_EXTRACTION_SCHEMA = {
  name: "deep_search_extraction",
  schema: {
    type: "object",
    properties: {
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            claim: { type: "string", description: "The extracted finding" },
            quote: { type: "string", description: "Supporting verbatim quote from the text" },
            relevance: { type: "string", enum: ["high", "medium", "low"] },
            section: { type: "string", description: "Which section of the paper this was found in" },
          },
          required: ["claim", "quote", "relevance", "section"],
          additionalProperties: false,
        },
      },
      summary: { type: "string", description: "2-3 sentence summary of what this paper contributes relative to the extraction goal" },
      limitations: { type: "string", description: "Any limitations the authors mention that are relevant to the extraction goal" },
    },
    required: ["findings", "summary", "limitations"],
    additionalProperties: false,
  },
} as const;
