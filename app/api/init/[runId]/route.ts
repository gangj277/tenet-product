import { NextRequest, NextResponse } from "next/server";
import { memoryStore } from "@/lib/storage/memory-store";
import { initGraph } from "@/lib/engine/graph";
import { getSession } from "@/lib/auth/session";
import { getStorage } from "@/lib/storage";
import type { InitRunState, Perspective, RunError } from "@/lib/engine/state";
import type { StepProgress } from "@/lib/storage/memory-store";

const TERMINAL_STATUSES = new Set([
  "awaiting_confirmation",
  "failed",
  "partial",
  "completed",
]);

function resolveStatus({
  graphStatus,
  memoryStatus,
  persistedStatus,
}: {
  graphStatus?: string;
  memoryStatus?: string;
  persistedStatus?: string;
}) {
  if (graphStatus && TERMINAL_STATUSES.has(graphStatus)) return graphStatus;
  if (memoryStatus && TERMINAL_STATUSES.has(memoryStatus)) return memoryStatus;
  if (persistedStatus && TERMINAL_STATUSES.has(persistedStatus)) return persistedStatus;
  return graphStatus ?? memoryStatus ?? persistedStatus ?? "queued";
}

function getProgressStepId(progress?: StepProgress[]) {
  return (
    progress?.find((step) => step.status === "failed")?.id ??
    progress?.find((step) => step.status === "running")?.id
  );
}

function resolveCurrentStep({
  status,
  graphCurrentStep,
  memoryCurrentStep,
  persistedCurrentStep,
  progress,
}: {
  status: string;
  graphCurrentStep?: string;
  memoryCurrentStep?: string;
  persistedCurrentStep?: string | null;
  progress?: StepProgress[];
}) {
  const progressStepId = getProgressStepId(progress);

  if (status === "failed") {
    return (
      progressStepId ??
      memoryCurrentStep ??
      persistedCurrentStep ??
      graphCurrentStep ??
      ""
    );
  }

  return (
    graphCurrentStep ??
    memoryCurrentStep ??
    persistedCurrentStep ??
    progressStepId ??
    ""
  );
}

function resolveErrors({
  graphErrors,
  memoryErrors,
}: {
  graphErrors?: unknown;
  memoryErrors?: RunError[];
}) {
  return Array.isArray(graphErrors) && graphErrors.length > 0
    ? graphErrors
    : (memoryErrors ?? []);
}

export async function GET(
  _request: NextRequest,
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

  // Get progress from side-channel
  const progress = memoryStore.getProgress(runId);

  // Get the latest state from the graph checkpointer
  const config = { configurable: { thread_id: runId } };

  try {
    const snapshot = await initGraph.getState(config);
    const state = snapshot.values as Partial<InitRunState>;
    const status = resolveStatus({
      graphStatus: state.status,
      memoryStatus: run?.status,
      persistedStatus: ownedRun.status,
    });

    return NextResponse.json({
      runId,
      projectId: ownedRun.projectId,
      status,
      ...(status === "awaiting_confirmation" && state.perspective
        ? { perspective: state.perspective as Perspective }
        : {}),
      currentStep: resolveCurrentStep({
        status,
        graphCurrentStep: state.currentStep,
        memoryCurrentStep: run?.currentStep,
        persistedCurrentStep: ownedRun.currentStep,
        progress,
      }),
      errors: resolveErrors({
        graphErrors: state.errors,
        memoryErrors: run?.errors,
      }),
      progress: progress ?? [],
    });
  } catch {
    // Fallback to memory store if checkpointer fails
    const status = resolveStatus({
      memoryStatus: run?.status,
      persistedStatus: ownedRun.status,
    });

    return NextResponse.json({
      runId,
      projectId: ownedRun.projectId,
      status,
      currentStep: resolveCurrentStep({
        status,
        memoryCurrentStep: run?.currentStep,
        persistedCurrentStep: ownedRun.currentStep,
        progress,
      }),
      errors: run?.errors ?? [],
      progress: progress ?? [],
    });
  }
}
