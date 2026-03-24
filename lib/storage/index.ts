import path from "node:path";
import type { StorageAdapter } from "./adapter";

const globalForStorage = globalThis as typeof globalThis & {
  __lumenStorageAdapter?: Promise<StorageAdapter>;
  __lumenStorageKey?: string;
};

const REQUIRED_STORAGE_METHODS = [
  "listResearchProjectsForUser",
  "createResearchProjectRun",
  "createDraftWorkspaceProjectRun",
  "updateResearchRunStatus",
  "upsertResearchRunInput",
  "updateProjectTitle",
  "getOwnedResearchRun",
  "getResearchRun",
  "deleteProjectForUser",
  "persistResearchArtifacts",
  "getPersistedArtifacts",
  "updateArtifactContents",
  "getPersistedSourcesForRun",
  "getLocalWorkspaceFilePath",
  "getSourceMetadataForRun",
  "deleteSource",
  "addAgentDiscoveredSource",
  "createNote",
  "deleteNote",
  "updateNoteMeta",
  "getNoteMetadataForRun",
  "createExperiment",
  "deleteExperiment",
  "getExperimentMetadataForRun",
  "deletePaper",
  "getSessionsForRun",
  "createSession",
  "getSessionMessages",
  "appendMessages",
  "updateSessionTitle",
  "updateMessageMetadata",
  "deleteSession",
  "getUserByEmail",
  "getUserById",
  "upsertUser",
  "updateUserProfile",
  "getLLMCredentials",
  "upsertLLMCredentials",
  "deleteLLMCredentials",
] as const;

function resolveStorageKey(): string {
  if (process.env.ELECTRON) {
    return `electron:${process.env.LUMEN_DATA_DIR ?? path.join(process.cwd(), ".lumen-electron-data")}`;
  }
  return "postgres";
}

function hasRequiredStorageShape(value: unknown): value is StorageAdapter {
  if (!value || typeof value !== "object") {
    return false;
  }

  return REQUIRED_STORAGE_METHODS.every(
    (method) =>
      typeof (value as Record<string, unknown>)[method] === "function"
  );
}

function createStoragePromise(): Promise<StorageAdapter> {
  return process.env.ELECTRON
    ? import("./fs-adapter").then(({ createFsAdapter }) =>
        createFsAdapter(
          process.env.LUMEN_DATA_DIR ??
            path.join(process.cwd(), ".lumen-electron-data")
        )
      )
    : import("./postgres-adapter").then(({ createPostgresAdapter }) =>
        createPostgresAdapter()
      );
}

export async function getStorage(): Promise<StorageAdapter> {
  const key = resolveStorageKey();

  if (
    globalForStorage.__lumenStorageAdapter &&
    globalForStorage.__lumenStorageKey === key
  ) {
    try {
      const cached = await globalForStorage.__lumenStorageAdapter;
      if (hasRequiredStorageShape(cached)) {
        return cached;
      }
    } catch {
      // Recreate a broken cached adapter below.
    }

    delete globalForStorage.__lumenStorageAdapter;
    delete globalForStorage.__lumenStorageKey;
  }

  globalForStorage.__lumenStorageKey = key;
  globalForStorage.__lumenStorageAdapter = createStoragePromise();

  const adapter = await globalForStorage.__lumenStorageAdapter;
  if (!hasRequiredStorageShape(adapter)) {
    resetStorageForTests();
    throw new TypeError("Storage adapter is missing required methods.");
  }

  return adapter;
}

export function resetStorageForTests(): void {
  delete globalForStorage.__lumenStorageAdapter;
  delete globalForStorage.__lumenStorageKey;
}

export type { StorageAdapter } from "./adapter";
export * from "./project-types";
export * from "./credential-types";
export * from "./chat-types";
export * from "./user-types";
