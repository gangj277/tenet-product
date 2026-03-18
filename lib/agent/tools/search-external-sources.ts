import crypto from "crypto";
import {
  discoverScholarlySources,
  type DiscoveredSource,
} from "@/lib/discovery/scholarly-search";
import { formatPaperQualitySummary } from "@/lib/discovery/paper-quality";
import {
  ingestDiscoveredSource,
  type IngestedSource,
} from "@/lib/ingest/source-ingestion";
import { blobStore } from "@/lib/storage/blob-store";
import { callLLMJson } from "@/lib/llm/openrouter";
import { MODEL_LITE } from "@/lib/llm/models";
import { allSettledWithConcurrency } from "@/lib/utils/async";
import { addAgentDiscoveredSource, getSourceMetadataForRun } from "@/lib/db/research-projects";
import { classifySourceIntoFolder } from "@/lib/ingest/classify-source-folder";
import type { AddedSource, WorkspaceContext } from "../state";

// ── Constants ──

const MAX_DEEP_SEARCH_SOURCES = 5;
const MAX_EXTRACTION_CHARS = 60_000;
const INGEST_CONCURRENCY = 5;
const EXTRACTION_CONCURRENCY = 5;

// ── Types ──

export type ProgressCallback = (message: string) => void;

interface SearchQuery {
  query: string;
  intent: string;
}

