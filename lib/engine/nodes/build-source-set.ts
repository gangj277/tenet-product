import type {
  InitRunState,
  InitRunUpdate,
  ParsedSource,
  RunError,
  SourceChunk,
  SourceEntry,
  SourceMetadata,
} from "../state";
import { discoverScholarlySources } from "@/lib/discovery/scholarly-search";
import { generateId } from "@/lib/utils/id";
import { allSettledWithConcurrency } from "@/lib/utils/async";
import {
  ingestDiscoveredSource,
  ingestUploadedSource,
  type IngestedSource,
} from "@/lib/ingest/source-ingestion";
import { memoryStore } from "@/lib/storage/memory-store";

const MAX_CONCURRENT_SOURCE_INGESTS = 20;
/** High parallel ingest keeps project initialization responsive on large source batches. */

type IngestJob =
  | {
      kind: "discovered";
      sourceId: string;
      title: string;
      sourceUrl: string;
      pdfUrl?: string;
      paperQuality?: SourceMetadata["paperQuality"];
    }
  | {
      kind: "uploaded";
      source: SourceEntry;
    };

interface IngestJobResult {
  job: IngestJob;
  ingested: IngestedSource;
}

export async function buildSourceSet(
  state: InitRunState
): Promise<InitRunUpdate> {
  const { runId, perspective, sources: existingSources } = state;
  const errors: RunError[] = [];
  const reusedParsed = existingSources
    .map(rehydrateParsedWorkspaceSource)
    .filter((value): value is NonNullable<typeof value> => value !== null);
  const reusedSourceIds = new Set(reusedParsed.map((entry) => entry.source.sourceId));

  memoryStore.updateProgress(runId, "build_source_set", {
    status: "running",
    detail: "Discovering and classifying sources...",
  });

  const uploadedPending = existingSources.filter(
    (source) => source.origin === "uploaded" && source.parseStatus === "pending"
  );

  const discoveredJobs: IngestJob[] = [];
  if (perspective) {
    try {
      let primaryQuery: string;
      let queryVariations: string[];

      if (state.searchQueryPlan?.queries.length) {
        const planned = state.searchQueryPlan.queries;
        primaryQuery = planned[0].query;
        queryVariations = planned.slice(1).map((q) => q.query);
      } else {
        // Fallback: programmatic construction if query plan is missing
        primaryQuery = `${perspective.interpretedIntent} ${perspective.inferredResearchFrame}`;
        queryVariations = (perspective.subquestions ?? [])
          .slice(0, 2)
          .map((value) => value.replace(/\?$/, ""));
      }

      const discovered = await discoverScholarlySources({
        query: primaryQuery,
        numResults: 30,
        queryVariations,
        filters: state.input.searchFilters,
      });

      discovered
        .sort((left, right) => {
          if (left.pdfUrl && !right.pdfUrl) return -1;
          if (!left.pdfUrl && right.pdfUrl) return 1;
          return 0;
        })
        .forEach((source) => {
          discoveredJobs.push({
            kind: "discovered",
            sourceId: generateId(),
            title: source.title,
            sourceUrl: source.url,
            pdfUrl: source.pdfUrl,
            paperQuality: source.paperQuality,
          });
        });
    } catch (error) {
      errors.push(toRunError("build_source_set", error, true));
    }
  }

  const jobs: IngestJob[] = [
    ...uploadedPending
      .filter((source) => !reusedSourceIds.has(source.sourceId))
      .map((source) => ({ kind: "uploaded" as const, source })),
    ...discoveredJobs,
  ];
  const totalCandidateSources = jobs.length + reusedParsed.length;

  let completed = 0;
  let parsed = reusedParsed.length;
  let failed = 0;
  const sourceUpdates: SourceEntry[] = reusedParsed.map((entry) => entry.source);
  const parsedSources = reusedParsed.map((entry) => entry.parsedSource);
  const sourceChunks = reusedParsed.flatMap((entry) => entry.sourceChunks);

  if (jobs.length > 0) {
    const settled = await allSettledWithConcurrency(
      jobs,
      MAX_CONCURRENT_SOURCE_INGESTS,
      async (job): Promise<IngestJobResult> => {
        try {
          const ingested =
            job.kind === "uploaded"
              ? await ingestUploadedSource({ source: job.source })
              : await ingestDiscoveredSource({
                  sourceId: job.sourceId,
                  title: job.title,
                  sourceUrl: job.sourceUrl,
                  pdfUrl: job.pdfUrl,
                  paperQuality: job.paperQuality,
                });

          if (ingested.source.parseStatus === "parsed") {
            parsed += 1;
          } else if (ingested.source.parseStatus === "failed") {
            failed += 1;
          }

          return { job, ingested };
        } catch (error) {
          failed += 1;
          return { job, ingested: buildFailedIngest(job, error) };
        } finally {
          completed += 1;
          memoryStore.updateProgress(runId, "build_source_set", {
            detail: `Processing sources: ${completed}/${jobs.length} done (${parsed} parsed, ${failed} failed)`,
          });
        }
      }
    );

    for (const result of settled) {
      if (result.status !== "fulfilled") {
        errors.push(toRunError("build_source_set", result.reason, true));
        continue;
      }

      const { ingested } = result.value;
      sourceUpdates.push(ingested.source);

      if (ingested.parsedSource) {
        parsedSources.push(ingested.parsedSource);
      }

      if (ingested.sourceChunks.length > 0) {
        sourceChunks.push(...ingested.sourceChunks);
      }

      for (const warning of ingested.warnings) {
        errors.push({
          step: "build_source_set",
          message: `${ingested.source.name}: ${warning}`,
          retryable: false,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  if (jobs.length === 0 && parsedSources.length === 0) {
    memoryStore.updateProgress(runId, "build_source_set", {
      status: "failed",
      detail: "No uploaded or discovered sources were available to analyze",
    });

    return {
      status: "failed",
      currentStep: "build_source_set",
      errors: [
        ...errors,
        {
          step: "build_source_set",
          message: "No uploaded or discovered sources were available to analyze",
          retryable: false,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  if (parsedSources.length === 0) {
    memoryStore.updateProgress(runId, "build_source_set", {
      status: "failed",
      detail: `All ${jobs.length} sources failed normalization or parsing`,
    });

    return {
      status: "failed",
      currentStep: "build_source_set",
      sources: sourceUpdates,
      errors: [
        ...errors,
        {
          step: "build_source_set",
          message: "All candidate sources failed normalization or parsing",
          retryable: false,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  memoryStore.updateProgress(runId, "build_source_set", {
    status: "completed",
    detail: `Parsed ${parsedSources.length}/${totalCandidateSources} sources into ${sourceChunks.length} bounded chunks`,
  });

  return {
    currentStep: "build_source_set",
    sources: sourceUpdates,
    parsedSources,
    sourceChunks,
    errors,
  };
}

function rehydrateParsedWorkspaceSource(source: SourceEntry): {
  source: SourceEntry;
  parsedSource: ParsedSource;
  sourceChunks: SourceChunk[];
} | null {
  if (source.parseStatus !== "parsed") {
    return null;
  }

  const metadata = source.metadata;
  if (
    !metadata?.normalizedBlobKey ||
    typeof metadata.charCount !== "number" ||
    typeof metadata.estimatedTokens !== "number" ||
    (metadata.parseQuality !== "validated" &&
      metadata.parseQuality !== "fallback_validated")
  ) {
    return null;
  }

  const rawChunks = Array.isArray(metadata.sourceChunks) ? metadata.sourceChunks : [];
  const sourceChunks: SourceChunk[] = rawChunks.map((chunk) => ({
    sourceId: source.sourceId,
    sourceName: source.name,
    chunkIndex: chunk.chunkIndex,
    headingPath: chunk.headingPath,
    tokenEstimate: chunk.tokenEstimate,
    charCount: chunk.charCount,
    blobKey: chunk.blobKey,
  }));

  return {
    source,
    parsedSource: {
      sourceId: source.sourceId,
      name: source.name,
      normalizedBlobKey: metadata.normalizedBlobKey,
      charCount: metadata.charCount,
      estimatedTokens: metadata.estimatedTokens,
      parseQuality: metadata.parseQuality,
      metadata: {
        sourceKind: metadata.sourceKind,
        sourceUrl: metadata.sourceUrl,
        resolvedUrl: metadata.resolvedUrl,
        chunkCount: sourceChunks.length,
        parseEngine: metadata.parseEngine,
      },
    },
    sourceChunks,
  };
}

function buildFailedIngest(job: IngestJob, error: unknown): IngestedSource {
  const message = (error as Error)?.message ?? "Unknown ingest failure";

  if (job.kind === "uploaded") {
    return {
      source: {
        ...job.source,
        parseStatus: "failed",
        metadata: {
          ...job.source.metadata,
          parseQuality: "rejected",
          parseError: message,
        } as SourceMetadata,
      },
      sourceChunks: [],
      warnings: [message],
    };
  }

  return {
    source: {
      sourceId: job.sourceId,
      name: job.title,
      origin: "discovered",
      mimeType: "application/octet-stream",
      checksum: "",
      storageUrl: "",
      parseStatus: "failed",
      metadata: {
        sourceKind: job.pdfUrl ? "pdf" : "html",
        sourceUrl: job.sourceUrl,
        resolvedUrl: job.pdfUrl ?? job.sourceUrl,
        sniffedMimeType: "application/octet-stream",
        rawBlobKey: "",
        byteSize: 0,
        ...(job.paperQuality ? { paperQuality: job.paperQuality } : {}),
        parseQuality: "rejected",
        parseError: message,
      },
    },
    sourceChunks: [],
    warnings: [message],
  };
}

function toRunError(step: string, error: unknown, retryable: boolean): RunError {
  return {
    step,
    message: (error as Error)?.message ?? "Unknown error",
    retryable,
    timestamp: new Date().toISOString(),
  };
}
