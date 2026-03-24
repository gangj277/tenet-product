import { addAgentDiscoveredSource, getSourceMetadataForRun } from "@/lib/db/research-projects";
import { classifySourceIntoFolder } from "@/lib/ingest/classify-source-folder";
import type { AddedSource } from "../state";
import type { DiscoveredSource } from "@/lib/discovery/scholarly-search";
import type {
  ProgressCallback,
  DeepSearchExtraction,
  IngestedSourceWithText,
  ExtractionResult,
} from "./search-external-types";

/** Persist ingested sources to the database and return workspace-keyed AddedSource records. */
export async function persistIngestedSources(
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
  let persistFailures = 0;

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
        sourceChunks: ingested.sourceChunks,
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
    } catch (error) {
      persistFailures++;
      console.error("Failed to persist agent-discovered source", {
        runId,
        sourceTitle: item.source.title,
        error,
      });
    }
  }

  if (added.length > 0) {
    progress(`Added ${added.length} sources to workspace`);
  }
  if (persistFailures > 0) {
    progress(`Skipped ${persistFailures} source${persistFailures === 1 ? "" : "s"} that failed to save`);
  }

  return added;
}

/** Build a markdown summary for a workspace source from extraction results. */
export function buildSourceSummary(
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
