import { and, eq } from "drizzle-orm";
import type { StorageAdapter } from "./adapter";
import type { StoredUser, UpsertUserParams } from "./user-types";
import * as lifecycle from "@/lib/db/research-project-lifecycle";
import * as artifacts from "@/lib/db/research-project-artifacts";
import * as sources from "@/lib/db/research-project-sources";
import * as notes from "@/lib/db/research-project-notes";
import * as experiments from "@/lib/db/research-project-experiments";
import * as chat from "@/lib/db/chat-sessions";
import * as credentials from "@/lib/db/user-credentials";
import { db } from "@/lib/db/client";
import { projects, users } from "@/lib/db/schema";

function mapUser(row: {
  id: string;
  email: string;
  name: string;
  organization: string | null;
  authProvider: string;
}): StoredUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    organization: row.organization,
    authProvider: row.authProvider === "openai_auth" ? "openai_auth" : "openai_auth",
  };
}

export function createPostgresAdapter(): StorageAdapter {
  return {
    listResearchProjectsForUser: lifecycle.listResearchProjectsForUser,
    createResearchProjectRun: lifecycle.createResearchProjectRun,
    createDraftWorkspaceProjectRun: lifecycle.createDraftWorkspaceProjectRun,
    updateResearchRunStatus: lifecycle.updateResearchRunStatus,
    upsertResearchRunInput: lifecycle.upsertResearchRunInput,
    updateProjectTitle: lifecycle.updateProjectTitle,
    getOwnedResearchRun: lifecycle.getOwnedResearchRun,
    getResearchRun: lifecycle.getResearchRun,
    async deleteProjectForUser(userId: string, projectId: string) {
      await db
        .delete(projects)
        .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
    },

    persistResearchArtifacts: artifacts.persistResearchArtifacts,
    getPersistedArtifacts: artifacts.getPersistedArtifacts,
    updateArtifactContents: artifacts.updateArtifactContents,
    getPersistedSourcesForRun: artifacts.getPersistedSourcesForRun,
    getLocalWorkspaceFilePath: async () => null,

    getSourceMetadataForRun: sources.getSourceMetadataForRun,
    deleteSource: sources.deleteSource,
    addAgentDiscoveredSource: sources.addAgentDiscoveredSource,

    createNote: notes.createNote,
    deleteNote: notes.deleteNote,
    updateNoteMeta: notes.updateNoteMeta,
    getNoteMetadataForRun: notes.getNoteMetadataForRun,

    createExperiment: experiments.createExperiment,
    deleteExperiment: experiments.deleteExperiment,
    getExperimentMetadataForRun: experiments.getExperimentMetadataForRun,
    deletePaper: experiments.deletePaper,

    getSessionsForRun: chat.getSessionsForRun,
    createSession: chat.createSession,
    getSessionMessages: chat.getSessionMessages,
    appendMessages: chat.appendMessages,
    updateSessionTitle: chat.updateSessionTitle,
    updateMessageMetadata: chat.updateMessageMetadata,
    deleteSession: chat.deleteSession,

    async getUserByEmail(email: string) {
      const [row] = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          organization: users.organization,
          authProvider: users.authProvider,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      return row ? mapUser(row) : null;
    },
    async getUserById(userId: string) {
      const [row] = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          organization: users.organization,
          authProvider: users.authProvider,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return row ? mapUser(row) : null;
    },
    async upsertUser(params: UpsertUserParams) {
      const existing =
        (params.id ? await this.getUserById(params.id) : null) ??
        (await this.getUserByEmail(params.email));

      if (existing) {
        await db
          .update(users)
          .set({
            email: params.email,
            name: params.name,
            organization: params.organization ?? existing.organization,
            authProvider: params.authProvider,
          })
          .where(eq(users.id, existing.id));

        return {
          ...existing,
          email: params.email,
          name: params.name,
          organization: params.organization ?? existing.organization,
          authProvider: params.authProvider,
        };
      }

      const [created] = await db
        .insert(users)
        .values({
          ...(params.id ? { id: params.id } : {}),
          email: params.email,
          passwordHash: null,
          name: params.name,
          organization: params.organization ?? null,
          authProvider: params.authProvider,
        })
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          organization: users.organization,
          authProvider: users.authProvider,
        });

      return mapUser(created);
    },
    async updateUserProfile(userId: string, params: { name?: string; organization?: string | null }) {
      await db
        .update(users)
        .set({
          ...(params.name !== undefined ? { name: params.name } : {}),
          ...(params.organization !== undefined
            ? { organization: params.organization }
            : {}),
        })
        .where(eq(users.id, userId));
    },

    getLLMCredentials: credentials.getUserLLMCredentials,
    upsertLLMCredentials: credentials.upsertUserLLMCredentials,
    deleteLLMCredentials: credentials.deleteUserLLMCredentials,
  };
}
