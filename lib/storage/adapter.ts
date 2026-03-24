import type { Artifacts, SourceChunk, SourceEntry, UserInput } from "@/lib/engine/state";
import type {
  DashboardProjectRecord,
  ExperimentMeta,
  NoteMeta,
  OwnedRunRecord,
  ResearchRunStatus,
  SourceMeta,
} from "./project-types";
import type { NewSessionMessage, SessionMessage, SessionSummary } from "./chat-types";
import type { ProviderTokens } from "./credential-types";
import type { StoredUser, UpsertUserParams } from "./user-types";

export interface StorageAdapter {
  listResearchProjectsForUser(userId: string): Promise<DashboardProjectRecord[]>;
  createResearchProjectRun(params: {
    projectId: string;
    runId: string;
    userId: string;
    input: UserInput;
    workspacePath?: string;
    status: ResearchRunStatus;
    currentStep?: string;
    startedAt?: Date;
    completedAt?: Date | null;
  }): Promise<void>;
  createDraftWorkspaceProjectRun(params: {
    projectId: string;
    runId: string;
    userId: string;
    title?: string;
    noteId?: string;
    workspacePath?: string;
    startedAt?: Date;
  }): Promise<{ title: string; noteId: string }>;
  updateResearchRunStatus(params: {
    projectId: string;
    runId: string;
    status: ResearchRunStatus;
    currentStep?: string;
    completedAt?: Date | null;
  }): Promise<void>;
  upsertResearchRunInput(params: {
    runId: string;
    input: UserInput;
  }): Promise<void>;
  updateProjectTitle(projectId: string, title: string): Promise<void>;
  getOwnedResearchRun(userId: string, runId: string): Promise<OwnedRunRecord | null>;
  getResearchRun(runId: string): Promise<OwnedRunRecord | null>;
  deleteProjectForUser(userId: string, projectId: string): Promise<void>;

  persistResearchArtifacts(params: {
    runId: string;
    sources: SourceEntry[];
    sourceChunks?: SourceChunk[];
    artifacts: Artifacts;
    sourceFolders?: Record<string, string[]>;
  }): Promise<void>;
  getPersistedArtifacts(runId: string): Promise<Artifacts | null>;
  updateArtifactContents(runId: string, edits: Record<string, string>): Promise<void>;
  getPersistedSourcesForRun(runId: string): Promise<SourceEntry[]>;
  getLocalWorkspaceFilePath(runId: string, fileKey: string): Promise<string | null>;

  getSourceMetadataForRun(runId: string): Promise<Record<string, SourceMeta>>;
  deleteSource(runId: string, sourceId: string): Promise<boolean>;
  addAgentDiscoveredSource(params: {
    runId: string;
    sourceId: string;
    name: string;
    origin?: "uploaded" | "discovered";
    mimeType: string;
    storagePath: string;
    metadata: Record<string, unknown>;
    sourceChunks?: SourceChunk[];
    summaryContent: string;
  }): Promise<void>;

  createNote(
    runId: string,
    params: { id?: string; label: string; folder?: string; content?: string }
  ): Promise<string>;
  deleteNote(runId: string, noteId: string): Promise<boolean>;
  updateNoteMeta(
    runId: string,
    noteId: string,
    updates: { label?: string; folder?: string | null }
  ): Promise<boolean>;
  getNoteMetadataForRun(runId: string): Promise<Record<string, NoteMeta>>;

  createExperiment(
    runId: string,
    params: { id?: string; title: string; content?: string }
  ): Promise<string>;
  deleteExperiment(runId: string, experimentId: string): Promise<boolean>;
  getExperimentMetadataForRun(runId: string): Promise<Record<string, ExperimentMeta>>;
  deletePaper(runId: string, paperId: string): Promise<boolean>;

  getSessionsForRun(runId: string): Promise<SessionSummary[]>;
  createSession(runId: string, title?: string): Promise<{ id: string; title: string | null }>;
  getSessionMessages(sessionId: string): Promise<SessionMessage[]>;
  appendMessages(sessionId: string, messages: NewSessionMessage[]): Promise<void>;
  updateSessionTitle(sessionId: string, title: string): Promise<void>;
  updateMessageMetadata(
    sessionId: string,
    messageId: string,
    metadata: Record<string, unknown>
  ): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;

  getUserByEmail(email: string): Promise<StoredUser | null>;
  getUserById(userId: string): Promise<StoredUser | null>;
  upsertUser(params: UpsertUserParams): Promise<StoredUser>;
  updateUserProfile(
    userId: string,
    params: { name?: string; organization?: string | null }
  ): Promise<void>;

  getLLMCredentials(userId: string): Promise<ProviderTokens | null>;
  upsertLLMCredentials(userId: string, tokens: ProviderTokens): Promise<void>;
  deleteLLMCredentials(userId: string): Promise<void>;
}
