import {
  discoverScholarlySources,
  type DiscoveredSource,
} from "@/lib/discovery/scholarly-search";
import { allSettledWithConcurrency } from "@/lib/utils/async";
import { syncAddedSourcesToWorkspaceCache } from "@/lib/workspace/source-cache";
import type { AddedSource, WorkspaceContext } from "../state";
import {
  MAX_DEEP_SEARCH_SOURCES,
  INGEST_CONCURRENCY,
  EXTRACTION_CONCURRENCY,
  type ProgressCallback,
  type SearchExternalSourcesArgs,
  type IngestedSourceWithText,
  type FailedSource,
  type ExtractionResult,
} from "./search-external-types";
import { ingestAndLoad, extractFromSource } from "./search-external-extract";
import { persistIngestedSources } from "./search-external-persist";
import { formatMetadataOnly, formatDeepSearchResults, truncateTitle } from "./search-external-format";

// Re-export public types for consumers
export type { ProgressCallback, SearchExternalSourcesArgs } from "./search-external-types";

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

// ── Deep Search Pipeline ──

async function deepSearch(
  searches: { query: string; intent: string }[],
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
    if (addedSources.length > 0) {
      await syncAddedSourcesToWorkspaceCache(ctx.runId, addedSources);
    }
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
