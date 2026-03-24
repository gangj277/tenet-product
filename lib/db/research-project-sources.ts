import { and, eq } from "drizzle-orm";
import type { SourceChunk } from "@/lib/engine/state";
import type { PaperQualityMeta } from "@/lib/discovery/paper-quality";
import { db } from "./client";
import {
  artifacts,
  sources,
  sourceChunks as sourceChunksTable,
} from "./schema";
import type { SourceMeta } from "./research-project-types";

export async function getSourceMetadataForRun(
  runId: string
): Promise<Record<string, SourceMeta>> {
  const rows = await db
    .select({
      id: sources.id,
      name: sources.name,
      origin: sources.origin,
      metadata: sources.metadata,
    })
    .from(sources)
    .where(eq(sources.runId, runId));

  const result: Record<string, SourceMeta> = {};
  for (const row of rows) {
    const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
    const folder = metadata.folder as string | undefined;
    const sourceUrl = (metadata.sourceUrl ?? metadata.resolvedUrl) as string | undefined;
    const paperQuality = metadata.paperQuality as PaperQualityMeta | undefined;
    result[row.id] = {
      name: row.name,
      origin: row.origin,
      ...(folder ? { folder } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(paperQuality ? { paperQuality } : {}),
    };
  }
  return result;
}

export async function deleteSource(runId: string, sourceId: string): Promise<boolean> {
  return await db.transaction(async (tx) => {
    // Delete the source row (CASCADE removes source_chunks, SET NULL on artifacts.sourceId)
    const result = await tx
      .delete(sources)
      .where(and(eq(sources.id, sourceId), eq(sources.runId, runId)));

    if (result.rowCount === 0) return false;

    // Delete the orphaned source_summary artifact row
    await tx
      .delete(artifacts)
      .where(
        and(
          eq(artifacts.runId, runId),
          eq(artifacts.type, "source_summary"),
          eq(artifacts.sourceId, sourceId)
        )
      );

    return true;
  });
}

/**
 * Incrementally add a single agent-discovered source to the workspace.
 * Inserts a source row + source_summary artifact atomically.
 */
export async function addAgentDiscoveredSource(params: {
  runId: string;
  sourceId: string;
  name: string;
  origin?: "uploaded" | "discovered";
  mimeType: string;
  storagePath: string;
  metadata: Record<string, unknown>;
  sourceChunks?: SourceChunk[];
  summaryContent: string;
}): Promise<void> {
  const serializedMetadata = {
    ...params.metadata,
    ...(params.sourceChunks && params.sourceChunks.length > 0
      ? {
          sourceChunks: params.sourceChunks.map((chunk) => ({
            chunkIndex: chunk.chunkIndex,
            headingPath: chunk.headingPath,
            tokenEstimate: chunk.tokenEstimate,
            charCount: chunk.charCount,
            blobKey: chunk.blobKey,
          })),
        }
      : {}),
  };

  await db.transaction(async (tx) => {
    await tx.insert(sources).values({
      id: params.sourceId,
      runId: params.runId,
      name: params.name,
      origin: params.origin ?? "discovered",
      mimeType: params.mimeType,
      checksum: null,
      storagePath: params.storagePath,
      parseStatus: "parsed",
      parsedContent: null,
      metadata: serializedMetadata,
    });

    if (params.sourceChunks && params.sourceChunks.length > 0) {
      await tx.insert(sourceChunksTable).values(
        params.sourceChunks.map((chunk) => ({
          sourceId: chunk.sourceId,
          chunkIndex: chunk.chunkIndex,
          headingPath: chunk.headingPath,
          tokenEstimate: chunk.tokenEstimate,
          blobKey: chunk.blobKey,
        }))
      );
    }

    await tx.insert(artifacts).values({
      runId: params.runId,
      type: "source_summary",
      content: params.summaryContent,
      sourceId: params.sourceId,
    });
  });
}
