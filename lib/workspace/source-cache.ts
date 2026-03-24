import type { AddedSource } from "@/lib/agent/state";
import type { Artifacts } from "@/lib/engine/state";
import { getStorage } from "@/lib/storage";
import type { SourceMeta } from "@/lib/storage/project-types";
import { memoryStore } from "@/lib/storage/memory-store";

export function mergeWorkspaceArtifacts(
  cached?: Artifacts | null,
  persisted?: Artifacts | null
): Artifacts | null {
  if (!cached && !persisted) return null;

  return {
    overview: cached?.overview ?? persisted?.overview ?? "",
    synthesis: cached?.synthesis ?? persisted?.synthesis ?? "",
    claims: cached?.claims ?? persisted?.claims ?? "",
    gaps: cached?.gaps ?? persisted?.gaps ?? "",
    nextSteps: cached?.nextSteps ?? persisted?.nextSteps ?? "",
    sources: {
      ...(persisted?.sources ?? {}),
      ...(cached?.sources ?? {}),
    },
    papers: {
      ...(persisted?.papers ?? {}),
      ...(cached?.papers ?? {}),
    },
    notes: {
      ...(persisted?.notes ?? {}),
      ...(cached?.notes ?? {}),
    },
    experiments: {
      ...(persisted?.experiments ?? {}),
      ...(cached?.experiments ?? {}),
    },
  };
}

export function mergeWorkspaceSourceMeta(
  cached?: Record<string, SourceMeta> | null,
  persisted?: Record<string, SourceMeta> | null
): Record<string, SourceMeta> {
  return {
    ...(persisted ?? {}),
    ...(cached ?? {}),
  };
}

export function applyAddedSourcesToArtifacts(
  artifacts: Artifacts | null | undefined,
  addedSources: AddedSource[]
): Artifacts | null | undefined {
  if (!artifacts || addedSources.length === 0) return artifacts;

  for (const source of addedSources) {
    artifacts.sources[source.sourceId] = source.content;
  }

  return artifacts;
}

export function applyAddedSourcesToSourceMeta(
  meta: Record<string, SourceMeta> | null | undefined,
  addedSources: AddedSource[]
): Record<string, SourceMeta> {
  const next = {
    ...(meta ?? {}),
  };

  for (const source of addedSources) {
    next[source.sourceId] = {
      name: source.label,
      origin: "discovered",
      ...(source.folder ? { folder: source.folder } : {}),
      ...(source.sourceUrl ? { sourceUrl: source.sourceUrl } : {}),
      ...(source.paperQuality ? { paperQuality: source.paperQuality } : {}),
    };
  }

  return next;
}

export async function syncAddedSourcesToWorkspaceCache(
  runId: string,
  addedSources: AddedSource[]
): Promise<void> {
  if (addedSources.length === 0) return;

  const runEntry = memoryStore.getRun(runId);
  const storage = await getStorage();
  const projectId =
    runEntry?.projectId ?? (await storage.getResearchRun(runId))?.projectId;

  if (!projectId) return;

  const runArtifacts = runEntry?.artifacts;
  if (runArtifacts) {
    applyAddedSourcesToArtifacts(runArtifacts, addedSources);
  }

  const cachedArtifacts = memoryStore.getArtifacts(projectId);
  if (cachedArtifacts) {
    applyAddedSourcesToArtifacts(cachedArtifacts, addedSources);
  } else if (runArtifacts) {
    await memoryStore.saveArtifacts(projectId, runArtifacts);
  }

  const mergedMeta = applyAddedSourcesToSourceMeta(
    memoryStore.getSourcesMeta(projectId),
    addedSources
  );
  memoryStore.saveSourcesMeta(projectId, mergedMeta);
}