interface DeepSearchExtraction {
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
interface IngestedSourceWithText {
  source: DiscoveredSource;
  ingested: IngestedSource;
  normalizedText: string;
}

interface FailedSource {
  source: DiscoveredSource;
  reason: string;
}

interface ExtractionResult {
  source: DiscoveredSource;
  extraction: DeepSearchExtraction;
}

// ── JSON Schema ──

const DEEP_SEARCH_EXTRACTION_SCHEMA = {
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

// ── Main Entry Point ──

export interface SearchExternalSourcesArgs {
  searches: SearchQuery[];
  num_results?: number;
  extraction_goal?: string;
}

/**
 * Search for external academic sources via the unified scholarly engine.
 * Accepts 1-2 search queries, each with an intent describing what to look for.
 * When `extraction_goal` is provided, performs deep search: fetches paper
 * content, extracts findings relevant to the goal, persists sources to the
 * workspace, and returns structured evidence with workspace source keys.
 */
export async function executeSearchExternalSources(
  args: SearchExternalSourcesArgs,
  onProgress?: ProgressCallback,
  ctx?: WorkspaceContext
): Promise<{ result: string; sources: DiscoveredSource[]; addedSources?: AddedSource[] }> {
  const progress = onProgress ?? (() => {});

  try {
    const searches = args.searches.slice(0, 2);
    if (searches.length === 0) {
      return {
        result: "No search queries provided.",
        sources: [],
      };
    }

    // Discover sources across all queries
    const primaryQuery = searches[0].query;
    const queryVariations = searches.slice(1).map((s) => s.query);

    const queryLabel = searches.map((s) => `"${s.query}"`).join(" + ");
    progress(`Searching academic databases for ${queryLabel}`);

    const sources = await discoverScholarlySources({
      query: primaryQuery,
      numResults: args.num_results ?? 8,
      queryVariations,
      filters: ctx?.searchFilters,
    });

    if (sources.length === 0) {
      return {
        result: `No external sources found for ${queryLabel}. Try different search queries.`,
        sources: [],
      };
    }

    progress(`Found ${sources.length} papers`);

    // If no extraction goal, return metadata-only
    if (!args.extraction_goal?.trim()) {
      return {
        result: formatMetadataOnly(searches, sources),
        sources,
      };
    }

    // Deep search path
    return deepSearch(searches, args.extraction_goal.trim(), sources, progress, ctx);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      result: `Search failed: ${message}. Scholarly search may be unavailable.`,
      sources: [],
    };
  }
}

// ── Metadata-Only Formatting ──

function formatMetadataOnly(searches: SearchQuery[], sources: DiscoveredSource[]): string {
  const queryLabel = searches.map((s) => `"${s.query}" (${s.intent})`).join(", ");
  const formatted = sources
    .map((s, i) => {
      const date = s.publishedDate
        ? ` (${s.publishedDate.slice(0, 10)})`
        : "";
      const author = s.author ? ` — ${s.author}` : "";
      const qualitySummary = formatPaperQualitySummary(s.paperQuality);
      const quality = qualitySummary ? `\n   ${qualitySummary}` : "";
      return `${i + 1}. ${s.title}${date}${author}${quality}\n   ${s.url}`;
    })
    .join("\n\n");

  return `Found ${sources.length} external sources for ${queryLabel}:\n\n${formatted}`;
}

// ── Deep Search Pipeline ──

async function deepSearch(
  searches: SearchQuery[],
  extractionGoal: string,
  allSources: DiscoveredSource[],
  progress: ProgressCallback,
  ctx?: WorkspaceContext
): Promise<{ result: string; sources: DiscoveredSource[]; addedSources?: AddedSource[] }> {
  const candidates = allSources.slice(0, MAX_DEEP_SEARCH_SOURCES);
  const remaining = allSources.slice(MAX_DEEP_SEARCH_SOURCES);

  // Stage 1: Ingest sources via shared pipeline (fetch → parse → store)
  progress(`Fetching and parsing ${candidates.length} papers`);

  const ingested: IngestedSourceWithText[] = [];
  const failed: FailedSource[] = [];
  let ingestCompleted = 0;

  const ingestResults = await allSettledWithConcurrency(
    candidates,
    INGEST_CONCURRENCY,
    async (source) => {
      const result = await ingestAndLoad(source);
      ingestCompleted++;
      const verb = result ? `Read "${truncateTitle(source.title)}"` : `Skipped "${truncateTitle(source.title)}"`;
      progress(`${verb} (${ingestCompleted}/${candidates.length})`);
      return result;
    }
  );

  for (let i = 0; i < ingestResults.length; i++) {
    const result = ingestResults[i];
    if (result.status === "fulfilled" && result.value) {
      ingested.push(result.value);
    } else {
      const reason =
        result.status === "rejected"
          ? (result.reason as Error)?.message ?? "Fetch failed"
          : "Could not parse content";
      failed.push({ source: candidates[i], reason });
    }
  }

  if (ingested.length === 0) {
    return {
      result:
        `Deep search failed: could not fetch or parse any of the ${candidates.length} sources.\n` +
        `Returning metadata only.\n\n` +
        formatMetadataOnly(searches, allSources),
      sources: allSources,
    };
  }

  // Stage 2: LLM extraction — targeted by the agent's extraction_goal
  progress(`Extracting findings from ${ingested.length} papers`);

  const extractions: ExtractionResult[] = [];
  const extractionFailed: FailedSource[] = [];
  let extractCompleted = 0;

  const extractionResults = await allSettledWithConcurrency(
    ingested,
    EXTRACTION_CONCURRENCY,
    async (item) => {
      const result = await extractFromSource(item, extractionGoal);
      extractCompleted++;
      progress(`Analyzed "${truncateTitle(item.source.title)}" (${extractCompleted}/${ingested.length})`);
      return result;
    }
  );

  for (let i = 0; i < extractionResults.length; i++) {
    const result = extractionResults[i];
    if (result.status === "fulfilled") {
      extractions.push({ source: ingested[i].source, extraction: result.value });
    } else {
      extractionFailed.push({
        source: ingested[i].source,
        reason: (result.reason as Error)?.message ?? "Extraction failed",
      });
    }
  }

  const allFailed = [...failed, ...extractionFailed];

  // Stage 3: Persist to DB (sources are already stored in blob store by stage 1)
  let addedSources: AddedSource[] | undefined;
  if (ctx?.runId) {
    progress(`Adding ${ingested.length} sources to workspace`);
    addedSources = await persistIngestedSources(ingested, extractions, ctx.runId, progress);
  }

  progress(`Deep search complete — ${extractions.length} papers analyzed`);

  // Stage 4: Format results
  const result = formatDeepSearchResults({
    searches,
    extractionGoal,
    extractions,
    failed: allFailed,
    remaining,
    addedSources,
  });

  return { result, sources: allSources, addedSources };
}

// ── Ingest + Load Normalized Text ──

async function ingestAndLoad(
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

// ── LLM Extraction for a Single Source ──

async function extractFromSource(
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

// ── Persist Ingested Sources to DB ──

async function persistIngestedSources(
  items: IngestedSourceWithText[],
  extractions: ExtractionResult[],
  runId: string,
  progress: ProgressCallback
): Promise<AddedSource[]> {
  // Build lookup from source URL → extraction
  const extractionMap = new Map<string, DeepSearchExtraction>();
  for (const e of extractions) {
    extractionMap.set(e.source.url, e.extraction);
  }

  // Gather existing folder names from the workspace
  const existingMeta = await getSourceMetadataForRun(runId);
  const existingFolders = [
    ...new Set(
      Object.values(existingMeta)
        .map((m) => m.folder)
        .filter((f): f is string => !!f)
    ),
  ];

  const added: AddedSource[] = [];

  for (const item of items) {
    try {
      const { source, ingested } = item;
      const sourceId = ingested.source.sourceId;
      const key = `source:${sourceId}`;
      const sourceUrl = source.pdfUrl ?? source.url;

      // Build summary from extraction (if available)
      const extraction = extractionMap.get(source.url);
      const summaryContent = buildSourceSummary(source, extraction);

      // Classify into folder
      const folder = await classifySourceIntoFolder({
        sourceName: source.title,
        existingFolders,
      });

      // Track new folders for subsequent sources in this batch
      if (folder && !existingFolders.includes(folder)) {
        existingFolders.push(folder);
      }

      const metadata = {
        ...((ingested.source.metadata ?? {}) as unknown as Record<string, unknown>),
        ...(folder ? { folder } : {}),
      };

      // Insert DB row — blob storage already done by ingestDiscoveredSource
      await addAgentDiscoveredSource({
        runId,
        sourceId,
        name: source.title,
        mimeType: ingested.source.mimeType,
        storagePath: ingested.source.storageUrl,
        metadata,
        summaryContent,
      });

      added.push({
        sourceId,
        key,
        label: source.title,
        content: summaryContent,
        sourceUrl,
        paperQuality: source.paperQuality,
        folder,
      });
    } catch {
      // Skip sources that fail to persist to DB
    }
  }

  if (added.length > 0) {
    progress(`Added ${added.length} sources to workspace`);
  }

  return added;
}

/** Build a markdown summary for a workspace source from extraction results. */
function buildSourceSummary(
  source: DiscoveredSource,
  extraction?: DeepSearchExtraction
): string {
  const parts: string[] = [];

  parts.push(`## ${source.title}`);

  const metaLines: string[] = [];
  if (source.url) metaLines.push(`**URL**: ${source.url}`);
  if (source.author) metaLines.push(`**Author**: ${source.author}`);
  if (source.publishedDate) metaLines.push(`**Published**: ${source.publishedDate.slice(0, 10)}`);
  if (source.venue) metaLines.push(`**Venue**: ${source.venue}`);
  metaLines.push(`**Added via**: Agent deep search`);
  parts.push(metaLines.join("\n"));

  if (!extraction) {
    parts.push("*Source added to workspace. Full text available for reading.*");
    return parts.join("\n\n");
  }

  if (extraction.summary) {
    parts.push(`### Summary\n\n${extraction.summary}`);
  }

  if (extraction.findings.length > 0) {
    const findingLines = extraction.findings.map((f) => {
      const tag = f.relevance.toUpperCase();
      return `- **[${tag}]** ${f.claim}\n  > "${f.quote}" — *${f.section}*`;
    });
    parts.push(`### Key Findings\n\n${findingLines.join("\n\n")}`);
  }

  if (extraction.limitations) {
    parts.push(`### Limitations\n\n${extraction.limitations}`);
  }

  return parts.join("\n\n");
}

// ── Format Deep Search Results ──

function formatDeepSearchResults(params: {
  searches: SearchQuery[];
  extractionGoal: string;
  extractions: ExtractionResult[];
  failed: FailedSource[];
  remaining: DiscoveredSource[];
  addedSources?: AddedSource[];
}): string {
  const { searches, extractionGoal, extractions, failed, remaining, addedSources } = params;
  const parts: string[] = [];

  const queryLabel = searches.map((s) => `"${s.query}" (${s.intent})`).join(", ");
  parts.push(
    `Deep search: ${queryLabel}\nExtraction goal: ${extractionGoal}\n` +
    `Analyzed ${extractions.length} source${extractions.length !== 1 ? "s" : ""}.`
  );

  // Build lookup from source title → workspace key
  const sourceKeyMap = new Map<string, string>();
  if (addedSources) {
    for (const a of addedSources) {
      sourceKeyMap.set(a.label, a.key);
    }
  }

  if (addedSources?.length) {
    parts.push(
      `\nThese sources have been added to the workspace. ` +
      `Use [Source: <key>, section] citations to reference them.`
    );
  }

  for (let i = 0; i < extractions.length; i++) {
    const { source, extraction } = extractions[i];
    const qualitySummary = formatPaperQualitySummary(source.paperQuality);
    const workspaceKey = sourceKeyMap.get(source.title);

    let section = `\n═══ Source ${i + 1}: ${source.title} ═══`;
    if (workspaceKey) section += `\nWorkspace key: ${workspaceKey}`;
    section += `\n${source.url}`;
    if (qualitySummary) section += `\n${qualitySummary}`;
    section += `\n\nSummary: ${extraction.summary}`;

    if (extraction.findings.length > 0) {
      section += "\n\nFindings:";
      for (let j = 0; j < extraction.findings.length; j++) {
        const f = extraction.findings[j];
        const tag = f.relevance.toUpperCase();
        section += `\n  ${j + 1}. [${tag}] ${f.claim}`;
        section += `\n     "${f.quote}"`;
        if (f.section) section += `\n     (Section: ${f.section})`;
      }
    } else {
      section += "\n\nNo relevant findings extracted from this source.";
    }

    if (extraction.limitations) {
      section += `\n\nLimitations: ${extraction.limitations}`;
    }

    parts.push(section);
  }

  if (failed.length > 0) {
    let section = "\n── Could not analyze ──";
    for (const f of failed) {
      section += `\n- ${f.source.title}: ${f.reason}`;
    }
    parts.push(section);
  }

  if (remaining.length > 0) {
    let section = "\n── Additional sources found (metadata only) ──";
    for (const s of remaining) {
      const date = s.publishedDate ? ` (${s.publishedDate.slice(0, 10)})` : "";
      const author = s.author ? ` — ${s.author}` : "";
      section += `\n- ${s.title}${date}${author}\n  ${s.url}`;
    }
    parts.push(section);
  }

  return parts.join("\n");
}

// ── Helpers ──

function truncateTitle(title: string, maxLen = 40): string {
  return title.length > maxLen ? title.slice(0, maxLen - 1) + "\u2026" : title;
}
