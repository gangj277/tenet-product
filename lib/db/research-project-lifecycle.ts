import { and, desc, eq } from "drizzle-orm";
import type { UserInput } from "@/lib/engine/state";
import { db } from "./client";
import {
  notes,
  projects,
  runs,
  userInputs,
} from "./schema";
import type {
  DashboardProjectRecord,
  OwnedRunRecord,
  ResearchRunStatus,
} from "./research-project-types";
import {
  buildProjectTitle,
  buildWorkspaceTitle,
  DEFAULT_DRAFT_WORKSPACE_TITLE,
  MAX_PROJECT_TITLE_LENGTH,
} from "./research-project-types";

function buildUserInputInsert(runId: string, input: UserInput) {
  const trimmedQuestion = input.researchQuestion.trim();

  return {
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
  };
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
  const userInputRow = buildUserInputInsert(runId, input);

  await db.transaction(async (tx) => {
    await tx.insert(projects).values({
      id: projectId,
      userId,
      title: buildProjectTitle(userInputRow.researchQuestion),
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

    await tx.insert(userInputs).values(userInputRow);
  });
}

export async function createDraftWorkspaceProjectRun({
  projectId,
  runId,
  userId,
  title,
  noteId = crypto.randomUUID(),
  startedAt,
}: {
  projectId: string;
  runId: string;
  userId: string;
  title?: string;
  noteId?: string;
  startedAt?: Date;
}) {
  const now = startedAt ?? new Date();
  const workspaceTitle = buildWorkspaceTitle(title);

  await db.transaction(async (tx) => {
    await tx.insert(projects).values({
      id: projectId,
      userId,
      title: workspaceTitle,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(runs).values({
      id: runId,
      projectId,
      status: "draft",
      currentStep: "",
      startedAt: now,
      completedAt: null,
    });

    await tx.insert(notes).values({
      id: noteId,
      runId,
      label: "Scratchpad",
      folder: null,
      content: "",
      createdAt: now,
      updatedAt: now,
    });
  });

  return {
    title: workspaceTitle,
    noteId,
  };
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

export async function upsertResearchRunInput({
  runId,
  input,
}: {
  runId: string;
  input: UserInput;
}) {
  const values = buildUserInputInsert(runId, input);

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(userInputs)
      .set(values)
      .where(eq(userInputs.runId, runId));

    if (updated.rowCount === 0) {
      await tx.insert(userInputs).values(values);
    }
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
