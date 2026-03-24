import { and, eq, inArray } from "drizzle-orm";
import type { Artifacts, SourceChunk, SourceEntry } from "@/lib/engine/state";
import { db } from "./client";
import {
  artifacts,
  experiments,
  notes,
  papers,
  sources,
  sourceChunks as sourceChunksTable,
} from "./schema";

// ── Partial artifact updates (auto-save from workspace editor) ──

export const ARTIFACT_KEY_TO_TYPE: Record<string, "overview" | "synthesis" | "claims" | "gaps" | "next_steps"> = {
  overview: "overview",
  synthesis: "synthesis",
  claims: "claims",
  gaps: "gaps",
  nextSteps: "next_steps",
};

export async function persistResearchArtifacts({
  runId,
  sources: runSources,
  sourceChunks,
  artifacts: runArtifacts,
  sourceFolders,
}: {
  runId: string;
  sources: SourceEntry[];
  sourceChunks?: SourceChunk[];
  artifacts: Artifacts;
  sourceFolders?: Record<string, string[]>;
}) {
  // Invert folders map: folderName→sourceIds[] → sourceId→folderName
  const sourceToFolder: Record<string, string> = {};
  if (sourceFolders) {
    for (const [folderName, ids] of Object.entries(sourceFolders)) {
      for (const id of ids) sourceToFolder[id] = folderName;
    }
  }

  const sourceChunksBySource = (sourceChunks ?? []).reduce<Record<string, SourceChunk[]>>(
    (acc, chunk) => {
      if (!acc[chunk.sourceId]) {
        acc[chunk.sourceId] = [];
      }
      acc[chunk.sourceId].push(chunk);
      return acc;
    },
    {}
  );
  const sourceRows = runSources.map((source) => ({
    id: source.sourceId,
    runId,
    name: source.name,
    origin: source.origin,
    mimeType: source.mimeType || null,
    checksum: source.checksum || null,
    storagePath: source.storageUrl || null,
    parseStatus: source.parseStatus,
    parsedContent: null,
    metadata: {
      ...((source.metadata as unknown as Record<string, unknown>) ?? {}),
      ...(sourceToFolder[source.sourceId] ? { folder: sourceToFolder[source.sourceId] } : {}),
      ...(sourceChunksBySource[source.sourceId]
        ? {
            sourceChunks: sourceChunksBySource[source.sourceId].map((chunk) => ({
              chunkIndex: chunk.chunkIndex,
              headingPath: chunk.headingPath,
              tokenEstimate: chunk.tokenEstimate,
              charCount: chunk.charCount,
              blobKey: chunk.blobKey,
            })),
          }
        : {}),
    },
  }));
  const sourceChunkRows = (sourceChunks ?? []).map((chunk) => ({
    sourceId: chunk.sourceId,
    chunkIndex: chunk.chunkIndex,
    headingPath: chunk.headingPath,
    tokenEstimate: chunk.tokenEstimate,
    blobKey: chunk.blobKey,
  }));

  const artifactRows = [
    { runId, type: "overview" as const, content: runArtifacts.overview, sourceId: null },
    { runId, type: "synthesis" as const, content: runArtifacts.synthesis, sourceId: null },
    { runId, type: "claims" as const, content: runArtifacts.claims, sourceId: null },
    { runId, type: "gaps" as const, content: runArtifacts.gaps, sourceId: null },
    { runId, type: "next_steps" as const, content: runArtifacts.nextSteps, sourceId: null },
    ...Object.entries(runArtifacts.sources).map(([sourceId, content]) => ({
      runId,
      type: "source_summary" as const,
      content,
      sourceId,
    })),
  ];

  await db.transaction(async (tx) => {
    await tx.delete(artifacts).where(eq(artifacts.runId, runId));
    if (runSources.length > 0) {
      await tx
        .delete(sourceChunksTable)
        .where(inArray(sourceChunksTable.sourceId, runSources.map((source) => source.sourceId)));
    }
    await tx.delete(sources).where(eq(sources.runId, runId));

    if (sourceRows.length > 0) {
      await tx.insert(sources).values(sourceRows);
    }

    if (sourceChunkRows.length > 0) {
      await tx.insert(sourceChunksTable).values(sourceChunkRows);
    }

    await tx.insert(artifacts).values(artifactRows);
  });
}

