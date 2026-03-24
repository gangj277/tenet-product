import { NextRequest, NextResponse } from "next/server";
import { Command } from "@langchain/langgraph";
import { memoryStore } from "@/lib/storage/memory-store";
import { initGraph } from "@/lib/engine/graph";
import type { Perspective } from "@/lib/engine/state";
import { getSession } from "@/lib/auth/session";
import { runWithRequestProvider } from "@/lib/llm/runtime";
import { ensureOpenAIProviderAccess } from "@/lib/llm/openai-access";
import { acquireExclusiveLock } from "@/lib/utils/exclusive-lock";
import { getStorage } from "@/lib/storage";

interface ConfirmBody {
  action: "accept" | "edit";
  perspective?: Perspective;
}

function getRunningStepId(runId: string) {
  return memoryStore.getProgress(runId)?.find((step) => step.status === "running")?.id;
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

  const storage = await getStorage();
  const ownedRun = await storage.getOwnedResearchRun(session.userId, runId);
  if (!ownedRun) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const run = memoryStore.getRun(runId);

  if (!run) {
    return NextResponse.json(
      { error: "Run state is no longer available. Please restart the analysis." },
      { status: 409 }
    );
  }

  try {
    const body = (await request.json()) as ConfirmBody;

    if (!["accept", "edit"].includes(body.action)) {
      return NextResponse.json(
        { error: 'action must be "accept" or "edit"' },
        { status: 400 }
      );
    }

    if (body.action === "edit" && !body.perspective) {
      return NextResponse.json(
        { error: "perspective is required when action is edit" },
        { status: 400 }
      );
    }

    const config = { configurable: { thread_id: runId } };

    // Resume the graph with the user's decision
    const resumeValue = body.action === "edit"
      ? { action: "edit", perspective: body.perspective }
      : { action: "accept" };

    memoryStore.setRun(runId, {
      ...run,
      status: "running",
      errors: [],
      updatedAt: new Date().toISOString(),
    });
    await storage.updateResearchRunStatus({
      projectId: ownedRun.projectId,
      runId,
      status: "running",
    });

    // Update project title from LLM-generated perspective title
    const perspectiveTitle = body.action === "edit"
      ? body.perspective?.projectTitle
      : (await initGraph.getState(config)).values?.perspective?.projectTitle;
    if (perspectiveTitle) {
      void storage.updateProjectTitle(ownedRun.projectId, perspectiveTitle);
    }

    // Initialize progress tracking
    memoryStore.initProgress(runId);

    const releaseLock = acquireExclusiveLock(`init:${session.userId}`);
    if (!releaseLock) {
      return NextResponse.json(
        { error: "An init pipeline is already running for this account." },
        { status: 409 }
      );
    }

    const userProvider = await ensureOpenAIProviderAccess(session.userId, {
      forceRevalidate: true,
    });

    const runPipeline = () =>
      initGraph
      .invoke(new Command({ resume: resumeValue }), config)
      .then((result) => {
        const currentStep =
          typeof result.currentStep === "string" ? result.currentStep : run.currentStep;

        memoryStore.setRun(runId, {
          ...run,
          status: result.status ?? "completed",
          currentStep,
          artifacts: result.artifacts,
          errors: Array.isArray(result.errors) ? result.errors : [],
          updatedAt: new Date().toISOString(),
        });
        return storage.updateResearchRunStatus({
          projectId: ownedRun.projectId,
          runId,
          status: result.status ?? "completed",
          currentStep,
          completedAt:
            result.status === "completed" || result.status === "partial"
              ? new Date()
              : undefined,
        });
      })
      .catch((err) => {
        const message = (err as Error).message;
        const timestamp = new Date().toISOString();
        const failedStep = getRunningStepId(runId) ?? run.currentStep ?? ownedRun.currentStep;

        if (failedStep) {
          memoryStore.updateProgress(runId, failedStep, {
            status: "failed",
            detail: message,
          });
        }

        memoryStore.setRun(runId, {
          ...run,
          status: "failed",
          currentStep: failedStep ?? undefined,
          errors: [
            {
              step: failedStep ?? "pipeline",
              message,
              retryable: false,
              timestamp,
            },
          ],
          updatedAt: timestamp,
        });
        void storage.updateResearchRunStatus({
          projectId: ownedRun.projectId,
          runId,
          status: "failed",
          currentStep: failedStep ?? undefined,
        });
        console.error(`[run ${runId}] Pipeline failed:`, message);
      })
      .finally(() => {
        releaseLock();
      });

    void runWithRequestProvider(userProvider, runPipeline);

    return NextResponse.json({
      runId,
      projectId: run.projectId,
      status: "running",
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
