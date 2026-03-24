import { randomUUID } from "node:crypto";
import path from "node:path";
import { access, readdir, symlink } from "node:fs/promises";
import type {
  Artifacts,
  SourceChunk,
  SourceEntry,
  SourceMetadata,
  UserInput,
} from "@/lib/engine/state";
import { readLocalCodexAuthTokens } from "@/lib/auth/codex-local-auth";
import { decryptTokens, encryptTokens } from "@/lib/auth/token-crypto";
import type { StorageAdapter } from "./adapter";
import type { ProviderTokens, CredentialValidation, OpenAIAuthTokens } from "./credential-types";
import { getBootstrapCredentialValidation } from "./credential-types";
import type { SessionMessage, SessionSummary, NewSessionMessage } from "./chat-types";
import type { StoredUser, UpsertUserParams } from "./user-types";
import {
  buildProjectTitle,
  buildWorkspaceTitle,
  type DashboardProjectRecord,
  type ExperimentMeta,
  type NoteMeta,
  type OwnedRunRecord,
  type ResearchRunStatus,
  type SourceMeta,
} from "./project-types";
import { buildDefaultElectronUser, isElectronRuntime } from "./local-user";
import {
  atomicWriteJson,
  atomicWriteText,
  ensureDir,
  readJsonFile,
  readTextFile,
  removePath,
  withFileLock,
} from "./fs-utils";

