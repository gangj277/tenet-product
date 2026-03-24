import { NextRequest, NextResponse } from "next/server";
import { initGraph } from "@/lib/engine/graph";
import { memoryStore } from "@/lib/storage/memory-store";
import type { SourceEntry, UserInput } from "@/lib/engine/state";
import { getSession } from "@/lib/auth/session";
import {
  getOwnedResearchRun,
  getPersistedSourcesForRun,
  updateProjectTitle,
  updateResearchRunStatus,
  upsertResearchRunInput,
} from "@/lib/db/research-projects";
import { runWithRequestProvider } from "@/lib/llm/runtime";
import { ensureOpenAIProviderAccess } from "@/lib/llm/openai-access";
import { acquireExclusiveLock } from "@/lib/utils/exclusive-lock";

export const maxDuration = 300;

interface StartDraftAnalysisBody {
  input: UserInput;
  sources?: SourceEntry[];
}

function buildTemporaryProjectTitle(researchQuestion: string) {
  const normalized = researchQuestion.trim().replace(/\s+/g, " ");
  return normalized.slice(0, 500) || "Untitled research";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownedRun = await getOwnedResearchRun(session.userId, runId);
  if (!ownedRun) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  if (ownedRun.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft workspaces can start deep analysis." },
      { status: 409 }
    );
  }

  let releaseLock: (() => void) | null = null;

  try {
    const body = (await request.json()) as StartDraftAnalysisBody;
    if (!body.input?.researchQuestion?.trim()) {
      return NextResponse.json(
        { error: "researchQuestion is required" },
        { status: 400 }
      );
    }

    releaseLock = acquireExclusiveLock(`init:${session.userId}`);
    if (!releaseLock) {
      return NextResponse.json(
        { error: "An init pipeline is already running for this account." },
        { status: 409 }
      );
    }

    const provider = await ensureOpenAIProviderAccess(session.userId, {
      forceRevalidate: true,
    });

    await upsertResearchRunInput({
      runId,
      input: body.input,
    });
    await updateProjectTitle(
      ownedRun.projectId,
      buildTemporaryProjectTitle(body.input.researchQuestion)
    );
    await updateResearchRunStatus({
      projectId: ownedRun.projectId,
      runId,
      status: "running",
    });

    const persistedSources = await getPersistedSourcesForRun(runId);
    const initialSources = body.sources ?? persistedSources;
    const existingRun =
      typeof memoryStore.getRun === "function"
        ? memoryStore.getRun(runId)
        : undefined;
    const cachedArtifacts =
      typeof memoryStore.getArtifacts === "function"
        ? memoryStore.getArtifacts(ownedRun.projectId)
        : undefined;

    memoryStore.setRun(runId, {
      projectId: ownedRun.projectId,
      runId,
      status: "running",
      ...(existingRun?.artifacts || cachedArtifacts
        ? { artifacts: existingRun?.artifacts ?? cachedArtifacts }
        : {}),
      errors: [],
      updatedAt: new Date().toISOString(),
    });

    const config = { configurable: { thread_id: runId } };
    const initialState = {
      projectId: ownedRun.projectId,
      runId,
      userId: session.userId,
      status: "queued" as const,
      input: body.input,
      sources: initialSources,
    };

    const result = await runWithRequestProvider(provider, () =>
      initGraph.invoke(initialState, config)
    );

    memoryStore.setRun(runId, {
      projectId: ownedRun.projectId,
      runId,
      status: "awaiting_confirmation",
      ...(existingRun?.artifacts || cachedArtifacts
        ? { artifacts: existingRun?.artifacts ?? cachedArtifacts }
        : {}),
      updatedAt: new Date().toISOString(),
    });

    await updateResearchRunStatus({
      projectId: ownedRun.projectId,
      runId,
      status: "awaiting_confirmation",
    });

    return NextResponse.json({
      runId,
      projectId: ownedRun.projectId,
      status: "awaiting_confirmation",
      perspective: result.perspective,
    });
  } catch (err) {
    console.error("[draft-start] Pipeline error:", (err as Error).message);

    await updateResearchRunStatus({
      projectId: ownedRun.projectId,
      runId,
      status: "failed",
    }).catch(() => {
      // Preserve the original route error if status sync also fails.
    });

    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  } finally {
    releaseLock?.();
  }
}
