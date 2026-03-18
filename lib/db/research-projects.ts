import { and, desc, eq } from "drizzle-orm";
import type { Artifacts, SourceChunk, SourceEntry, UserInput } from "@/lib/engine/state";
import type { PaperQualityMeta } from "@/lib/discovery/paper-quality";
import { db } from "./client";
import {
  artifacts,
  experiments,
  notes,
  papers,
  projects,
  runs,
  sources,
  sourceChunks as sourceChunksTable,
  userInputs,
} from "./schema";

const MAX_PROJECT_TITLE_LENGTH = 500;

export interface SourceMeta {
  name: string;
  origin: "uploaded" | "discovered";
  folder?: string;
  sourceUrl?: string;
  paperQuality?: PaperQualityMeta;
}

export interface NoteMeta {
  label: string;
  folder?: string;
}

export interface ExperimentMeta {
  title: string;
}

export type ResearchRunStatus =
  | "queued"
  | "running"
  | "awaiting_confirmation"
  | "failed"
  | "partial"
  | "completed";

export interface DashboardProjectRecord {
  id: string;
  runId: string | null;
  title: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OwnedRunRecord {
  runId: string;
  projectId: string;
  status: string;
  currentStep: string | null;
}

export function buildProjectTitle(researchQuestion: string): string {
  const normalized = researchQuestion.trim().replace(/\s+/g, " ");
  return normalized.slice(0, MAX_PROJECT_TITLE_LENGTH) || "Untitled research";
}

export async function updateProjectTitle(projectId: string, title: string) {
  await db
    .update(projects)
    .set({ title: title.slice(0, MAX_PROJECT_TITLE_LENGTH), updatedAt: new Date() })
    .where(eq(projects.id, projectId));
}

export async function createResearchProjectRun({
  projectId,
  runId,
  userId,
  input,
  status,
  currentStep = "",
  startedAt,
  completedAt,
}: {
  projectId: string;
  runId: string;
  userId: string;
  input: UserInput;
  status: ResearchRunStatus;
  currentStep?: string;
  startedAt?: Date;
  completedAt?: Date | null;
}) {
  const now = startedAt ?? new Date();
  const trimmedQuestion = input.researchQuestion.trim();

  await db.transaction(async (tx) => {
    await tx.insert(projects).values({
      id: projectId,
      userId,
      title: buildProjectTitle(trimmedQuestion),
      status,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(runs).values({
      id: runId,
      projectId,
      status,
      currentStep,
      startedAt: now,
      completedAt,
    });

    await tx.insert(userInputs).values({
      runId,
      researchQuestion: trimmedQuestion,
      researchIntent: input.researchIntent?.trim() || null,
      workingHypothesis: input.workingHypothesis?.trim() || null,
      scopeBoundaries: input.scopeBoundaries?.trim() || null,
      mustAnswerQuestions:
        input.mustAnswerQuestions?.map((question) => question.trim()).filter(Boolean) ||
        null,
      audience: input.audience?.trim() || null,
      geography: input.geography?.trim() || null,
      timeHorizon: input.timeHorizon?.trim() || null,
      outputLanguage: input.outputLanguage?.trim() || null,
    });
  });
}

export async function updateResearchRunStatus({
  projectId,
  runId,
  status,
  currentStep,
  completedAt,
}: {
  projectId: string;
  runId: string;
  status: ResearchRunStatus;
  currentStep?: string;
  completedAt?: Date | null;
}) {
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.update(runs).set({
      status,
      ...(currentStep !== undefined ? { currentStep } : {}),
      ...(completedAt !== undefined ? { completedAt } : {}),
    }).where(eq(runs.id, runId));

    await tx.update(projects).set({
      status,
      updatedAt: now,
    }).where(eq(projects.id, projectId));
  });
}

export async function listResearchProjectsForUser(userId: string) {
  const rows = await db
    .select({
      id: projects.id,
      runId: runs.id,
      title: projects.title,
      status: projects.status,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      runStartedAt: runs.startedAt,
    })
    .from(projects)
    .leftJoin(runs, eq(runs.projectId, projects.id))
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.createdAt), desc(runs.startedAt));

  const seen = new Set<string>();
  const deduped: DashboardProjectRecord[] = [];

  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    deduped.push({
      id: row.id,
      runId: row.runId,
      title: row.title,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  return deduped;
}

export async function getOwnedResearchRun(userId: string, runId: string) {
  const [row] = await db
    .select({
      runId: runs.id,
      projectId: runs.projectId,
      status: runs.status,
      currentStep: runs.currentStep,
    })
    .from(runs)
    .innerJoin(projects, eq(runs.projectId, projects.id))
    .where(and(eq(runs.id, runId), eq(projects.userId, userId)))
    .limit(1);

  return (row ?? null) as OwnedRunRecord | null;
}

export async function getResearchRun(runId: string) {
  const [row] = await db
    .select({
      runId: runs.id,
      projectId: runs.projectId,
      status: runs.status,
      currentStep: runs.currentStep,
    })
    .from(runs)
    .where(eq(runs.id, runId))
    .limit(1);

  return (row ?? null) as OwnedRunRecord | null;
}

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

  const paperRows = Object.entries(runArtifacts.papers || {}).map(([paperId, content]) => ({
    id: paperId,
    runId,
    content,
  }));

  const noteRows = Object.entries(runArtifacts.notes || {}).map(([noteId, content]) => ({
    id: noteId,
    runId,
    label: "Note",
    content,
  }));

  const experimentRows = Object.entries(runArtifacts.experiments || {}).map(([experimentId, content]) => ({
    id: experimentId,
    runId,
    title: "Experiment",
    content,
  }));

  await db.transaction(async (tx) => {
    await tx.delete(artifacts).where(eq(artifacts.runId, runId));
    await tx.delete(papers).where(eq(papers.runId, runId));
    await tx.delete(notes).where(eq(notes.runId, runId));
    await tx.delete(experiments).where(eq(experiments.runId, runId));
    await tx.delete(sources).where(eq(sources.runId, runId));

    if (sourceRows.length > 0) {
      await tx.insert(sources).values(sourceRows);
    }

    if (sourceChunkRows.length > 0) {
      await tx.insert(sourceChunksTable).values(sourceChunkRows);
    }

    await tx.insert(artifacts).values(artifactRows);

    if (paperRows.length > 0) {
      await tx.insert(papers).values(paperRows);
    }

    if (noteRows.length > 0) {
      await tx.insert(notes).values(noteRows);
    }

    if (experimentRows.length > 0) {
      await tx.insert(experiments).values(experimentRows);
    }
  });
}

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