interface ProjectIndexEntry {
  id: string;
  userId: string;
  runId: string | null;
  title: string;
  status: string;
  workspacePath?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProjectFileRecord {
  id: string;
  userId: string;
  title: string;
  status: string;
  workspacePath?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RunFileRecord {
  id: string;
  projectId: string;
  status: string;
  currentStep: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface NoteIndexEntry {
  id: string;
  label: string;
  folder: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ExperimentIndexEntry {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface PaperIndexEntry {
  id: string;
  createdAt: string;
  updatedAt: string;
}

interface SessionIndexEntry {
  id: string;
  runId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserFileRecord {
  user: StoredUser & { createdAt: string };
  credentials?: {
    kind: "openai_auth";
    encryptedTokens?: string;
    tokens?: OpenAIAuthTokens;
    validation: CredentialValidation;
    updatedAt: string;
  } | null;
}

function normalizeUserInput(input: UserInput): UserInput {
  return {
    researchQuestion: input.researchQuestion.trim(),
    researchIntent: input.researchIntent?.trim() || undefined,
    workingHypothesis: input.workingHypothesis?.trim() || undefined,
    scopeBoundaries: input.scopeBoundaries?.trim() || undefined,
    mustAnswerQuestions:
      input.mustAnswerQuestions?.map((question) => question.trim()).filter(Boolean) ||
      undefined,
    audience: input.audience?.trim() || undefined,
    geography: input.geography?.trim() || undefined,
    timeHorizon: input.timeHorizon?.trim() || undefined,
    outputLanguage: input.outputLanguage?.trim() || undefined,
    ...(input.searchFilters ? { searchFilters: input.searchFilters } : {}),
  };
}

function toOwnedRun(run: RunFileRecord): OwnedRunRecord {
  return {
    runId: run.id,
    projectId: run.projectId,
    status: run.status,
    currentStep: run.currentStep,
  };
}

function maybeTokenError(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to read local Codex auth.";
}

export function createFsAdapter(dataDir: string): StorageAdapter {
  const projectsRoot = path.join(dataDir, "projects");
  const projectIndexPath = path.join(projectsRoot, "index.json");
  const userPath = path.join(dataDir, "user.json");

  const adapter: StorageAdapter = {
    async listResearchProjectsForUser(userId: string): Promise<DashboardProjectRecord[]> {
      const entries = await getProjectIndex();
      return entries
        .filter((entry) => entry.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((entry) => ({
          id: entry.id,
          runId: entry.runId,
          title: entry.title,
          status: entry.status,
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt),
        }));
    },

    async createResearchProjectRun(params) {
      const now = (params.startedAt ?? new Date()).toISOString();
      const normalizedInput = normalizeUserInput(params.input);
      const title = buildProjectTitle(normalizedInput.researchQuestion);
      const workspacePath = normalizeWorkspacePath(params.workspacePath);

      await withProjectLock(params.projectId, async () => {
        await ensureBaseState();
        await prepareProjectStorage(params.projectId, workspacePath);
        const projectRecord: ProjectFileRecord = {
          id: params.projectId,
          userId: params.userId,
          title,
          status: params.status,
          workspacePath,
          createdAt: now,
          updatedAt: now,
        };
        const runRecord: RunFileRecord = {
          id: params.runId,
          projectId: params.projectId,
          status: params.status,
          currentStep: params.currentStep ?? "",
          startedAt: now,
          completedAt: params.completedAt?.toISOString() ?? null,
        };

        await atomicWriteJson(projectFilePath(params.projectId), projectRecord);
        await atomicWriteJson(runFilePath(params.projectId), runRecord);
        await atomicWriteJson(inputFilePath(params.projectId), normalizedInput);
        await writeProjectIndex((entries) => [
          ...entries.filter((entry) => entry.id !== params.projectId),
          {
            id: params.projectId,
            userId: params.userId,
            runId: params.runId,
            title,
            status: params.status,
            workspacePath,
            createdAt: now,
            updatedAt: now,
          },
        ]);
      });
    },

    async createDraftWorkspaceProjectRun(params) {
      const now = (params.startedAt ?? new Date()).toISOString();
      const noteId = params.noteId ?? randomUUID();
      const title = buildWorkspaceTitle(params.title);
      const workspacePath = normalizeWorkspacePath(params.workspacePath);

      await withProjectLock(params.projectId, async () => {
        await ensureBaseState();
        await prepareProjectStorage(params.projectId, workspacePath);
        const projectRecord: ProjectFileRecord = {
          id: params.projectId,
          userId: params.userId,
          title,
          status: "draft",
          workspacePath,
          createdAt: now,
          updatedAt: now,
        };
        const runRecord: RunFileRecord = {
          id: params.runId,
          projectId: params.projectId,
          status: "draft",
          currentStep: "",
          startedAt: now,
          completedAt: null,
        };
        const noteIndex: NoteIndexEntry[] = [
          {
            id: noteId,
            label: "Scratchpad",
            folder: null,
            createdAt: now,
            updatedAt: now,
          },
        ];

        await atomicWriteJson(projectFilePath(params.projectId), projectRecord);
        await atomicWriteJson(runFilePath(params.projectId), runRecord);
        await atomicWriteJson(notesIndexPath(params.projectId), noteIndex);
        await atomicWriteText(noteContentPath(params.projectId, noteId), "");
        await writeProjectIndex((entries) => [
          ...entries.filter((entry) => entry.id !== params.projectId),
          {
            id: params.projectId,
            userId: params.userId,
            runId: params.runId,
            title,
            status: "draft",
            workspacePath,
            createdAt: now,
            updatedAt: now,
          },
        ]);
      });

      return { title, noteId };
    },

    async updateResearchRunStatus(params) {
      const projectId = params.projectId;
      await withProjectLock(projectId, async () => {
        const run = await readRunByProjectId(projectId);
        if (!run) return;

        const updatedRun: RunFileRecord = {
          ...run,
          status: params.status,
          currentStep:
            params.currentStep !== undefined ? params.currentStep : run.currentStep,
          completedAt:
            params.completedAt !== undefined
              ? params.completedAt?.toISOString() ?? null
              : run.completedAt,
        };

        await atomicWriteJson(runFilePath(projectId), updatedRun);
        await atomicWriteJson(projectFilePath(projectId), {
          ...(await readProjectFile(projectId)),
          status: params.status,
          updatedAt: new Date().toISOString(),
        });
        await writeProjectIndex((entries) =>
          entries.map((entry) =>
            entry.id === projectId
              ? {
                  ...entry,
                  status: params.status,
                  updatedAt: new Date().toISOString(),
                }
              : entry
          )
        );
      });
    },

    async upsertResearchRunInput({ runId, input }) {
      const projectId = await getProjectIdForRun(runId);
      if (!projectId) return;

      await withProjectLock(projectId, async () => {
        await atomicWriteJson(inputFilePath(projectId), normalizeUserInput(input));
      });
    },

    async updateProjectTitle(projectId, title) {
      await withProjectLock(projectId, async () => {
        const project = await readProjectFile(projectId);
        if (!project) return;
        const nextTitle = title.slice(0, 500);
        const updatedAt = new Date().toISOString();

        await atomicWriteJson(projectFilePath(projectId), {
          ...project,
          title: nextTitle,
          updatedAt,
        });
        await writeProjectIndex((entries) =>
          entries.map((entry) =>
            entry.id === projectId
              ? { ...entry, title: nextTitle, updatedAt }
              : entry
          )
        );
      });
    },

    async getOwnedResearchRun(userId, runId) {
      const projectId = await getProjectIdForRun(runId);
      if (!projectId) return null;
      const entry = (await getProjectIndex()).find(
        (item) => item.id === projectId && item.userId === userId
      );
      if (!entry) return null;
      const run = await readRunByProjectId(projectId);
      return run ? toOwnedRun(run) : null;
    },

    async getResearchRun(runId) {
      const projectId = await getProjectIdForRun(runId);
      if (!projectId) return null;
      const run = await readRunByProjectId(projectId);
      return run ? toOwnedRun(run) : null;
    },

    async deleteProjectForUser(userId, projectId) {
      await withProjectLock(projectId, async () => {
        const entries = await getProjectIndex();
        const target = entries.find(
          (entry) => entry.id === projectId && entry.userId === userId
        );
        if (!target) return;

        const storageDir = resolveProjectStorageDir(target);
        if (storageDir !== projectDir(projectId)) {
          await removePath(storageDir);
          if (target.workspacePath) {
            await removePath(workspaceVisibleDir(target.workspacePath));
          }
        }
        await removePath(projectDir(projectId));
        await writeProjectIndex((current) =>
          current.filter((entry) => entry.id !== projectId)
        );
      });
    },

    async persistResearchArtifacts({
      runId,
      sources,
      sourceChunks,
      artifacts,
      sourceFolders,
    }) {
      const projectId = await getProjectIdForRun(runId);
      if (!projectId) return;

      await withProjectLock(projectId, async () => {
        const sourceToFolder: Record<string, string> = {};
        for (const [folderName, ids] of Object.entries(sourceFolders ?? {})) {
          for (const id of ids) {
            sourceToFolder[id] = folderName;
          }
        }

        const chunksBySource = (sourceChunks ?? []).reduce<Record<string, SourceChunk[]>>(
          (acc, chunk) => {
            if (!acc[chunk.sourceId]) {
              acc[chunk.sourceId] = [];
            }
            acc[chunk.sourceId].push(chunk);
            return acc;
          },
          {}
        );

        const normalizedSources = sources.map((source) => ({
          ...source,
          metadata: {
            ...(source.metadata ?? {}),
            ...(sourceToFolder[source.sourceId]
              ? { folder: sourceToFolder[source.sourceId] }
              : {}),
            ...(chunksBySource[source.sourceId]
              ? {
                  sourceChunks: chunksBySource[source.sourceId].map((chunk) => ({
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

        await atomicWriteJson(sourcesIndexPath(projectId), normalizedSources);
        await writeArtifactText(projectId, "overview.md", artifacts.overview);
        await writeArtifactText(projectId, "synthesis.md", artifacts.synthesis);
        await writeArtifactText(projectId, "claims.md", artifacts.claims);
        await writeArtifactText(projectId, "gaps.md", artifacts.gaps);
        await writeArtifactText(projectId, "next-steps.md", artifacts.nextSteps);

        await removePath(sourceSummariesDir(projectId));
        for (const [sourceId, content] of Object.entries(artifacts.sources)) {
          await atomicWriteText(sourceSummaryPath(projectId, sourceId), content);
        }
      });
    },

    async getPersistedArtifacts(runId) {
      const entry = await getProjectEntryForRun(runId);
      if (!entry) return null;
      const projectId = entry.id;

      if (entry.workspacePath) {
        await ensureWorkspaceSurface(entry.workspacePath);
      }

      const notesIndex = await readJsonFile<NoteIndexEntry[]>(
        notesIndexPath(projectId),
        []
      );
      const papersIndex = await readJsonFile<PaperIndexEntry[]>(
        papersIndexPath(projectId),
        []
      );
      const experimentsIndex = await readJsonFile<ExperimentIndexEntry[]>(
        experimentsIndexPath(projectId),
        []
      );
      const sources = await readJsonFile<SourceEntry[]>(sourcesIndexPath(projectId), []);

      const reconstructed: Artifacts = {
        overview: await readTextFile(artifactPath(projectId, "overview.md")),
        synthesis: await readTextFile(artifactPath(projectId, "synthesis.md")),
        claims: await readTextFile(artifactPath(projectId, "claims.md")),
        gaps: await readTextFile(artifactPath(projectId, "gaps.md")),
        nextSteps: await readTextFile(artifactPath(projectId, "next-steps.md")),
        sources: {},
        papers: {},
        notes: {},
        experiments: {},
      };

      for (const source of sources) {
        reconstructed.sources[source.sourceId] = await readTextFile(
          sourceSummaryPath(projectId, source.sourceId)
        );
      }

      for (const note of notesIndex) {
        reconstructed.notes[note.id] = await readTextFile(
          noteContentPath(projectId, note.id)
        );
      }

      for (const paper of papersIndex) {
        reconstructed.papers[paper.id] = await readTextFile(
          paperContentPath(projectId, paper.id)
        );
      }

      for (const experiment of experimentsIndex) {
        reconstructed.experiments[experiment.id] = await readTextFile(
          experimentContentPath(projectId, experiment.id)
        );
      }

      const hasPersistedState =
        !!reconstructed.overview ||
        !!reconstructed.synthesis ||
        !!reconstructed.claims ||
        !!reconstructed.gaps ||
        !!reconstructed.nextSteps ||
        notesIndex.length > 0 ||
        papersIndex.length > 0 ||
        experimentsIndex.length > 0 ||
        sources.length > 0;

      return hasPersistedState ? reconstructed : null;
    },

    async updateArtifactContents(runId, edits) {
      const projectId = await getProjectIdForRun(runId);
      if (!projectId) return;

      await withProjectLock(projectId, async () => {
        for (const [key, content] of Object.entries(edits)) {
          if (key === "overview") {
            await writeArtifactText(projectId, "overview.md", content);
            continue;
          }
          if (key === "synthesis") {
            await writeArtifactText(projectId, "synthesis.md", content);
            continue;
          }
          if (key === "claims") {
            await writeArtifactText(projectId, "claims.md", content);
            continue;
          }
          if (key === "gaps") {
            await writeArtifactText(projectId, "gaps.md", content);
            continue;
          }
          if (key === "nextSteps") {
            await writeArtifactText(projectId, "next-steps.md", content);
            continue;
          }
          if (key.startsWith("source:")) {
            await atomicWriteText(
              sourceSummaryPath(projectId, key.slice(7)),
              content
            );
            continue;
          }
          if (key.startsWith("note:")) {
            const noteId = key.slice(5);
            await upsertNoteIndex(projectId, noteId, {
              label: "Note",
            });
            await atomicWriteText(noteContentPath(projectId, noteId), content);
            continue;
          }
          if (key.startsWith("paper:")) {
            const paperId = key.slice(6);
            await upsertPaperIndex(projectId, paperId);
            await atomicWriteText(paperContentPath(projectId, paperId), content);
            continue;
          }
          if (key.startsWith("experiment:")) {
            const experimentId = key.slice(11);
            let title = "Experiment";
            try {
              const parsed = JSON.parse(content) as { title?: unknown };
              if (typeof parsed.title === "string" && parsed.title.trim()) {
                title = parsed.title;
              }
            } catch {
              // Keep fallback title.
            }
            await upsertExperimentIndex(projectId, experimentId, title);
            await atomicWriteText(
              experimentContentPath(projectId, experimentId),
              content
            );
          }
        }
      });
    },

    async getPersistedSourcesForRun(runId) {
      const projectId = await getProjectIdForRun(runId);
      if (!projectId) return [];
      return readJsonFile<SourceEntry[]>(sourcesIndexPath(projectId), []);
    },

    async getLocalWorkspaceFilePath(runId, fileKey) {
      const entry = await getProjectEntryForRun(runId);
      if (!entry) return null;

      if (entry.workspacePath) {
        await ensureWorkspaceSurface(entry.workspacePath);
      }

      const filePath = entry.workspacePath
        ? resolveVisibleWorkspaceFilePath(entry.workspacePath, fileKey)
        : resolveWorkspaceFilePath(resolveProjectStorageDir(entry), fileKey);
      if (!filePath) return null;

      try {
        await access(filePath);
        return filePath;
      } catch {
        return null;
      }
    },

    async getSourceMetadataForRun(runId): Promise<Record<string, SourceMeta>> {
      const sources = await this.getPersistedSourcesForRun(runId);
      const result: Record<string, SourceMeta> = {};
      for (const source of sources) {
        const metadata = (source.metadata ?? {}) as Record<string, unknown>;
        result[source.sourceId] = {
          name: source.name,
          origin: source.origin,
          ...(typeof metadata.folder === "string" ? { folder: metadata.folder } : {}),
          ...(typeof metadata.sourceUrl === "string"
            ? { sourceUrl: metadata.sourceUrl }
            : typeof metadata.resolvedUrl === "string"
              ? { sourceUrl: metadata.resolvedUrl }
              : {}),
          ...(metadata.paperQuality ? { paperQuality: metadata.paperQuality as SourceMeta["paperQuality"] } : {}),
        };
      }
      return result;
    },

    async deleteSource(runId, sourceId) {
      const projectId = await getProjectIdForRun(runId);
      if (!projectId) return false;

      return withProjectLock(projectId, async () => {
        const existing = await readJsonFile<SourceEntry[]>(sourcesIndexPath(projectId), []);
        const next = existing.filter((source) => source.sourceId !== sourceId);
        if (next.length === existing.length) {
          return false;
        }

        await atomicWriteJson(sourcesIndexPath(projectId), next);
        await removePath(sourceSummaryPath(projectId, sourceId));
        return true;
      });
    },

    async addAgentDiscoveredSource(params) {
      const projectId = await getProjectIdForRun(params.runId);
      if (!projectId) return;

      await withProjectLock(projectId, async () => {
        const sources = await readJsonFile<SourceEntry[]>(sourcesIndexPath(projectId), []);
        const serializedMetadata = {
          ...(params.metadata as unknown as SourceMetadata),
          ...(params.sourceChunks?.length
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
        } satisfies SourceMetadata;

        const nextEntry: SourceEntry = {
          sourceId: params.sourceId,
          name: params.name,
          origin: params.origin ?? "discovered",
          mimeType: params.mimeType,
          checksum: "",
          storageUrl: params.storagePath,
          parseStatus: "parsed",
          metadata: serializedMetadata,
        };

        await atomicWriteJson(
          sourcesIndexPath(projectId),
          [...sources.filter((source) => source.sourceId !== params.sourceId), nextEntry]
        );
        await atomicWriteText(
          sourceSummaryPath(projectId, params.sourceId),
          params.summaryContent
        );
      });
    },

    async createNote(runId, params) {
      const projectId = await getProjectIdForRun(runId);
      if (!projectId) {
        return params.id ?? randomUUID();
      }

      const id = params.id ?? randomUUID();
      await withProjectLock(projectId, async () => {
        const now = new Date().toISOString();
        const index = await readJsonFile<NoteIndexEntry[]>(notesIndexPath(projectId), []);
        await atomicWriteJson(notesIndexPath(projectId), [
          ...index.filter((note) => note.id !== id),
          {
            id,
            label: params.label,
            folder: params.folder ?? null,
            createdAt: now,
            updatedAt: now,
          },
        ]);
        await atomicWriteText(noteContentPath(projectId, id), params.content ?? "");
      });
      return id;
    },

    async deleteNote(runId, noteId) {
      const projectId = await getProjectIdForRun(runId);
      if (!projectId) return false;
      return withProjectLock(projectId, async () => {
        const index = await readJsonFile<NoteIndexEntry[]>(notesIndexPath(projectId), []);
        const next = index.filter((note) => note.id !== noteId);
        if (next.length === index.length) {
          return false;
        }
        await atomicWriteJson(notesIndexPath(projectId), next);
        await removePath(noteContentPath(projectId, noteId));
        return true;
      });
    },

    async updateNoteMeta(runId, noteId, updates) {
      const projectId = await getProjectIdForRun(runId);
      if (!projectId) return false;
      return withProjectLock(projectId, async () => {
        const index = await readJsonFile<NoteIndexEntry[]>(notesIndexPath(projectId), []);
        let updated = false;
        const next = index.map((note) => {
          if (note.id !== noteId) return note;
          updated = true;
          return {
            ...note,
            ...(updates.label !== undefined ? { label: updates.label } : {}),
            ...(updates.folder !== undefined ? { folder: updates.folder ?? null } : {}),
            updatedAt: new Date().toISOString(),
          };
        });
        if (!updated) return false;
        await atomicWriteJson(notesIndexPath(projectId), next);
        return true;
      });
    },

    async getNoteMetadataForRun(runId) {
      const projectId = await getProjectIdForRun(runId);
      if (!projectId) return {};
      const index = await readJsonFile<NoteIndexEntry[]>(notesIndexPath(projectId), []);
      return index.reduce<Record<string, NoteMeta>>((acc, note) => {
        acc[note.id] = {
          label: note.label,
          ...(note.folder ? { folder: note.folder } : {}),
        };
        return acc;
      }, {});
    },

    async createExperiment(runId, params) {
      const projectId = await getProjectIdForRun(runId);
      if (!projectId) {
        return params.id ?? randomUUID();
      }
      const id = params.id ?? randomUUID();
      await withProjectLock(projectId, async () => {
        await upsertExperimentIndex(projectId, id, params.title);
        await atomicWriteText(
          experimentContentPath(projectId, id),
          params.content ?? ""
        );
      });
      return id;
    },

    async deleteExperiment(runId, experimentId) {
      const projectId = await getProjectIdForRun(runId);
      if (!projectId) return false;
      return withProjectLock(projectId, async () => {
        const index = await readJsonFile<ExperimentIndexEntry[]>(
          experimentsIndexPath(projectId),
          []
        );
        const next = index.filter((entry) => entry.id !== experimentId);
        if (next.length === index.length) {
          return false;
        }
        await atomicWriteJson(experimentsIndexPath(projectId), next);
        await removePath(experimentContentPath(projectId, experimentId));
        return true;
      });
    },

    async getExperimentMetadataForRun(runId) {
      const projectId = await getProjectIdForRun(runId);
      if (!projectId) return {};
      const index = await readJsonFile<ExperimentIndexEntry[]>(
        experimentsIndexPath(projectId),
        []
      );
      return index.reduce<Record<string, ExperimentMeta>>((acc, entry) => {
        acc[entry.id] = { title: entry.title };
        return acc;
      }, {});
    },

    async deletePaper(runId, paperId) {
      const projectId = await getProjectIdForRun(runId);
      if (!projectId) return false;
      return withProjectLock(projectId, async () => {
        const index = await readJsonFile<PaperIndexEntry[]>(papersIndexPath(projectId), []);
        const next = index.filter((entry) => entry.id !== paperId);
        if (next.length === index.length) {
          return false;
        }
        await atomicWriteJson(papersIndexPath(projectId), next);
        await removePath(paperContentPath(projectId, paperId));
        return true;
      });
    },

    async getSessionsForRun(runId) {
      const projectId = await getProjectIdForRun(runId);
      if (!projectId) return [];
      const sessions = await readJsonFile<SessionIndexEntry[]>(sessionsIndexPath(projectId), []);
      const result: SessionSummary[] = [];
      for (const session of sessions) {
        const messages = await readJsonFile<SessionMessage[]>(
          sessionMessagesPath(projectId, session.id),
          []
        );
        result.push({
          id: session.id,
          title: session.title,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          messageCount: messages.length,
        });
      }
      return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async createSession(runId, title) {
      const projectId = await getProjectIdForRun(runId);
      if (!projectId) {
        return { id: randomUUID(), title: title ?? null };
      }
      const id = randomUUID();
      const now = new Date().toISOString();
      await withFileLock(`session:${id}`, async () => {
        const sessions = await readJsonFile<SessionIndexEntry[]>(
          sessionsIndexPath(projectId),
          []
        );
        await atomicWriteJson(sessionsIndexPath(projectId), [
          ...sessions,
          {
            id,
            runId,
            title: title ?? null,
            createdAt: now,
            updatedAt: now,
          },
        ]);
        await atomicWriteJson(sessionMessagesPath(projectId, id), []);
      });
      return { id, title: title ?? null };
    },

    async getSessionMessages(sessionId) {
      const location = await findSessionLocation(sessionId);
      if (!location) return [];
      return readJsonFile<SessionMessage[]>(
        sessionMessagesPath(location.projectId, sessionId),
        []
      );
    },

    async appendMessages(sessionId, messages) {
      const location = await findSessionLocation(sessionId);
      if (!location || messages.length === 0) return;
      await withFileLock(`session:${sessionId}`, async () => {
        const existing = await readJsonFile<SessionMessage[]>(
          sessionMessagesPath(location.projectId, sessionId),
          []
        );
        const now = new Date().toISOString();
        const appended = messages.map((message) => ({
          id: message.id ?? randomUUID(),
          role: message.role,
          text: message.text,
          metadata: message.metadata ?? null,
          createdAt: now,
        }));
        await atomicWriteJson(sessionMessagesPath(location.projectId, sessionId), [
          ...existing,
          ...appended,
        ]);
        await updateSessionIndexEntry(location.projectId, sessionId, {
          updatedAt: now,
        });
      });
    },

    async updateSessionTitle(sessionId, title) {
      const location = await findSessionLocation(sessionId);
      if (!location) return;
      await withFileLock(`session:${sessionId}`, async () => {
        await updateSessionIndexEntry(location.projectId, sessionId, {
          title,
          updatedAt: new Date().toISOString(),
        });
      });
    },

    async updateMessageMetadata(sessionId, messageId, metadata) {
      const location = await findSessionLocation(sessionId);
      if (!location) return;
      await withFileLock(`session:${sessionId}`, async () => {
        const messages = await readJsonFile<SessionMessage[]>(
          sessionMessagesPath(location.projectId, sessionId),
          []
        );
        await atomicWriteJson(
          sessionMessagesPath(location.projectId, sessionId),
          messages.map((message) =>
            message.id === messageId ? { ...message, metadata } : message
          )
        );
        await updateSessionIndexEntry(location.projectId, sessionId, {
          updatedAt: new Date().toISOString(),
        });
      });
    },

    async deleteSession(sessionId) {
      const location = await findSessionLocation(sessionId);
      if (!location) return;
      await withFileLock(`session:${sessionId}`, async () => {
        const sessions = await readJsonFile<SessionIndexEntry[]>(
          sessionsIndexPath(location.projectId),
          []
        );
        await atomicWriteJson(
          sessionsIndexPath(location.projectId),
          sessions.filter((session) => session.id !== sessionId)
        );
        await removePath(sessionDir(location.projectId, sessionId));
      });
    },

    async getUserByEmail(email) {
      const userFile = await readUserFile(true);
      if (!userFile) return null;
      return userFile.user.email === email ? stripUser(userFile.user) : null;
    },

    async getUserById(userId) {
      const userFile = await readUserFile(true);
      if (!userFile) return null;
      return userFile.user.id === userId ? stripUser(userFile.user) : null;
    },

    async upsertUser(params: UpsertUserParams) {
      const existing = await readUserFile(false);
      const now = new Date().toISOString();
      const nextUser = {
        id:
          params.id ??
          existing?.user.id ??
          (isElectronRuntime() ? buildDefaultElectronUser().id : randomUUID()),
        email: params.email,
        name: params.name,
        organization: params.organization ?? existing?.user.organization ?? null,
        authProvider: params.authProvider,
        createdAt: existing?.user.createdAt ?? now,
      };

      await atomicWriteJson(userPath, {
        ...(existing ?? {}),
        user: nextUser,
      });

      return stripUser(nextUser);
    },

    async updateUserProfile(userId, params) {
      const userFile = await readUserFile(true);
      if (!userFile || userFile.user.id !== userId) return;
      await atomicWriteJson(userPath, {
        ...userFile,
        user: {
          ...userFile.user,
          ...(params.name !== undefined ? { name: params.name } : {}),
          ...(params.organization !== undefined
            ? { organization: params.organization ?? null }
            : {}),
        },
      });
    },

    async getLLMCredentials(userId) {
      const userFile = await readUserFile(true);
      if (!userFile || userFile.user.id !== userId) {
        return null;
      }

      const stored = userFile.credentials;
      if (stored?.encryptedTokens && process.env.ENCRYPTION_KEY) {
        const tokens = decryptTokens(stored.encryptedTokens) as unknown as OpenAIAuthTokens;
        return {
          kind: "openai_auth",
          ...tokens,
          validation: stored.validation,
        };
      }

      if (stored?.tokens && !isElectronRuntime()) {
        return {
          kind: "openai_auth",
          ...stored.tokens,
          validation: stored.validation,
        };
      }

      if (!isElectronRuntime()) {
        return null;
      }

      try {
        const localTokens = await readLocalCodexAuthTokens();
        const bootstrap: ProviderTokens = {
          kind: "openai_auth",
          access: localTokens.accessToken,
          refresh: localTokens.refreshToken,
          expires: localTokens.expiresAt,
          accountId: localTokens.accountId,
          validation: stored?.validation ?? getBootstrapCredentialValidation(),
        };

        if (process.env.ENCRYPTION_KEY) {
          await this.upsertLLMCredentials(userId, bootstrap);
        }

        return bootstrap;
      } catch (error) {
        void maybeTokenError(error);
        return null;
      }
    },

    async upsertLLMCredentials(userId, tokens) {
      const userFile = await readUserFile(true);
      if (!userFile || userFile.user.id !== userId) return;

      const nextCredentials =
        process.env.ENCRYPTION_KEY
          ? {
              kind: "openai_auth" as const,
              encryptedTokens: encryptTokens({
                access: tokens.access,
                refresh: tokens.refresh,
                expires: tokens.expires,
                accountId: tokens.accountId,
              }),
              validation: tokens.validation,
              updatedAt: new Date().toISOString(),
            }
          : isElectronRuntime()
            ? userFile.credentials ?? null
            : {
                kind: "openai_auth" as const,
                tokens: {
                  access: tokens.access,
                  refresh: tokens.refresh,
                  expires: tokens.expires,
                  accountId: tokens.accountId,
                },
                validation: tokens.validation,
                updatedAt: new Date().toISOString(),
              };

      await atomicWriteJson(userPath, {
        ...userFile,
        ...(nextCredentials !== null ? { credentials: nextCredentials } : {}),
      });
    },

    async deleteLLMCredentials(userId) {
      const userFile = await readUserFile(true);
      if (!userFile || userFile.user.id !== userId) return;
      await atomicWriteJson(userPath, {
        ...userFile,
        credentials: null,
      });
    },
  };

  return adapter;

  function projectDir(projectId: string): string {
    return path.join(projectsRoot, projectId);
  }

  function normalizeWorkspacePath(
    workspacePath: string | undefined
  ): string | null {
    if (!workspacePath) {
      return null;
    }
    const trimmed = workspacePath.trim();
    if (!trimmed) {
      return null;
    }
    return path.resolve(trimmed);
  }

  function workspaceStorageDir(workspacePath: string): string {
    return path.join(workspacePath, ".lumen");
  }

  function workspaceVisibleDir(workspacePath: string): string {
    return path.join(workspacePath, "lumen");
  }

  function resolveProjectStorageDir(entry: Pick<ProjectIndexEntry, "id" | "workspacePath">): string {
    return entry.workspacePath
      ? workspaceStorageDir(entry.workspacePath)
      : projectDir(entry.id);
  }

  function projectFilePath(projectId: string): string {
    return path.join(projectDir(projectId), "project.json");
  }

  function runFilePath(projectId: string): string {
    return path.join(projectDir(projectId), "run.json");
  }

  function inputFilePath(projectId: string): string {
    return path.join(projectDir(projectId), "user-input.json");
  }

  function sourcesIndexPath(projectId: string): string {
    return path.join(projectDir(projectId), "sources", "index.json");
  }

  function artifactsDir(projectId: string): string {
    return path.join(projectDir(projectId), "artifacts");
  }

  function artifactPath(projectId: string, filename: string): string {
    return path.join(artifactsDir(projectId), filename);
  }

  function sourceSummariesDir(projectId: string): string {
    return path.join(artifactsDir(projectId), "source-summaries");
  }

  function sourceSummaryPath(projectId: string, sourceId: string): string {
    return path.join(sourceSummariesDir(projectId), `${sourceId}.md`);
  }

  function notesIndexPath(projectId: string): string {
    return path.join(projectDir(projectId), "notes", "index.json");
  }

  function noteContentPath(projectId: string, noteId: string): string {
    return path.join(projectDir(projectId), "notes", `${noteId}.md`);
  }

  function papersIndexPath(projectId: string): string {
    return path.join(projectDir(projectId), "papers", "index.json");
  }

  function paperContentPath(projectId: string, paperId: string): string {
    return path.join(projectDir(projectId), "papers", `${paperId}.tex`);
  }

  function experimentsIndexPath(projectId: string): string {
    return path.join(projectDir(projectId), "experiments", "index.json");
  }

  function experimentContentPath(projectId: string, experimentId: string): string {
    return path.join(projectDir(projectId), "experiments", `${experimentId}.json`);
  }

  function chatDir(projectId: string): string {
    return path.join(projectDir(projectId), "chat");
  }

  function sessionsIndexPath(projectId: string): string {
    return path.join(chatDir(projectId), "sessions.json");
  }

  function sessionDir(projectId: string, sessionId: string): string {
    return path.join(chatDir(projectId), sessionId);
  }

  function sessionMessagesPath(projectId: string, sessionId: string): string {
    return path.join(sessionDir(projectId, sessionId), "messages.json");
  }

  async function ensureBaseState() {
    await ensureDir(projectsRoot);
    const existing = await readJsonFile<ProjectIndexEntry[] | null>(
      projectIndexPath,
      null
    );
    if (existing === null) {
      await atomicWriteJson(projectIndexPath, []);
    }
  }

  async function readProjectFile(projectId: string): Promise<ProjectFileRecord | null> {
    return readJsonFile<ProjectFileRecord | null>(projectFilePath(projectId), null);
  }

  async function readRunByProjectId(projectId: string): Promise<RunFileRecord | null> {
    return readJsonFile<RunFileRecord | null>(runFilePath(projectId), null);
  }

  async function getProjectIndex(): Promise<ProjectIndexEntry[]> {
    await ensureBaseState();
    return readJsonFile<ProjectIndexEntry[]>(projectIndexPath, []);
  }

  async function writeProjectIndex(
    transform: (entries: ProjectIndexEntry[]) => ProjectIndexEntry[]
  ) {
    const entries = await getProjectIndex();
    await atomicWriteJson(projectIndexPath, transform(entries));
  }

  async function prepareProjectStorage(
    projectId: string,
    workspacePath: string | null
  ): Promise<string> {
    if (!workspacePath) {
      return projectDir(projectId);
    }

    await ensureWorkspacePathAvailable(projectId, workspacePath);

    const storageDir = workspaceStorageDir(workspacePath);
    await ensureDir(storageDir);
    await ensureDir(projectsRoot);
    await removePath(projectDir(projectId));
    await symlink(
      storageDir,
      projectDir(projectId),
      process.platform === "win32" ? "junction" : "dir"
    );
    await ensureWorkspaceSurface(workspacePath);
    return storageDir;
  }

  async function ensureWorkspacePathAvailable(
    projectId: string,
    workspacePath: string
  ): Promise<void> {
    const entries = await getProjectIndex();
    const existingEntry = entries.find(
      (entry) =>
        entry.id !== projectId &&
        typeof entry.workspacePath === "string" &&
        path.resolve(entry.workspacePath) === workspacePath
    );
    if (existingEntry) {
      throw new Error("This folder already contains a Lumen workspace.");
    }

    const existingProject = await readJsonFile<ProjectFileRecord | null>(
      path.join(workspaceStorageDir(workspacePath), "project.json"),
      null
    );
    if (existingProject && existingProject.id !== projectId) {
      throw new Error("This folder already contains a Lumen workspace.");
    }

    const visibleWorkspace = workspaceVisibleDir(workspacePath);
    const visibleWorkspaceEntries = await readdir(visibleWorkspace).catch((error: unknown) => {
      const code =
        typeof error === "object" && error && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";
      if (code === "ENOENT") {
        return null;
      }
      throw error;
    });
    if (visibleWorkspaceEntries && visibleWorkspaceEntries.length > 0) {
      throw new Error("This folder already contains a visible Lumen workspace.");
    }
  }

  async function getProjectIdForRun(runId: string): Promise<string | null> {
    const entry = (await getProjectIndex()).find((item) => item.runId === runId);
    return entry?.id ?? null;
  }

  async function getProjectEntryForRun(runId: string): Promise<ProjectIndexEntry | null> {
    const entry = (await getProjectIndex()).find((item) => item.runId === runId);
    return entry ?? null;
  }

  function resolveWorkspaceFilePath(
    storageDir: string,
    fileKey: string
  ): string | null {
    switch (fileKey) {
      case "overview":
        return path.join(storageDir, "artifacts", "overview.md");
      case "synthesis":
        return path.join(storageDir, "artifacts", "synthesis.md");
      case "claims":
        return path.join(storageDir, "artifacts", "claims.md");
      case "gaps":
        return path.join(storageDir, "artifacts", "gaps.md");
      case "nextSteps":
        return path.join(storageDir, "artifacts", "next-steps.md");
      default:
        break;
    }

    if (fileKey.startsWith("note:")) {
      return path.join(storageDir, "notes", `${fileKey.slice(5)}.md`);
    }

    if (fileKey.startsWith("paper:")) {
      return path.join(storageDir, "papers", `${fileKey.slice(6)}.tex`);
    }

    if (fileKey.startsWith("experiment:")) {
      return path.join(storageDir, "experiments", `${fileKey.slice(11)}.json`);
    }

    if (fileKey.startsWith("source:")) {
      return path.join(
        storageDir,
        "artifacts",
        "source-summaries",
        `${fileKey.slice(7)}.md`
      );
    }

    return null;
  }

  function resolveVisibleWorkspaceFilePath(
    workspacePath: string,
    fileKey: string
  ): string | null {
    const visibleRoot = workspaceVisibleDir(workspacePath);

    switch (fileKey) {
      case "overview":
        return path.join(visibleRoot, "artifacts", "overview.md");
      case "synthesis":
        return path.join(visibleRoot, "artifacts", "synthesis.md");
      case "claims":
        return path.join(visibleRoot, "artifacts", "claims.md");
      case "gaps":
        return path.join(visibleRoot, "artifacts", "gaps.md");
      case "nextSteps":
        return path.join(visibleRoot, "artifacts", "next-steps.md");
      default:
        break;
    }

    if (fileKey.startsWith("note:")) {
      return path.join(visibleRoot, "notes", `${fileKey.slice(5)}.md`);
    }

    if (fileKey.startsWith("paper:")) {
      return path.join(visibleRoot, "papers", `${fileKey.slice(6)}.tex`);
    }

    if (fileKey.startsWith("experiment:")) {
      return path.join(visibleRoot, "experiments", `${fileKey.slice(11)}.json`);
    }

    if (fileKey.startsWith("source:")) {
      return path.join(visibleRoot, "sources", `${fileKey.slice(7)}.md`);
    }

    return null;
  }

  async function ensureWorkspaceSurface(workspacePath: string): Promise<void> {
    const hiddenRoot = workspaceStorageDir(workspacePath);
    const visibleRoot = workspaceVisibleDir(workspacePath);

    await ensureDir(hiddenRoot);
    await ensureDir(path.join(hiddenRoot, "artifacts", "source-summaries"));
    await ensureDir(path.join(hiddenRoot, "notes"));
    await ensureDir(path.join(hiddenRoot, "papers"));
    await ensureDir(path.join(hiddenRoot, "experiments"));
    await ensureDir(visibleRoot);

    await recreateDirectoryLink(
      path.join(visibleRoot, "artifacts"),
      path.join(hiddenRoot, "artifacts")
    );
    await recreateDirectoryLink(
      path.join(visibleRoot, "sources"),
      path.join(hiddenRoot, "artifacts", "source-summaries")
    );
    await recreateDirectoryLink(
      path.join(visibleRoot, "notes"),
      path.join(hiddenRoot, "notes")
    );
    await recreateDirectoryLink(
      path.join(visibleRoot, "papers"),
      path.join(hiddenRoot, "papers")
    );
    await recreateDirectoryLink(
      path.join(visibleRoot, "experiments"),
      path.join(hiddenRoot, "experiments")
    );
  }

  async function recreateDirectoryLink(
    linkPath: string,
    targetPath: string
  ): Promise<void> {
    await removePath(linkPath);
    await symlink(
      targetPath,
      linkPath,
      process.platform === "win32" ? "junction" : "dir"
    );
  }

  async function findSessionLocation(sessionId: string): Promise<{ projectId: string; session: SessionIndexEntry } | null> {
    const entries = await getProjectIndex();
    for (const entry of entries) {
      const sessions = await readJsonFile<SessionIndexEntry[]>(
        sessionsIndexPath(entry.id),
        []
      );
      const session = sessions.find((item) => item.id === sessionId);
      if (session) {
        return { projectId: entry.id, session };
      }
    }

    return null;
  }

  async function updateSessionIndexEntry(
    projectId: string,
    sessionId: string,
    updates: Partial<Pick<SessionIndexEntry, "title" | "updatedAt">>
  ) {
    const sessions = await readJsonFile<SessionIndexEntry[]>(
      sessionsIndexPath(projectId),
      []
    );
    await atomicWriteJson(
      sessionsIndexPath(projectId),
      sessions.map((session) =>
        session.id === sessionId ? { ...session, ...updates } : session
      )
    );
  }

  async function writeArtifactText(projectId: string, filename: string, content: string) {
    await atomicWriteText(artifactPath(projectId, filename), content);
  }

  async function upsertNoteIndex(
    projectId: string,
    noteId: string,
    defaults: { label: string; folder?: string | null } = { label: "Note" }
  ) {
    const index = await readJsonFile<NoteIndexEntry[]>(notesIndexPath(projectId), []);
    const now = new Date().toISOString();
    const existing = index.find((note) => note.id === noteId);
    const next: NoteIndexEntry = existing
      ? { ...existing, updatedAt: now }
      : {
          id: noteId,
          label: defaults.label,
          folder: defaults.folder ?? null,
          createdAt: now,
          updatedAt: now,
        };
    await atomicWriteJson(notesIndexPath(projectId), [
      ...index.filter((note) => note.id !== noteId),
      next,
    ]);
  }

  async function upsertPaperIndex(projectId: string, paperId: string) {
    const index = await readJsonFile<PaperIndexEntry[]>(papersIndexPath(projectId), []);
    const now = new Date().toISOString();
    const existing = index.find((paper) => paper.id === paperId);
    const next: PaperIndexEntry = existing
      ? { ...existing, updatedAt: now }
      : { id: paperId, createdAt: now, updatedAt: now };
    await atomicWriteJson(papersIndexPath(projectId), [
      ...index.filter((paper) => paper.id !== paperId),
      next,
    ]);
  }

  async function upsertExperimentIndex(projectId: string, experimentId: string, title: string) {
    const index = await readJsonFile<ExperimentIndexEntry[]>(
      experimentsIndexPath(projectId),
      []
    );
    const now = new Date().toISOString();
    const existing = index.find((experiment) => experiment.id === experimentId);
    const next: ExperimentIndexEntry = existing
      ? { ...existing, title, updatedAt: now }
      : { id: experimentId, title, createdAt: now, updatedAt: now };
    await atomicWriteJson(experimentsIndexPath(projectId), [
      ...index.filter((experiment) => experiment.id !== experimentId),
      next,
    ]);
  }

  function withProjectLock<T>(projectId: string, fn: () => Promise<T>) {
    return withFileLock(`project:${projectId}`, fn);
  }

  function stripUser(user: UserFileRecord["user"]): StoredUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      organization: user.organization,
      authProvider: user.authProvider,
    };
  }

  async function readUserFile(ensureLocal: boolean): Promise<UserFileRecord | null> {
    const userFile = await readJsonFile<UserFileRecord | null>(userPath, null);
    if (userFile) {
      return userFile;
    }

    if (!ensureLocal || !isElectronRuntime()) {
      return null;
    }

    const now = new Date().toISOString();
    const defaultUser = buildDefaultElectronUser();
    const created: UserFileRecord = {
      user: {
        ...defaultUser,
        createdAt: now,
      },
      credentials: null,
    };
    await atomicWriteJson(userPath, created);
    return created;
  }
}
