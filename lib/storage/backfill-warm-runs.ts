import { initGraph } from "@/lib/engine/graph";
import type { InitRunState } from "@/lib/engine/state";
import { memoryStore } from "@/lib/storage/memory-store";
import { getStorage, type ResearchRunStatus } from "@/lib/storage";

export async function backfillWarmRunsForUser(userId: string) {
  const storage = await getStorage();
  const warmRuns = memoryStore.listRuns();

  for (const run of warmRuns) {
    const existing = await storage.getResearchRun(run.runId);
    if (existing) continue;

    try {
      const snapshot = await initGraph.getState({
        configurable: { thread_id: run.runId },
      });
      const state = snapshot.values as Partial<InitRunState>;

      if (state.userId !== userId || !state.input?.researchQuestion?.trim()) {
        continue;
      }

      await storage.createResearchProjectRun({
        projectId: run.projectId,
        runId: run.runId,
        userId,
        input: state.input,
        status: ((state.status as ResearchRunStatus | undefined) ??
          run.status) as ResearchRunStatus,
        currentStep: state.currentStep ?? "",
        startedAt: state.startedAt ? new Date(state.startedAt) : undefined,
        completedAt: state.completedAt ? new Date(state.completedAt) : null,
      });

      if (state.artifacts) {
        await storage.persistResearchArtifacts({
          runId: run.runId,
          sources: state.sources ?? [],
          sourceChunks: state.sourceChunks ?? [],
          artifacts: state.artifacts,
        });
      }
    } catch {
      // Ignore stale or incomplete warm runs during dashboard backfill.
    }
  }
}
