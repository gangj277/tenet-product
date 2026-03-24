import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { backfillWarmRunsForUser } from "@/lib/db/backfill-warm-runs";
import {
  createDraftWorkspaceProjectRun,
  listResearchProjectsForUser,
} from "@/lib/db/research-projects";
import { generateId } from "@/lib/utils/id";
import { memoryStore } from "@/lib/storage/memory-store";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await backfillWarmRunsForUser(session.userId);
  const rows = await listResearchProjectsForUser(session.userId);

  return NextResponse.json({ projects: rows });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let title: string | undefined;
  try {
    const body = (await request.json()) as { title?: string };
    title = typeof body?.title === "string" ? body.title : undefined;
  } catch {
    title = undefined;
  }

  const projectId = generateId();
  const runId = generateId();

  const { noteId } = await createDraftWorkspaceProjectRun({
    projectId,
    runId,
    userId: session.userId,
    title,
  });

  const draftArtifacts = {
    overview: "",
    synthesis: "",
    claims: "",
    gaps: "",
    nextSteps: "",
    sources: {},
    papers: {},
    notes: {
      [noteId]: "",
    },
    experiments: {},
  };

  memoryStore.setRun(runId, {
    projectId,
    runId,
    status: "draft",
    artifacts: draftArtifacts,
    updatedAt: new Date().toISOString(),
  });
  await memoryStore.saveArtifacts(projectId, draftArtifacts);
  memoryStore.saveSourcesMeta(projectId, {});

  return NextResponse.json({
    projectId,
    runId,
    status: "draft",
  });
}