export async function getPersistedArtifacts(runId: string) {
  const [artifactRows, paperRows, noteRows, experimentRows] = await Promise.all([
    db
      .select({
        type: artifacts.type,
        content: artifacts.content,
        sourceId: artifacts.sourceId,
      })
      .from(artifacts)
      .where(eq(artifacts.runId, runId)),
    db
      .select({ id: papers.id, content: papers.content })
      .from(papers)
      .where(eq(papers.runId, runId)),
    db
      .select({ id: notes.id, content: notes.content })
      .from(notes)
      .where(eq(notes.runId, runId)),
    db
      .select({ id: experiments.id, content: experiments.content })
      .from(experiments)
      .where(eq(experiments.runId, runId)),
  ]);

  if (artifactRows.length === 0 && paperRows.length === 0 && noteRows.length === 0 && experimentRows.length === 0) {
    return null;
  }

  const reconstructed: Artifacts = {
    overview: "",
    synthesis: "",
    claims: "",
    gaps: "",
    nextSteps: "",
    sources: {},
    papers: {},
    notes: {},
    experiments: {},
  };

  for (const row of artifactRows) {
    if (row.type === "overview") {
      reconstructed.overview = row.content;
      continue;
    }
    if (row.type === "synthesis") {
      reconstructed.synthesis = row.content;
      continue;
    }
    if (row.type === "claims") {
      reconstructed.claims = row.content;
      continue;
    }
    if (row.type === "gaps") {
      reconstructed.gaps = row.content;
      continue;
    }
    if (row.type === "next_steps") {
      reconstructed.nextSteps = row.content;
      continue;
    }
    if (row.type === "source_summary" && row.sourceId) {
      reconstructed.sources[row.sourceId] = row.content;
    }
  }

  for (const row of paperRows) {
    reconstructed.papers[row.id] = row.content;
  }

  for (const row of noteRows) {
    reconstructed.notes[row.id] = row.content;
  }

  for (const row of experimentRows) {
    reconstructed.experiments[row.id] = row.content;
  }

  return reconstructed;
}

export async function updateArtifactContents(
  runId: string,
  edits: Record<string, string>
) {
  await db.transaction(async (tx) => {
    for (const [key, content] of Object.entries(edits)) {
      if (key.startsWith("paper:")) {
        const paperId = key.slice(6);
        const updated = await tx
          .update(papers)
          .set({ content, updatedAt: new Date() })
          .where(and(eq(papers.id, paperId), eq(papers.runId, runId)));
        if (updated.rowCount === 0) {
          await tx.insert(papers).values({ id: paperId, runId, content });
        }
      } else if (key.startsWith("note:")) {
        const noteId = key.slice(5);
        const updated = await tx
          .update(notes)
          .set({ content, updatedAt: new Date() })
          .where(and(eq(notes.id, noteId), eq(notes.runId, runId)));
        if (updated.rowCount === 0) {
          await tx.insert(notes).values({ id: noteId, runId, label: "Note", content });
        }
      } else if (key.startsWith("experiment:")) {
        const experimentId = key.slice(11);
        // Extract title from JSON content if present
        let title: string | undefined;
        try {
          const parsed = JSON.parse(content);
          if (typeof parsed?.title === "string") title = parsed.title;
        } catch { /* not JSON */ }
        const updated = await tx
          .update(experiments)
          .set({ content, updatedAt: new Date(), ...(title ? { title } : {}) })
          .where(and(eq(experiments.id, experimentId), eq(experiments.runId, runId)));
        if (updated.rowCount === 0) {
          await tx.insert(experiments).values({ id: experimentId, runId, title: title || "Experiment", content });
        }
      } else if (key.startsWith("source:")) {
        const sourceId = key.slice(7);
        await tx
          .update(artifacts)
          .set({ content })
          .where(
            and(
              eq(artifacts.runId, runId),
              eq(artifacts.type, "source_summary"),
              eq(artifacts.sourceId, sourceId)
            )
          );
      } else {
        const dbType = ARTIFACT_KEY_TO_TYPE[key];
        if (!dbType) continue;
        await tx
          .update(artifacts)
          .set({ content })
          .where(and(eq(artifacts.runId, runId), eq(artifacts.type, dbType)));
      }
    }
  });
}

export async function getPersistedSourcesForRun(runId: string): Promise<SourceEntry[]> {
  const rows = await db
    .select({
      id: sources.id,
      name: sources.name,
      origin: sources.origin,
      mimeType: sources.mimeType,
      checksum: sources.checksum,
      storagePath: sources.storagePath,
      parseStatus: sources.parseStatus,
      metadata: sources.metadata,
    })
    .from(sources)
    .where(eq(sources.runId, runId));

  return rows.map((row) => ({
    sourceId: row.id,
    name: row.name,
    origin: row.origin,
    mimeType: row.mimeType ?? "application/octet-stream",
    checksum: row.checksum ?? "",
    storageUrl: row.storagePath ?? "",
    parseStatus: row.parseStatus,
    metadata: ((row.metadata as Record<string, unknown> | null) ?? undefined) as SourceEntry["metadata"],
  }));
}