// ── Partial artifact updates (auto-save from workspace editor) ──

const ARTIFACT_KEY_TO_TYPE: Record<string, "overview" | "synthesis" | "claims" | "gaps" | "next_steps"> = {
  overview: "overview",
  synthesis: "synthesis",
  claims: "claims",
  gaps: "gaps",
  nextSteps: "next_steps",
};

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
        const updated = await tx
          .update(experiments)
          .set({ content, updatedAt: new Date() })
          .where(and(eq(experiments.id, experimentId), eq(experiments.runId, runId)));
        if (updated.rowCount === 0) {
          await tx.insert(experiments).values({ id: experimentId, runId, title: "Experiment", content });
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
  summaryContent: string;
}): Promise<void> {
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
      metadata: params.metadata,
    });

    await tx.insert(artifacts).values({
      runId: params.runId,
      type: "source_summary",
      content: params.summaryContent,
      sourceId: params.sourceId,
    });
  });
}

export async function deletePaper(runId: string, paperId: string): Promise<boolean> {
  const result = await db
    .delete(papers)
    .where(and(eq(papers.id, paperId), eq(papers.runId, runId)));

  return (result.rowCount ?? 0) > 0;
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

// ── Experiments ──

export async function createExperiment(
  runId: string,
  params: { id?: string; title: string; content?: string }
): Promise<string> {
  const id = params.id ?? crypto.randomUUID();
  await db.insert(experiments).values({
    id,
    runId,
    title: params.title,
    content: params.content ?? "",
  });
  return id;
}

export async function deleteExperiment(runId: string, experimentId: string): Promise<boolean> {
  const result = await db
    .delete(experiments)
    .where(and(eq(experiments.id, experimentId), eq(experiments.runId, runId)));

  return (result.rowCount ?? 0) > 0;
}

export async function getExperimentMetadataForRun(
  runId: string
): Promise<Record<string, ExperimentMeta>> {
  const rows = await db
    .select({
      id: experiments.id,
      title: experiments.title,
    })
    .from(experiments)
    .where(eq(experiments.runId, runId));

  const result: Record<string, ExperimentMeta> = {};
  for (const row of rows) {
    result[row.id] = { title: row.title };
  }
  return result;
}

// ── Notes CRUD ──

export async function createNote(
  runId: string,
  params: { id?: string; label: string; folder?: string; content?: string }
): Promise<string> {
  const id = params.id ?? crypto.randomUUID();
  await db.insert(notes).values({
    id,
    runId,
    label: params.label,
    folder: params.folder ?? null,
    content: params.content ?? "",
  });
  return id;
}

export async function deleteNote(runId: string, noteId: string): Promise<boolean> {
  const result = await db
    .delete(notes)
    .where(and(eq(notes.id, noteId), eq(notes.runId, runId)));
  return (result.rowCount ?? 0) > 0;
}

export async function updateNoteMeta(
  runId: string,
  noteId: string,
  updates: { label?: string; folder?: string | null }
): Promise<boolean> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.label !== undefined) set.label = updates.label;
  if (updates.folder !== undefined) set.folder = updates.folder;

  const result = await db
    .update(notes)
    .set(set)
    .where(and(eq(notes.id, noteId), eq(notes.runId, runId)));
  return (result.rowCount ?? 0) > 0;
}

export async function getNoteMetadataForRun(
  runId: string
): Promise<Record<string, NoteMeta>> {
  const rows = await db
    .select({
      id: notes.id,
      label: notes.label,
      folder: notes.folder,
    })
    .from(notes)
    .where(eq(notes.runId, runId));

  const result: Record<string, NoteMeta> = {};
  for (const row of rows) {
    result[row.id] = {
      label: row.label,
      ...(row.folder ? { folder: row.folder } : {}),
    };
  }
  return result;
}
