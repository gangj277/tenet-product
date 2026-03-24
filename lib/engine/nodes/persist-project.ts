import type { InitRunState, InitRunUpdate } from "../state";
import { getStorage } from "@/lib/storage";
import { memoryStore } from "@/lib/storage/memory-store";
import { mergeWorkspaceArtifacts } from "@/lib/workspace/source-cache";

export async function persistProject(
  state: InitRunState
): Promise<InitRunUpdate> {
  const { runId, projectId, artifacts, sources, sourceChunks, sourceFolders } = state;

  memoryStore.updateProgress(runId, "persist_project", {
    status: "running",
    detail: "Saving project files...",
  });

  if (!artifacts) {
    return {
      status: "failed",
      currentStep: "persist_project",
      errors: [
        {
          step: "persist_project",
          message: "No artifacts to persist",
          retryable: false,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  const mergedArtifacts = mergeWorkspaceArtifacts(
    memoryStore.getArtifacts(projectId),
    artifacts
  );
  await memoryStore.saveArtifacts(projectId, mergedArtifacts ?? artifacts);

  // Build inverted folder lookup: sourceId → folderName
  const sourceToFolder: Record<string, string> = {};
  if (sourceFolders) {
    for (const [folderName, ids] of Object.entries(sourceFolders)) {
      for (const id of ids) sourceToFolder[id] = folderName;
    }
  }

  // Build and save source metadata for sidebar display
  const sourcesMetaRecord: Record<string, { name: string; origin: "uploaded" | "discovered"; folder?: string }> = {};
  for (const s of sources) {
    sourcesMetaRecord[s.sourceId] = {
      name: s.name,
      origin: s.origin,
      ...(sourceToFolder[s.sourceId] ? { folder: sourceToFolder[s.sourceId] } : {}),
    };
  }
  memoryStore.saveSourcesMeta(projectId, sourcesMetaRecord);

  const storage = await getStorage();
  await storage.persistResearchArtifacts({
    runId,
    sources,
    sourceChunks,
    artifacts,
    sourceFolders,
  });

  const hasAllArtifacts = !!(
    artifacts.overview &&
    artifacts.synthesis &&
    artifacts.claims &&
    artifacts.gaps &&
    artifacts.nextSteps
  );

  memoryStore.updateProgress(runId, "persist_project", {
    status: "completed",
    detail: hasAllArtifacts ? "Project complete" : "Partial results saved",
  });

  return {
    status: hasAllArtifacts ? "completed" : "partial",
    currentStep: "persist_project",
    completedAt: new Date().toISOString(),
  };
}
