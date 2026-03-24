import path from "node:path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { backfillWarmRunsForUser } from "@/lib/storage/backfill-warm-runs";
import { getStorage } from "@/lib/storage";
import { generateId } from "@/lib/utils/id";
import { memoryStore } from "@/lib/storage/memory-store";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await backfillWarmRunsForUser(session.userId);
  const storage = await getStorage();
  const rows = await storage.listResearchProjectsForUser(session.userId);

  return NextResponse.json({ projects: rows });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let title: string | undefined;
  let workspacePath: string | undefined;
  try {
    const body = (await request.json()) as {
      title?: string;
      workspacePath?: string;
    };
    title = typeof body?.title === "string" ? body.title : undefined;
    workspacePath =
      typeof body?.workspacePath === "string" ? body.workspacePath.trim() : undefined;
  } catch {
    title = undefined;
    workspacePath = undefined;
  }

  if (process.env.ELECTRON) {
    if (!workspacePath) {
      return NextResponse.json(
        { error: "workspacePath is required in Electron mode" },
        { status: 400 }
      );
    }

    if (!path.isAbsolute(workspacePath)) {
      return NextResponse.json(
        { error: "workspacePath must be an absolute path" },
        { status: 400 }
      );
    }
  }

  const projectId = generateId();
  const runId = generateId();

  const storage = await getStorage();
  const { noteId } = await storage.createDraftWorkspaceProjectRun({
    projectId,
    runId,
    userId: session.userId,
    title,
    ...(workspacePath ? { workspacePath } : {}),
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
