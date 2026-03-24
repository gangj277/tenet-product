import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import test from "node:test";

import type { UserInput } from "../lib/engine/state";

const RESEARCH_INPUT: UserInput = {
  researchQuestion: "Does retrieval improve factual accuracy?",
  researchIntent: "Decide whether to adopt RAG in production",
};

test("filesystem adapter persists a draft workspace end to end", async () => {
  const { createFsAdapter } = await import("../lib/storage/fs-adapter.ts");
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "lumen-fs-adapter-"));

  try {
    const adapter = createFsAdapter(tmpDir);
    const userId = "00000000-0000-0000-0000-000000000001";
    const projectId = "project-1";
    const runId = "run-1";

    const { noteId, title } = await adapter.createDraftWorkspaceProjectRun({
      projectId,
      runId,
      userId,
      title: "My workspace",
    });

    assert.equal(title, "My workspace");

    const projects = await adapter.listResearchProjectsForUser(userId);
    assert.deepEqual(
      projects.map((project) => ({
        id: project.id,
        runId: project.runId,
        title: project.title,
        status: project.status,
      })),
      [
        {
          id: projectId,
          runId,
          title: "My workspace",
          status: "draft",
        },
      ]
    );

    const ownedRun = await adapter.getOwnedResearchRun(userId, runId);
    assert.deepEqual(ownedRun, {
      runId,
      projectId,
      status: "draft",
      currentStep: "",
    });

    await adapter.upsertResearchRunInput({
      runId,
      input: RESEARCH_INPUT,
    });
    await adapter.updateProjectTitle(projectId, "Updated workspace");
    await adapter.updateResearchRunStatus({
      projectId,
      runId,
      status: "running",
      currentStep: "build_source_set",
    });

    await adapter.updateArtifactContents(runId, {
      overview: "Overview",
      [`note:${noteId}`]: "Scratchpad",
      "paper:paper-1": "\\section{Intro}",
      "experiment:experiment-1": JSON.stringify({
        title: "Experiment title",
        hypothesis: "H1",
      }),
    });

    await adapter.addAgentDiscoveredSource({
      runId,
      sourceId: "source-1",
      name: "Retrieval paper",
      mimeType: "application/pdf",
      storagePath: "blob-store/sources/source-1/raw.pdf",
      metadata: {
        sourceKind: "pdf",
        sourceUrl: "https://example.com/retrieval-paper.pdf",
        rawBlobKey: "sources/source-1/raw.pdf",
        sniffedMimeType: "application/pdf",
        byteSize: 1024,
      },
      summaryContent: "Source summary",
      sourceChunks: [
        {
          sourceId: "source-1",
          sourceName: "Retrieval paper",
          chunkIndex: 0,
          headingPath: "Intro",
          tokenEstimate: 42,
          charCount: 180,
          blobKey: "sources/source-1/chunks/0.md",
        },
      ],
    });

    const sessionsBefore = await adapter.getSessionsForRun(runId);
    assert.equal(sessionsBefore.length, 0);

    const createdSession = await adapter.createSession(runId, "First chat");
    await adapter.appendMessages(createdSession.id, [
      {
        id: "message-1",
        role: "user",
        text: "Hello",
      },
      {
        id: "message-2",
        role: "agent",
        text: "Hi",
        metadata: {
          processTrace: [
            {
              kind: "search_workspace",
              status: "completed",
            },
          ],
        },
      },
    ]);
    await adapter.updateSessionTitle(createdSession.id, "Renamed chat");
    await adapter.updateMessageMetadata(createdSession.id, "message-2", {
      accepted: true,
    });

    const artifacts = await adapter.getPersistedArtifacts(runId);
    assert.equal(artifacts?.overview, "Overview");
    assert.equal(artifacts?.notes[noteId], "Scratchpad");
    assert.equal(artifacts?.papers["paper-1"], "\\section{Intro}");
    assert.equal(
      JSON.parse(artifacts?.experiments["experiment-1"] ?? "{}").title,
      "Experiment title"
    );
    assert.equal(artifacts?.sources["source-1"], "Source summary");

    const sourceMeta = await adapter.getSourceMetadataForRun(runId);
    assert.equal(sourceMeta["source-1"]?.name, "Retrieval paper");
    assert.equal(
      sourceMeta["source-1"]?.sourceUrl,
      "https://example.com/retrieval-paper.pdf"
    );

    const sessionsAfter = await adapter.getSessionsForRun(runId);
    assert.deepEqual(
      sessionsAfter.map((session) => ({
        id: session.id,
        title: session.title,
        messageCount: session.messageCount,
      })),
      [
        {
          id: createdSession.id,
          title: "Renamed chat",
          messageCount: 2,
        },
      ]
    );

    const messages = await adapter.getSessionMessages(createdSession.id);
    assert.equal(messages.length, 2);
    assert.deepEqual(messages[1]?.metadata, { accepted: true });

    await adapter.deleteSession(createdSession.id);
    assert.equal((await adapter.getSessionsForRun(runId)).length, 0);

    await adapter.deleteProjectForUser(userId, projectId);
    assert.equal((await adapter.listResearchProjectsForUser(userId)).length, 0);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("filesystem adapter persists local user credentials", async () => {
  const { createFsAdapter } = await import("../lib/storage/fs-adapter.ts");
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "lumen-fs-credentials-"));

  try {
    const adapter = createFsAdapter(tmpDir);
    const user = await adapter.upsertUser({
      id: "00000000-0000-0000-0000-000000000001",
      email: "local@lumen.app",
      name: "Local User",
      authProvider: "openai_auth",
    });

    assert.equal(user.name, "Local User");

    await adapter.upsertLLMCredentials(user.id, {
      kind: "openai_auth",
      access: "access-token",
      refresh: "refresh-token",
      expires: 123456789,
      accountId: "account-1",
      validation: {
        status: "degraded",
        validatedAt: null,
        capabilities: {
          basic: true,
          json: true,
          streaming: true,
          toolCalling: true,
          liteModel: false,
        },
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });

    const creds = await adapter.getLLMCredentials(user.id);
    assert.equal(creds?.kind, "openai_auth");
    assert.equal(creds?.access, "access-token");
    assert.equal(creds?.validation.status, "degraded");

    await adapter.deleteLLMCredentials(user.id);
    assert.equal(await adapter.getLLMCredentials(user.id), null);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("filesystem adapter initializes Electron workspaces inside the chosen folder", async () => {
  const { createFsAdapter } = await import("../lib/storage/fs-adapter.ts");
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "lumen-fs-workspace-root-"));
  const workspaceRoot = path.join(tmpDir, "chosen-workspace");

  try {
    const adapter = createFsAdapter(tmpDir);
    const userId = "00000000-0000-0000-0000-000000000001";
    const projectId = "project-rooted";
    const runId = "run-rooted";

    await adapter.createDraftWorkspaceProjectRun({
      projectId,
      runId,
      userId,
      title: "Folder-rooted workspace",
      workspacePath: workspaceRoot,
    });

    const projectJson = JSON.parse(
      await readFile(path.join(workspaceRoot, ".lumen", "project.json"), "utf8")
    ) as { title?: string };
    assert.equal(projectJson.title, "Folder-rooted workspace");

    await adapter.updateArtifactContents(runId, {
      overview: "Saved into chosen folder",
    });

    const overview = await readFile(
      path.join(workspaceRoot, ".lumen", "artifacts", "overview.md"),
      "utf8"
    );
    assert.equal(overview, "Saved into chosen folder");

    const visibleOverview = await readFile(
      path.join(workspaceRoot, "lumen", "artifacts", "overview.md"),
      "utf8"
    );
    assert.equal(visibleOverview, "Saved into chosen folder");

    await adapter.deleteProjectForUser(userId, projectId);

    await assert.rejects(
      readFile(path.join(workspaceRoot, ".lumen", "project.json"), "utf8"),
      { code: "ENOENT" }
    );
    await assert.rejects(
      readFile(path.join(workspaceRoot, "lumen", "artifacts", "overview.md"), "utf8"),
      { code: "ENOENT" }
    );

    const workspaceStats = await stat(workspaceRoot);
    assert.equal(workspaceStats.isDirectory(), true);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("filesystem adapter resolves local workspace file paths inside the chosen folder", async () => {
  const { createFsAdapter } = await import("../lib/storage/fs-adapter.ts");
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "lumen-fs-workspace-paths-"));
  const workspaceRoot = path.join(tmpDir, "chosen-workspace");

  try {
    const adapter = createFsAdapter(tmpDir);
    const userId = "00000000-0000-0000-0000-000000000001";
    const projectId = "project-paths";
    const runId = "run-paths";

    const { noteId } = await adapter.createDraftWorkspaceProjectRun({
      projectId,
      runId,
      userId,
      title: "Path-resolved workspace",
      workspacePath: workspaceRoot,
    });

    await adapter.updateArtifactContents(runId, {
      overview: "Overview",
      [`note:${noteId}`]: "Scratchpad",
      "paper:paper-1": "\\section{Intro}",
      "experiment:experiment-1": JSON.stringify({
        title: "Experiment title",
        hypotheses: [],
        researchQuestion: "What happens?",
      }),
    });

    await adapter.addAgentDiscoveredSource({
      runId,
      sourceId: "source-1",
      name: "Retrieval paper",
      mimeType: "application/pdf",
      storagePath: "blob-store/sources/source-1/raw.pdf",
      metadata: {
        sourceKind: "pdf",
        sourceUrl: "https://example.com/retrieval-paper.pdf",
        rawBlobKey: "sources/source-1/raw.pdf",
        sniffedMimeType: "application/pdf",
        byteSize: 1024,
      },
      summaryContent: "Source summary",
    });

    assert.equal(
      await adapter.getLocalWorkspaceFilePath(runId, "overview"),
      path.join(workspaceRoot, "lumen", "artifacts", "overview.md")
    );
    assert.equal(
      await adapter.getLocalWorkspaceFilePath(runId, `note:${noteId}`),
      path.join(workspaceRoot, "lumen", "notes", `${noteId}.md`)
    );
    assert.equal(
      await adapter.getLocalWorkspaceFilePath(runId, "paper:paper-1"),
      path.join(workspaceRoot, "lumen", "papers", "paper-1.tex")
    );
    assert.equal(
      await adapter.getLocalWorkspaceFilePath(runId, "experiment:experiment-1"),
      path.join(workspaceRoot, "lumen", "experiments", "experiment-1.json")
    );
    assert.equal(
      await adapter.getLocalWorkspaceFilePath(runId, "source:source-1"),
      path.join(workspaceRoot, "lumen", "sources", "source-1.md")
    );
    assert.equal(await adapter.getLocalWorkspaceFilePath(runId, "missing"), null);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("filesystem adapter re-projects the visible workspace surface for existing hidden-only workspaces", async () => {
  const { createFsAdapter } = await import("../lib/storage/fs-adapter.ts");
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "lumen-fs-legacy-surface-"));
  const workspaceRoot = path.join(tmpDir, "chosen-workspace");

  try {
    const adapter = createFsAdapter(tmpDir);
    const userId = "00000000-0000-0000-0000-000000000001";
    const projectId = "project-legacy";
    const runId = "run-legacy";

    await adapter.createDraftWorkspaceProjectRun({
      projectId,
      runId,
      userId,
      title: "Legacy workspace",
      workspacePath: workspaceRoot,
    });

    await adapter.updateArtifactContents(runId, {
      overview: "Legacy overview",
    });

    await rm(path.join(workspaceRoot, "lumen"), {
      recursive: true,
      force: true,
    });

    assert.equal(
      await adapter.getLocalWorkspaceFilePath(runId, "overview"),
      path.join(workspaceRoot, "lumen", "artifacts", "overview.md")
    );

    const visibleOverview = await readFile(
      path.join(workspaceRoot, "lumen", "artifacts", "overview.md"),
      "utf8"
    );
    assert.equal(visibleOverview, "Legacy overview");
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});
